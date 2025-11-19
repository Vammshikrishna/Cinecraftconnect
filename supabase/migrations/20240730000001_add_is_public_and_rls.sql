-- 20240730000001_add_is_public_and_rls.sql

-- Add the is_public column if it doesn't exist
ALTER TABLE public.project_spaces
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Enable RLS for the project_spaces table
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow users to see their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can view public project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can view private project_spaces they are members of" ON public.project_spaces;


-- Create the final, consolidated policy
CREATE POLICY "Allow public and member access to project_spaces" ON public.project_spaces FOR SELECT 
USING (
  is_public = true OR 
  EXISTS (SELECT 1 FROM project_space_members pm WHERE pm.project_space_id = project_spaces.id AND pm.user_id = auth.uid()::uuid)
);
