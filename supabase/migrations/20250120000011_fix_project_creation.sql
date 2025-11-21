-- Fix project creation errors
-- Ensures project_spaces table has proper RLS policies for creation

-- Enable RLS
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "project_spaces_select_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_insert_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_update_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_delete_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can view all public project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can update their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can delete their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Public can view project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Project creators can update their own projects." ON public.project_spaces;

-- Create simple, working policies
CREATE POLICY "project_spaces_public_read" ON public.project_spaces
    FOR SELECT USING (true);

CREATE POLICY "project_spaces_authenticated_create" ON public.project_spaces
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = creator_id
    );

CREATE POLICY "project_spaces_creator_update" ON public.project_spaces
    FOR UPDATE USING (auth.uid() = creator_id)
    WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "project_spaces_creator_delete" ON public.project_spaces
    FOR DELETE USING (auth.uid() = creator_id);

-- Ensure project_space_categories has policies
ALTER TABLE public.project_space_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_categories_select_policy" ON public.project_space_categories;
DROP POLICY IF EXISTS "project_categories_insert_policy" ON public.project_space_categories;

CREATE POLICY "project_categories_public_read" ON public.project_space_categories
    FOR SELECT USING (true);

CREATE POLICY "project_categories_authenticated_create" ON public.project_space_categories
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
