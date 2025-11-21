-- ULTIMATE FIX - Ensures schema matches frontend expectations and RLS works
-- This migration verifies all required columns exist and sets proper RLS policies

-- ============================================================================
-- 1. ENSURE PROJECT_SPACES HAS ALL REQUIRED COLUMNS
-- ============================================================================

-- Add columns if they don't exist (from 20240731000012_add_project_space_details.sql)
ALTER TABLE public.project_spaces
ADD COLUMN IF NOT EXISTS status TEXT, 
ADD COLUMN IF NOT EXISTS location TEXT, 
ADD COLUMN IF NOT EXISTS genre TEXT[], 
ADD COLUMN IF NOT EXISTS required_roles TEXT[],
ADD COLUMN IF NOT EXISTS budget_min NUMERIC, 
ADD COLUMN IF NOT EXISTS budget_max NUMERIC, 
ADD COLUMN IF NOT EXISTS start_date DATE, 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- ============================================================================
-- 2. SET SIMPLE, PERMISSIVE RLS POLICIES FOR PROJECT_SPACES
-- ============================================================================

ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Project creators can update their own projects." ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_public_read" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_authenticated_create" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_creator_update" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_creator_delete" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_select_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_insert_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_update_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_delete_policy" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can view all public project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can update their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can delete their own project_spaces" ON public.project_spaces;

-- Create ONE set of simple policies
CREATE POLICY "allow_all_select" ON public.project_spaces
    FOR SELECT USING (true);

CREATE POLICY "allow_authenticated_insert" ON public.project_spaces
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = creator_id);

CREATE POLICY "allow_creator_update" ON public.project_spaces
    FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "allow_creator_delete" ON public.project_spaces
    FOR DELETE USING (auth.uid() = creator_id);

-- ============================================================================
-- 3. FIX PROJECT_SPACE_BOOKMARKS RLS
-- ============================================================================

ALTER TABLE public.project_space_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookmarks." ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can create bookmarks." ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks." ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "bookmarks_user_manage" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "bookmarks_select_policy" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_policy" ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_policy" ON public.project_space_bookmarks;

CREATE POLICY "allow_user_view_bookmarks" ON public.project_space_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "allow_user_create_bookmarks" ON public.project_space_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_user_delete_bookmarks" ON public.project_space_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. FIX PROJECT_SPACE_CATEGORIES RLS
-- ============================================================================

ALTER TABLE public.project_space_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_categories_select_policy" ON public.project_space_categories;
DROP POLICY IF EXISTS "project_categories_public_read" ON public.project_space_categories;

CREATE POLICY "allow_all_view_categories" ON public.project_space_categories
    FOR SELECT USING (true);

-- ============================================================================
-- 5. FIX PROJECT_SPACE_MEMBERS RLS
-- ============================================================================

ALTER TABLE public.project_space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_public_read" ON public.project_space_members;
DROP POLICY IF EXISTS "project_members_creator_manage" ON public.project_space_members;
DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_space_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_space_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON public.project_space_members;

CREATE POLICY "allow_all_view_members" ON public.project_space_members
    FOR SELECT USING (true);

CREATE POLICY "allow_creator_manage_members" ON public.project_space_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id = project_space_id 
            AND creator_id = auth.uid()
        )
    );

-- ============================================================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_spaces_creator ON public.project_spaces(creator_id);
CREATE INDEX IF NOT EXISTS idx_project_spaces_created_at ON public.project_spaces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_spaces_status ON public.project_spaces(status);
CREATE INDEX IF NOT EXISTS idx_project_bookmarks_user ON public.project_space_bookmarks(user_id);
