-- Fix project_spaces RLS policies
-- Allow authenticated users to create project spaces for their own projects

-- Enable RLS if not already enabled
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project spaces for their projects" ON public.project_spaces;
DROP POLICY IF EXISTS "Project creators can update their project spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Project creators can delete their project spaces" ON public.project_spaces;

-- Allow everyone to view project spaces (for public projects)
CREATE POLICY "Users can view project spaces"
ON public.project_spaces
FOR SELECT
USING (true);

-- Allow users to create project spaces for projects they created
CREATE POLICY "Users can create project spaces for their projects"
ON public.project_spaces
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_spaces.project_id
    AND projects.creator_id = auth.uid()
  )
);

-- Allow project creators to update their project spaces
CREATE POLICY "Project creators can update their project spaces"
ON public.project_spaces
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_spaces.project_id
    AND projects.creator_id = auth.uid()
  )
);

-- Allow project creators to delete their project spaces
CREATE POLICY "Project creators can delete their project spaces"
ON public.project_spaces
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_spaces.project_id
    AND projects.creator_id = auth.uid()
  )
);
