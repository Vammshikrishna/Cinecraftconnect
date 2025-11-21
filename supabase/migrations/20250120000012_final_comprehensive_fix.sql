-- FINAL COMPREHENSIVE RLS FIX - Apply this single migration
-- This consolidates all fixes into one migration for simplicity

-- ============================================================================
-- 1. POSTS & PROFILES (Feed)
-- ============================================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_public_read" ON public.posts;
DROP POLICY IF EXISTS "posts_authenticated_create" ON public.posts;
DROP POLICY IF EXISTS "posts_author_update" ON public.posts;
DROP POLICY IF EXISTS "posts_author_delete" ON public.posts;

CREATE POLICY "posts_public_read" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_authenticated_create" ON public.posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = author_id);
CREATE POLICY "posts_author_update" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_author_delete" ON public.posts FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_user_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_user_update" ON public.profiles;

CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_user_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_user_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- 2. PROJECT_SPACES & CATEGORIES (Projects)
-- ============================================================================
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_spaces_public_read" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_authenticated_create" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_creator_update" ON public.project_spaces;
DROP POLICY IF EXISTS "project_spaces_creator_delete" ON public.project_spaces;

CREATE POLICY "project_spaces_public_read" ON public.project_spaces FOR SELECT USING (true);
CREATE POLICY "project_spaces_authenticated_create" ON public.project_spaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = creator_id);
CREATE POLICY "project_spaces_creator_update" ON public.project_spaces FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "project_spaces_creator_delete" ON public.project_spaces FOR DELETE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "project_categories_public_read" ON public.project_space_categories;
CREATE POLICY "project_categories_public_read" ON public.project_space_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "project_members_public_read" ON public.project_space_members;
DROP POLICY IF EXISTS "project_members_creator_manage" ON public.project_space_members;

CREATE POLICY "project_members_public_read" ON public.project_space_members FOR SELECT USING (true);
CREATE POLICY "project_members_creator_manage" ON public.project_space_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.project_spaces WHERE id = project_space_id AND creator_id = auth.uid())
);

DROP POLICY IF EXISTS "bookmarks_user_manage" ON public.project_space_bookmarks;
CREATE POLICY "bookmarks_user_manage" ON public.project_space_bookmarks FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. DISCUSSION_ROOMS & MESSAGES
-- ============================================================================
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discussion_rooms_public_read" ON public.discussion_rooms;
DROP POLICY IF EXISTS "discussion_rooms_authenticated_create" ON public.discussion_rooms;
DROP POLICY IF EXISTS "discussion_rooms_creator_manage" ON public.discussion_rooms;

CREATE POLICY "discussion_rooms_public_read" ON public.discussion_rooms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "discussion_rooms_authenticated_create" ON public.discussion_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "discussion_rooms_creator_manage" ON public.discussion_rooms FOR ALL USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "room_categories_public_read" ON public.room_categories;
CREATE POLICY "room_categories_public_read" ON public.room_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "room_members_public_read" ON public.room_members;
DROP POLICY IF EXISTS "room_members_user_manage" ON public.room_members;

CREATE POLICY "room_members_public_read" ON public.room_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "room_members_user_manage" ON public.room_members FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "room_messages_public_read" ON public.room_messages;
DROP POLICY IF EXISTS "room_messages_authenticated_create" ON public.room_messages;
DROP POLICY IF EXISTS "room_messages_user_delete" ON public.room_messages;

CREATE POLICY "room_messages_public_read" ON public.room_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "room_messages_authenticated_create" ON public.room_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_messages_user_delete" ON public.room_messages FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SUPPORTING TABLES
-- ============================================================================

-- Likes
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'likes') THEN
        EXECUTE 'ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "likes_public_read" ON public.likes';
        EXECUTE 'DROP POLICY IF EXISTS "likes_user_manage" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_public_read" ON public.likes FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "likes_user_manage" ON public.likes FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;

-- Comments
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'comments') THEN
        EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "comments_public_read" ON public.comments';
        EXECUTE 'DROP POLICY IF EXISTS "comments_user_manage" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "comments_user_manage" ON public.comments FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;

-- Shares
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'shares') THEN
        EXECUTE 'ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "shares_public_read" ON public.shares';
        EXECUTE 'DROP POLICY IF EXISTS "shares_user_manage" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_public_read" ON public.shares FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "shares_user_manage" ON public.shares FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;

-- Notifications
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
        EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_user_read" ON public.notifications';
        EXECUTE 'CREATE POLICY "notifications_user_read" ON public.notifications FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;
