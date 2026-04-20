-- Create project_space_bookmarks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_space_bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, project_space_id)
);

-- Enable RLS
ALTER TABLE public.project_space_bookmarks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Anyone can view bookmarks" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can create their own bookmarks" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.project_space_bookmarks;

-- Create RLS policies
-- Allow anyone to view bookmarks (needed for the left join to work)
CREATE POLICY "Anyone can view bookmarks" 
ON public.project_space_bookmarks 
FOR SELECT 
USING (true);

-- Users can only insert their own bookmarks
CREATE POLICY "Users can create their own bookmarks" 
ON public.project_space_bookmarks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks" 
ON public.project_space_bookmarks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_space_bookmarks_user_id 
ON public.project_space_bookmarks(user_id);

CREATE INDEX IF NOT EXISTS idx_project_space_bookmarks_project_space_id 
ON public.project_space_bookmarks(project_space_id);
