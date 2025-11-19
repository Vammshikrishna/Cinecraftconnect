-- 20240731000012_add_project_space_details.sql

-- Add new columns to project_spaces
ALTER TABLE public.project_spaces
ADD COLUMN IF NOT EXISTS status TEXT, 
ADD COLUMN IF NOT EXISTS location TEXT, 
ADD COLUMN IF NOT EXISTS genre TEXT[], 
ADD COLUMN IF NOT EXISTS required_roles TEXT[],
ADD COLUMN IF NOT EXISTS budget_min NUMERIC, 
ADD COLUMN IF NOT EXISTS budget_max NUMERIC, 
ADD COLUMN IF NOT EXISTS start_date DATE, 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Create the project_space_bookmarks table
CREATE TABLE IF NOT EXISTS public.project_space_bookmarks (
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (project_space_id, user_id)
);

-- RLS for project_spaces
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project spaces." ON public.project_spaces;
CREATE POLICY "Public can view project spaces." ON public.project_spaces
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create project spaces." ON public.project_spaces;
CREATE POLICY "Users can create project spaces." ON public.project_spaces
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Project creators can update their own projects." ON public.project_spaces;
CREATE POLICY "Project creators can update their own projects." ON public.project_spaces
  FOR UPDATE USING (auth.uid() = creator_id);

-- RLS for project_space_bookmarks
ALTER TABLE public.project_space_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookmarks." ON public.project_space_bookmarks;
CREATE POLICY "Users can view their own bookmarks." ON public.project_space_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create bookmarks." ON public.project_space_bookmarks;
CREATE POLICY "Users can create bookmarks." ON public.project_space_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookmarks." ON public.project_space_bookmarks;
CREATE POLICY "Users can delete their own bookmarks." ON public.project_space_bookmarks
  FOR DELETE USING (auth.uid() = user_id);
