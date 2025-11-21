-- Comprehensive RLS Policy Fix - Addresses all remaining issues
-- Run this if errors persist after previous migrations

-- CRITICAL: First, let's ensure RLS is enabled on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_space_bookmarks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POSTS TABLE - Complete policy reset
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.posts;

-- Allow everyone to view posts (public feed)
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
CREATE POLICY "posts_select_policy" ON public.posts
    FOR SELECT USING (true);

-- Allow authenticated users to insert posts
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
CREATE POLICY "posts_insert_policy" ON public.posts
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = author_id
    );

-- Allow authors to update their posts
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
CREATE POLICY "posts_update_policy" ON public.posts
    FOR UPDATE USING (auth.uid() = author_id);

-- Allow authors to delete their posts  
DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;
CREATE POLICY "posts_delete_policy" ON public.posts
    FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- PROFILES TABLE - Allow public viewing
-- ============================================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- PROJECT_SPACES TABLE - Fix viewing and creation
-- ============================================================================
DROP POLICY IF EXISTS "Users can view all public project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can update their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Creators can delete their own project_spaces" ON public.project_spaces;
DROP POLICY IF EXISTS "Users can view private project_spaces they are members of" ON public.project_spaces;
DROP POLICY IF EXISTS "Public can view project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Users can create project spaces." ON public.project_spaces;
DROP POLICY IF EXISTS "Project creators can update their own projects." ON public.project_spaces;

-- Single comprehensive SELECT policy
DROP POLICY IF EXISTS "project_spaces_select_policy" ON public.project_spaces;
CREATE POLICY "project_spaces_select_policy" ON public.project_spaces
    FOR SELECT USING (
        project_space_type = 'public'
        OR creator_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_space_members 
            WHERE project_space_id = project_spaces.id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "project_spaces_insert_policy" ON public.project_spaces;
CREATE POLICY "project_spaces_insert_policy" ON public.project_spaces
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "project_spaces_update_policy" ON public.project_spaces;
CREATE POLICY "project_spaces_update_policy" ON public.project_spaces
    FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "project_spaces_delete_policy" ON public.project_spaces;
CREATE POLICY "project_spaces_delete_policy" ON public.project_spaces
    FOR DELETE USING (auth.uid() = creator_id);

-- ============================================================================
-- PROJECT_SPACE_MEMBERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view members of project_spaces they are in" ON public.project_space_members;
DROP POLICY IF EXISTS "Project_space creators can add members" ON public.project_space_members;
DROP POLICY IF EXISTS "Users can leave project_spaces" ON public.project_space_members;

DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_space_members;
CREATE POLICY "project_members_select_policy" ON public.project_space_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id = project_space_id 
            AND (creator_id = auth.uid() OR project_space_type = 'public')
        )
    );

DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_space_members;
CREATE POLICY "project_members_insert_policy" ON public.project_space_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id = project_space_id 
            AND creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "project_members_delete_policy" ON public.project_space_members;
CREATE POLICY "project_members_delete_policy" ON public.project_space_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id = project_space_id 
            AND creator_id = auth.uid()
        )
    );

-- ============================================================================
-- DISCUSSION_ROOMS TABLE - Fix infinite recursion
-- ============================================================================
DROP POLICY IF EXISTS "Users can create discussion rooms." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Users can view public discussion rooms." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Users can view private discussion rooms they are a member of." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Room creators can update their own rooms." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Room creators can delete their own rooms." ON public.discussion_rooms;
DROP POLICY IF EXISTS "Users can view discussion rooms" ON public.discussion_rooms;

DROP POLICY IF EXISTS "discussion_rooms_select_policy" ON public.discussion_rooms;
CREATE POLICY "discussion_rooms_select_policy" ON public.discussion_rooms
    FOR SELECT USING (
        is_public = true
        OR creator_id = auth.uid()
    );

DROP POLICY IF EXISTS "discussion_rooms_insert_policy" ON public.discussion_rooms;
CREATE POLICY "discussion_rooms_insert_policy" ON public.discussion_rooms
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "discussion_rooms_update_policy" ON public.discussion_rooms;
CREATE POLICY "discussion_rooms_update_policy" ON public.discussion_rooms
    FOR UPDATE USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "discussion_rooms_delete_policy" ON public.discussion_rooms;
CREATE POLICY "discussion_rooms_delete_policy" ON public.discussion_rooms
    FOR DELETE USING (creator_id = auth.uid());

-- ============================================================================
-- ROOM_MEMBERS TABLE - Fix infinite recursion (CRITICAL)
-- ============================================================================
DROP POLICY IF EXISTS "Users can see the members of rooms they are in." ON public.room_members;
DROP POLICY IF EXISTS "Users can join and leave rooms." ON public.room_members;

-- Simple policy: users can see members of public rooms or rooms they created
DROP POLICY IF EXISTS "room_members_select_policy" ON public.room_members;
CREATE POLICY "room_members_select_policy" ON public.room_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.discussion_rooms 
            WHERE id = room_members.room_id 
            AND (is_public = true OR creator_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "room_members_insert_policy" ON public.room_members;
CREATE POLICY "room_members_insert_policy" ON public.room_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "room_members_delete_policy" ON public.room_members;
CREATE POLICY "room_members_delete_policy" ON public.room_members
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- ROOM_MESSAGES TABLE - Simplified policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view messages in rooms they are members of" ON public.room_messages;
DROP POLICY IF EXISTS "Users can view messages in rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Users can insert messages in rooms they are members of" ON public.room_messages;
DROP POLICY IF EXISTS "Users can insert messages in rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.room_messages;

-- Allow viewing messages in public rooms or rooms user created
DROP POLICY IF EXISTS "room_messages_select_policy" ON public.room_messages;
CREATE POLICY "room_messages_select_policy" ON public.room_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.discussion_rooms 
            WHERE id = room_messages.room_id 
            AND (is_public = true OR creator_id = auth.uid())
        )
    );

-- Allow inserting messages in public rooms or rooms user created
DROP POLICY IF EXISTS "room_messages_insert_policy" ON public.room_messages;
CREATE POLICY "room_messages_insert_policy" ON public.room_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.discussion_rooms 
            WHERE id = room_messages.room_id 
            AND (is_public = true OR creator_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "room_messages_delete_policy" ON public.room_messages;
CREATE POLICY "room_messages_delete_policy" ON public.room_messages
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PROJECT_SPACE_BOOKMARKS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own bookmarks." ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can create bookmarks." ON public.project_space_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks." ON public.project_space_bookmarks;

DROP POLICY IF EXISTS "bookmarks_select_policy" ON public.project_space_bookmarks;
CREATE POLICY "bookmarks_select_policy" ON public.project_space_bookmarks
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_insert_policy" ON public.project_space_bookmarks;
CREATE POLICY "bookmarks_insert_policy" ON public.project_space_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_delete_policy" ON public.project_space_bookmarks;
CREATE POLICY "bookmarks_delete_policy" ON public.project_space_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_creator_id ON public.discussion_rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_is_public ON public.discussion_rooms(is_public);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_project_spaces_creator_id ON public.project_spaces(creator_id);
CREATE INDEX IF NOT EXISTS idx_project_spaces_type ON public.project_spaces(project_space_type);
