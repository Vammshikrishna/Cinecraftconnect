-- Targeted fix for Feed and Post Upload issues
-- This ensures posts and profiles tables have correct RLS policies

-- ============================================================================
-- POSTS TABLE - Ensure proper policies for feed and post creation
-- ============================================================================

-- Enable RLS on posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on posts
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;

-- Create new simple policies for posts
CREATE POLICY "posts_public_read" ON public.posts
    FOR SELECT USING (true);

CREATE POLICY "posts_authenticated_create" ON public.posts
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = author_id
    );

CREATE POLICY "posts_author_update" ON public.posts
    FOR UPDATE USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_author_delete" ON public.posts
    FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- PROFILES TABLE - Ensure public viewing for feed
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- Create new simple policies for profiles
CREATE POLICY "profiles_public_read" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "profiles_user_insert" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_user_update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- ENSURE FOREIGN KEY EXISTS
-- ============================================================================

-- Ensure foreign key from posts.author_id to profiles.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'posts_author_id_fkey'
        AND table_name = 'posts'
    ) THEN
        ALTER TABLE public.posts 
        ADD CONSTRAINT posts_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- LIKES TABLE - For post interactions
-- ============================================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'likes') THEN
        EXECUTE 'ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "likes_public_read" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_public_read" ON public.likes FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "likes_user_create" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_user_create" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "likes_user_delete" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_user_delete" ON public.likes FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- COMMENTS TABLE - For post interactions
-- ============================================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments') THEN
        EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_public_read" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_user_create" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_user_create" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_user_update" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_user_update" ON public.comments FOR UPDATE USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_user_delete" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_user_delete" ON public.comments FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- SHARES TABLE - For post interactions
-- ============================================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shares') THEN
        EXECUTE 'ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "shares_public_read" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_public_read" ON public.shares FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "shares_user_create" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_user_create" ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "shares_user_delete" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_user_delete" ON public.shares FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
