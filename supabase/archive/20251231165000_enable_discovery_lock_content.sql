-- ============================================================================
-- ENABLE DISCOVERY, LOCK CONTENT & JOINING
-- ============================================================================
-- 1. Discovery: Allow users to SEE Private projects (Title/Desc) so they can request to join.
--    Content remains hidden.
-- 2. Security: Prevent users from instantly joining (Self-Insert).
--    Joining now requires Creator approval (Entry into members table restricted).

-- === A. PROJECT SPACES (Relax Visibility) ===
DROP POLICY IF EXISTS "View Project Spaces" ON public.project_spaces;
CREATE POLICY "View Project Spaces" ON public.project_spaces
FOR SELECT USING (
  -- Public AND Private projects are visible to authenticated users (for discovery)
  (project_space_type::text IN ('public', 'private') AND auth.role() = 'authenticated')
  
  -- Secret projects: Only members/creator can see
  OR (project_space_type::text = 'secret' AND (public.is_project_member(id) OR public.check_is_project_creator(project_id)))
  
  -- Members always see their projects regardless of type
  OR public.is_project_member(id)
  OR public.check_is_project_creator(project_id)
);


-- === B. PROJECT SPACE MEMBERS (Prevent Self-Join) ===
DROP POLICY IF EXISTS "Add Members" ON public.project_space_members;
CREATE POLICY "Add Members" ON public.project_space_members
FOR INSERT WITH CHECK (
  -- ONLY the Project Creator (or Admins) can add members.
  -- Users CANNOT add themselves directly. They must use Join Requests.
  public.is_project_creator(project_space_id)
);

-- Ensure Member List is hidden from outsiders
DROP POLICY IF EXISTS "View Space Members" ON public.project_space_members;
CREATE POLICY "View Space Members" ON public.project_space_members
FOR SELECT USING (
  public.is_project_member(project_space_id) 
  OR public.is_project_creator(project_space_id)
);


-- === C. LOCK CONTENT (Verify Strict Access on Child Tables) ===
-- Messages, Files, Tasks should NEVER be visible to non-members
-- We re-assert these policies to be 100% sure.

-- 1. Project Space Messages
ALTER TABLE public.project_space_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View Messages" ON public.project_space_messages;
CREATE POLICY "View Messages" ON public.project_space_messages
FOR SELECT USING (
  public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id)
);

-- 2. Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View Tasks" ON public.tasks;
CREATE POLICY "View Tasks" ON public.tasks
FOR SELECT USING (
  public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id)
);

-- 3. Files (Note: project_id column refers to space id in this schema)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View Files" ON public.files;
CREATE POLICY "View Files" ON public.files
FOR SELECT USING (
  public.is_project_member(project_id) OR public.is_project_creator(project_id) -- project_id here implies space id
);

-- 4. Join Requests (Allow users to creation/view OWN requests)
ALTER TABLE public.project_space_join_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage Own Requests" ON public.project_space_join_requests;
CREATE POLICY "Manage Own Requests" ON public.project_space_join_requests
FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Creator View Requests" ON public.project_space_join_requests;
CREATE POLICY "Creator View Requests" ON public.project_space_join_requests
FOR SELECT USING (
   public.is_project_creator(project_space_id)
);
