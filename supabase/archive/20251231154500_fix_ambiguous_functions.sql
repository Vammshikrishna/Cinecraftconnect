-- Fix for "column reference 'project_id' is ambiguous" error AND faulty creator check.
-- 1. Drop functions and cascade to policies
DROP FUNCTION IF EXISTS public.is_project_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_project_creator(uuid) CASCADE;

-- 2. Re-create functions 
-- FIXED: check project_space_members correctly
CREATE OR REPLACE FUNCTION public.is_project_member(_project_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_space_members 
    WHERE project_space_id = _project_space_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIXED: Project Creator is on the PARENT 'projects' table, not 'project_spaces'
CREATE OR REPLACE FUNCTION public.is_project_creator(_project_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_spaces ps
    JOIN public.projects p ON ps.project_id = p.id
    WHERE ps.id = _project_space_id 
    AND p.creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Re-create the Policies dropped by CASCADE

-- PROJECT SPACES
CREATE POLICY "View Projects" ON public.project_spaces
FOR SELECT USING (
  -- Removed project_space_type logic as it might not be consistent, rely on membership/creator
  auth.uid() IN (
      SELECT creator_id FROM public.projects WHERE id = project_spaces.project_id
  )
  OR public.is_project_member(id)
);

-- PROJECT MEMBERS
CREATE POLICY "View Members" ON public.project_space_members
FOR SELECT USING (
  public.is_project_member(project_space_id) 
  OR public.is_project_creator(project_space_id)
);

CREATE POLICY "Add Members" ON public.project_space_members
FOR INSERT WITH CHECK (
  public.is_project_creator(project_space_id)
  OR user_id = auth.uid() -- Allow self-join? (optional, keep if desired)
);

CREATE POLICY "Remove Members" ON public.project_space_members
FOR DELETE USING (
  public.is_project_creator(project_space_id) 
  OR user_id = auth.uid()
);

-- TASKS
CREATE POLICY "View Tasks" ON public.tasks FOR SELECT USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));
CREATE POLICY "Manage Tasks" ON public.tasks FOR ALL USING (public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id));

-- FILES
CREATE POLICY "View Files" ON public.files FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Files" ON public.files FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- CALL SHEETS
CREATE POLICY "View Call Sheets" ON public.call_sheets FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Call Sheets" ON public.call_sheets FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- SHOT LIST
CREATE POLICY "View Shot List" ON public.shot_list FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Shot List" ON public.shot_list FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- LEGAL DOCS
CREATE POLICY "View Legal Docs" ON public.legal_docs FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Manage Legal Docs" ON public.legal_docs FOR ALL USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));

-- PROJECT MESSAGES
CREATE POLICY "View Project Messages" ON public.project_messages FOR SELECT USING (public.is_project_member(project_id) OR public.is_project_creator(project_id));
CREATE POLICY "Send Project Messages" ON public.project_messages FOR INSERT WITH CHECK (public.is_project_member(project_id) OR public.is_project_creator(project_id));
