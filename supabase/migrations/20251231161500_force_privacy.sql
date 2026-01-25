-- ============================================================================
-- FORCE PRIVACY: Nuclear Option (Comprehensive)
-- ============================================================================
-- This script dynamically DROPS ALL policies on key tables and re-applies STRICT rules.
-- Target Tables: project_spaces, project_space_members, projects, project_applications

-- 1. Helper Macro to Drop Policies
DO $$ 
DECLARE 
  pol record;
  t text;
BEGIN 
  FOREACH t IN ARRAY ARRAY['project_spaces', 'project_space_members', 'projects', 'project_applications'] LOOP
      FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public' LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
  END LOOP;
END $$;

-- 2. Ensure RLS is ENABLED
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;


-- 3. RE-APPLY STRICT POLICIES

-- === A. PROJECT SPACES ===
CREATE POLICY "View Project Spaces" ON public.project_spaces
FOR SELECT USING (
  project_space_type::text = 'public' 
  -- Creator Check (via parent projects table)
  OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_spaces.project_id)
  -- Member Check
  OR public.is_project_member(id)
);

CREATE POLICY "Create Project Spaces" ON public.project_spaces
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Manage Project Spaces" ON public.project_spaces
FOR ALL USING (
  auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_spaces.project_id)
);


-- === B. PROJECT SPACE MEMBERS ===
CREATE POLICY "View Space Members" ON public.project_space_members
FOR SELECT USING (
  public.is_project_member(project_space_id) 
  OR public.is_project_creator(project_space_id)
);

CREATE POLICY "Manage Space Members" ON public.project_space_members
FOR ALL USING (
  public.is_project_creator(project_space_id) 
  OR user_id = auth.uid() -- Users can leave (delete own row)
);


-- === C. PROJECTS (Parent Table) ===
CREATE POLICY "View Projects" ON public.projects
FOR SELECT USING (
  is_public = true 
  OR creator_id = auth.uid()
  -- Check both member tables to be safe (if dual schema exists)
  OR EXISTS (SELECT 1 FROM public.project_space_members psm 
             JOIN public.project_spaces ps ON psm.project_space_id = ps.id 
             WHERE ps.project_id = projects.id AND psm.user_id = auth.uid())
);

CREATE POLICY "Manage Projects" ON public.projects
FOR ALL USING (creator_id = auth.uid());

CREATE POLICY "Create Projects" ON public.projects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- === D. PROJECT APPLICATIONS ===
CREATE POLICY "View Own Applications" ON public.project_applications
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Creator View Applications" ON public.project_applications
FOR SELECT USING (
  auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = (
    SELECT project_id FROM public.project_spaces WHERE id = project_applications.project_id
    UNION 
    SELECT project_id FROM public.projects WHERE id = project_applications.project_id -- Handle if project_id refers to project OR space
  ))
);

CREATE POLICY "Manage Applications" ON public.project_applications
FOR ALL USING (user_id = auth.uid()); -- User can withdraw/edit own app

-- (Creator management of applications usually done via update status, assuming strict check matches above)
