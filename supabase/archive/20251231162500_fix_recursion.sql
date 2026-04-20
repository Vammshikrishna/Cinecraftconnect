-- ============================================================================
-- FIX RECURSION: Break RLS Cycles with Security Definer Functions
-- ============================================================================

-- 1. Helper: Check if user is creator of a PROJECT (by project_id)
-- Security Definer allows looking up projects without triggering RLS on projects table
CREATE OR REPLACE FUNCTION public.check_is_project_creator(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Helper: Check if user is member of a PROJECT (by project_id, via spaces)
-- Security Definer allows querying memberships without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.check_is_project_member(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_space_members psm
    JOIN public.project_spaces ps ON psm.project_space_id = ps.id
    WHERE ps.project_id = _project_id 
    AND psm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update Policies to use these functions
-- This replaces the inline SQL that was causing infinite recursion

-- PROJECTS TABLE
DROP POLICY IF EXISTS "View Projects" ON public.projects;
CREATE POLICY "View Projects" ON public.projects
FOR SELECT USING (
  is_public = true 
  OR creator_id = auth.uid()
  OR public.check_is_project_member(id)
);

DROP POLICY IF EXISTS "Manage Projects" ON public.projects;
CREATE POLICY "Manage Projects" ON public.projects
FOR ALL USING (creator_id = auth.uid());


-- PROJECT SPACES TABLE
DROP POLICY IF EXISTS "View Project Spaces" ON public.project_spaces;
CREATE POLICY "View Project Spaces" ON public.project_spaces
FOR SELECT USING (
  project_space_type::text = 'public' 
  OR public.check_is_project_creator(project_id)
  OR public.is_project_member(id)
);

DROP POLICY IF EXISTS "Manage Project Spaces" ON public.project_spaces;
CREATE POLICY "Manage Project Spaces" ON public.project_spaces
FOR ALL USING (
  public.check_is_project_creator(project_id)
);


-- PROJECT APPLICATIONS
-- Fix potential recursion here too if it exists
DROP POLICY IF EXISTS "Creator View Applications" ON public.project_applications;
CREATE POLICY "Creator View Applications" ON public.project_applications
FOR SELECT USING (
  -- Check if user is creator of the related project (handles both direct project_id or space_id link)
  EXISTS (
      SELECT 1 FROM public.projects WHERE id = project_applications.project_id AND creator_id = auth.uid()
  )
  OR 
  EXISTS (
      SELECT 1 FROM public.project_spaces ps 
      JOIN public.projects p ON ps.project_id = p.id 
      WHERE ps.id = project_applications.project_id AND p.creator_id = auth.uid()
  )
);
-- Note: The applications query above is NOT security definer wrapped but likely safe 
-- unless project_applications is queried FROM projects policy. It is not.
