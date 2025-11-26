-- ============================================================================
-- SECURE RLS POLICIES FOR PROJECTS
-- ============================================================================
-- This migration replaces permissive development policies with strict security
-- ============================================================================

-- 1. Helper Function to check membership
-- This improves performance and readability of policies
CREATE OR REPLACE FUNCTION public.is_project_member(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_space_members 
    WHERE project_space_id = project_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_project_creator(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_spaces 
    WHERE id = project_id 
    AND creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROJECT SPACES
-- ============================================================================

-- Drop insecure policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_spaces;
DROP POLICY IF EXISTS "Anyone can view project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Authenticated users can create project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can update their project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can delete their project spaces" ON public.project_spaces;

-- 1. VIEW: Public projects are visible to everyone. Private/Secret only to members/creator.
CREATE POLICY "View Projects" ON public.project_spaces
FOR SELECT USING (
  project_space_type = 'public' 
  OR auth.uid() = creator_id 
  OR public.is_project_member(id)
);

-- 2. CREATE: Any authenticated user can create a project
CREATE POLICY "Create Projects" ON public.project_spaces
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND auth.uid() = creator_id
);

-- 3. UPDATE: Only the Creator can update
CREATE POLICY "Update Projects" ON public.project_spaces
FOR UPDATE USING (
  auth.uid() = creator_id
);

-- 4. DELETE: Only the Creator can delete
CREATE POLICY "Delete Projects" ON public.project_spaces
FOR DELETE USING (
  auth.uid() = creator_id
);

-- ============================================================================
-- PROJECT MEMBERS
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_members;
DROP POLICY IF EXISTS "Anyone can view project members" ON public.project_space_members;
DROP POLICY IF EXISTS "Creators can manage members" ON public.project_space_members;
DROP POLICY IF EXISTS "Users can join/leave" ON public.project_space_members;

-- 1. VIEW: Members can see other members in their projects
CREATE POLICY "View Members" ON public.project_space_members
FOR SELECT USING (
  public.is_project_member(project_space_id) 
  OR public.is_project_creator(project_space_id)
);

-- 2. ADD MEMBERS: Only Creator can add members (Invite system usually handles this, but direct insert needs protection)
CREATE POLICY "Add Members" ON public.project_space_members
FOR INSERT WITH CHECK (
  public.is_project_creator(project_space_id)
  OR user_id = auth.uid() -- Allow self-join if logic permits (usually handled via requests)
);

-- 3. REMOVE MEMBERS: Creator can remove anyone. Users can remove themselves (leave).
CREATE POLICY "Remove Members" ON public.project_space_members
FOR DELETE USING (
  public.is_project_creator(project_space_id) 
  OR user_id = auth.uid()
);

-- ============================================================================
-- PROJECT ASSETS (Tasks, Files, Call Sheets, etc.)
-- ============================================================================

-- Helper macro for asset tables
-- We'll apply the same logic to all sub-tables: Members & Creator can View/Edit

-- TASKS
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.tasks;
CREATE POLICY "View Tasks" ON public.tasks FOR SELECT USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));
CREATE POLICY "Manage Tasks" ON public.tasks FOR ALL USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));

-- FILES (Database Record)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.files;
CREATE POLICY "View Files" ON public.files FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Files" ON public.files FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- CALL SHEETS
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.call_sheets;
CREATE POLICY "View Call Sheets" ON public.call_sheets FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Call Sheets" ON public.call_sheets FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- SHOT LIST
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.shot_list;
CREATE POLICY "View Shot List" ON public.shot_list FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Shot List" ON public.shot_list FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- LEGAL DOCS
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.legal_docs;
CREATE POLICY "View Legal Docs" ON public.legal_docs FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Legal Docs" ON public.legal_docs FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- PROJECT MESSAGES
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_messages;
CREATE POLICY "View Project Messages" ON public.project_messages FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Send Project Messages" ON public.project_messages FOR INSERT WITH CHECK (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- ============================================================================
-- STORAGE BUCKETS (Fixing the upload error)
-- ============================================================================
-- Ensure the 'project-files' bucket exists and has policies

INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Project Members Read" ON storage.objects;
DROP POLICY IF EXISTS "Project Members Upload" ON storage.objects;
DROP POLICY IF EXISTS "Project Members Delete" ON storage.objects;

-- Note: Storage policies are tricky because they don't easily join with public tables.
-- We often use a folder structure like "project_id/filename" to validate.
-- For now, we will allow authenticated users to upload, but rely on the database 'files' table for strict access control.

CREATE POLICY "Authenticated Read Project Files" ON storage.objects FOR SELECT USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Upload Project Files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-files' AND auth.role() = 'authenticated');
CREATE POLICY "Creator Delete Project Files" ON storage.objects FOR DELETE USING (bucket_id = 'project-files' AND owner = auth.uid());

