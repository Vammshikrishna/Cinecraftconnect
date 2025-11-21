-- Add missing RLS policies for tables that have RLS enabled but no policies

-- ============================================================================
-- PROJECT_SPACE_CATEGORIES - Missing policies (causing "No policies created yet" error)
-- ============================================================================
DROP POLICY IF EXISTS "project_categories_select_policy" ON public.project_space_categories;
CREATE POLICY "project_categories_select_policy" ON public.project_space_categories
    FOR SELECT USING (true);

-- Allow authenticated users to suggest new categories (optional)
DROP POLICY IF EXISTS "project_categories_insert_policy" ON public.project_space_categories;
CREATE POLICY "project_categories_insert_policy" ON public.project_space_categories
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- ROOM_CATEGORIES - Ensure public viewing
-- ============================================================================
DROP POLICY IF EXISTS "Public can view room categories." ON public.room_categories;
DROP POLICY IF EXISTS "room_categories_select_policy" ON public.room_categories;
CREATE POLICY "room_categories_select_policy" ON public.room_categories
    FOR SELECT USING (true);

-- ============================================================================
-- LIKES TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'likes') THEN
        EXECUTE 'DROP POLICY IF EXISTS "likes_select_policy" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_select_policy" ON public.likes FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "likes_insert_policy" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_insert_policy" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "likes_delete_policy" ON public.likes';
        EXECUTE 'CREATE POLICY "likes_delete_policy" ON public.likes FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- COMMENTS TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments') THEN
        EXECUTE 'DROP POLICY IF EXISTS "comments_select_policy" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_select_policy" ON public.comments FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_insert_policy" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_update_policy" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_update_policy" ON public.comments FOR UPDATE USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "comments_delete_policy" ON public.comments';
        EXECUTE 'CREATE POLICY "comments_delete_policy" ON public.comments FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- SHARES TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shares') THEN
        EXECUTE 'DROP POLICY IF EXISTS "shares_select_policy" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_select_policy" ON public.shares FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "shares_insert_policy" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_insert_policy" ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "shares_delete_policy" ON public.shares';
        EXECUTE 'CREATE POLICY "shares_delete_policy" ON public.shares FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        EXECUTE 'DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications';
        EXECUTE 'CREATE POLICY "notifications_select_policy" ON public.notifications FOR SELECT USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications';
        EXECUTE 'CREATE POLICY "notifications_insert_policy" ON public.notifications FOR INSERT WITH CHECK (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications';
        EXECUTE 'CREATE POLICY "notifications_update_policy" ON public.notifications FOR UPDATE USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications';
        EXECUTE 'CREATE POLICY "notifications_delete_policy" ON public.notifications FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- MESSAGE_READ_STATUS TABLE
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_read_status') THEN
        EXECUTE 'DROP POLICY IF EXISTS "message_read_status_select_policy" ON public.message_read_status';
        EXECUTE 'CREATE POLICY "message_read_status_select_policy" ON public.message_read_status FOR SELECT USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "message_read_status_insert_policy" ON public.message_read_status';
        EXECUTE 'CREATE POLICY "message_read_status_insert_policy" ON public.message_read_status FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "message_read_status_update_policy" ON public.message_read_status';
        EXECUTE 'CREATE POLICY "message_read_status_update_policy" ON public.message_read_status FOR UPDATE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- USER_SKILLS TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_skills') THEN
        EXECUTE 'DROP POLICY IF EXISTS "user_skills_select_policy" ON public.user_skills';
        EXECUTE 'CREATE POLICY "user_skills_select_policy" ON public.user_skills FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "user_skills_insert_policy" ON public.user_skills';
        EXECUTE 'CREATE POLICY "user_skills_insert_policy" ON public.user_skills FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "user_skills_delete_policy" ON public.user_skills';
        EXECUTE 'CREATE POLICY "user_skills_delete_policy" ON public.user_skills FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- USER_EXPERIENCE TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_experience') THEN
        EXECUTE 'DROP POLICY IF EXISTS "user_experience_select_policy" ON public.user_experience';
        EXECUTE 'CREATE POLICY "user_experience_select_policy" ON public.user_experience FOR SELECT USING (true)';
        
        EXECUTE 'DROP POLICY IF EXISTS "user_experience_insert_policy" ON public.user_experience';
        EXECUTE 'CREATE POLICY "user_experience_insert_policy" ON public.user_experience FOR INSERT WITH CHECK (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "user_experience_update_policy" ON public.user_experience';
        EXECUTE 'CREATE POLICY "user_experience_update_policy" ON public.user_experience FOR UPDATE USING (auth.uid() = user_id)';
        
        EXECUTE 'DROP POLICY IF EXISTS "user_experience_delete_policy" ON public.user_experience';
        EXECUTE 'CREATE POLICY "user_experience_delete_policy" ON public.user_experience FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ============================================================================
-- PROJECT_SPACE_MESSAGES TABLE (if exists)
-- ============================================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_space_messages') THEN
        EXECUTE 'DROP POLICY IF EXISTS "project_messages_select_policy" ON public.project_space_messages';
        EXECUTE 'CREATE POLICY "project_messages_select_policy" ON public.project_space_messages 
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.project_space_members 
                    WHERE project_space_id = project_space_messages.project_space_id 
                    AND user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.project_spaces 
                    WHERE id = project_space_messages.project_space_id 
                    AND creator_id = auth.uid()
                )
            )';
        
        EXECUTE 'DROP POLICY IF EXISTS "project_messages_insert_policy" ON public.project_space_messages';
        EXECUTE 'CREATE POLICY "project_messages_insert_policy" ON public.project_space_messages 
            FOR INSERT WITH CHECK (
                auth.uid() = user_id 
                AND (
                    EXISTS (
                        SELECT 1 FROM public.project_space_members 
                        WHERE project_space_id = project_space_messages.project_space_id 
                        AND user_id = auth.uid()
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.project_spaces 
                        WHERE id = project_space_messages.project_space_id 
                        AND creator_id = auth.uid()
                    )
                )
            )';
        
        EXECUTE 'DROP POLICY IF EXISTS "project_messages_delete_policy" ON public.project_space_messages';
        EXECUTE 'CREATE POLICY "project_messages_delete_policy" ON public.project_space_messages 
            FOR DELETE USING (auth.uid() = user_id)';
    END IF;
END $$;
