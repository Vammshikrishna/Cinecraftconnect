-- Consolidated Migration: 15_notifications_rebuild.sql

-- =========================================================================
-- From original file: 49_user_push_tokens.sql
-- =========================================================================

-- Create user_push_tokens table
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_id TEXT,
    platform TEXT,
    active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
    ON public.user_push_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Migrate existing tokens from profiles
INSERT INTO public.user_push_tokens (user_id, token, platform, last_seen)
SELECT id, push_token, 'android', NOW()
FROM public.profiles
WHERE push_token IS NOT NULL
ON CONFLICT (user_id, token) DO NOTHING;

-- Create function to update last_seen
CREATE OR REPLACE FUNCTION update_token_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_push_tokens_last_seen
    BEFORE UPDATE ON public.user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_token_last_seen();


-- =========================================================================
-- From original file: 50_push_delivery_trigger.sql
-- =========================================================================

-- Create a generic function to call push-delivery edge function
CREATE OR REPLACE FUNCTION trigger_push_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/push-delivery',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
        ),
        body := jsonb_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', row_to_json(NEW)
        )
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors to prevent blocking the transaction
    RETURN NEW;
END;
$$;

-- Trigger on direct_messages
DROP TRIGGER IF EXISTS direct_messages_push_delivery ON public.direct_messages;
CREATE TRIGGER direct_messages_push_delivery
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_push_delivery();

-- Trigger on room_messages
DROP TRIGGER IF EXISTS room_messages_push_delivery ON public.room_messages;
CREATE TRIGGER room_messages_push_delivery
    AFTER INSERT ON public.room_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_push_delivery();

-- Trigger on project_space_messages
DROP TRIGGER IF EXISTS project_space_messages_push_delivery ON public.project_space_messages;
CREATE TRIGGER project_space_messages_push_delivery
    AFTER INSERT ON public.project_space_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_push_delivery();


-- =========================================================================
-- From original file: 51_drop_legacy_notifications.sql
-- =========================================================================

-- Drop old notifications table and related functions/triggers
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.notification_history CASCADE;
DROP TABLE IF EXISTS public.notification_grouping CASCADE;
DROP TABLE IF EXISTS public.notification_summaries CASCADE;

-- Also remove legacy notification-related triggers or functions
DROP FUNCTION IF EXISTS update_notification_last_seen() CASCADE;
-- Any other known legacy functions can be dropped here


-- =========================================================================
-- From original file: 52_recreate_notifications_table.sql
-- =========================================================================

-- 1. Recreate the optimized central notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trigger_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'social', 'lifecycle', 'moderation'
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    related_id uuid, -- Reference to the post, comment, or chat
    is_read boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- 2. Add Postgres trigger to automatically create a notification when a post is liked
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
    post_author uuid;
    post_content text;
    trigger_name text;
BEGIN
    -- Get post author and content
    SELECT author_id, content INTO post_author, post_content FROM public.posts WHERE id = NEW.post_id;
    
    -- Don't notify if liking own post
    IF post_author = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get trigger user name
    SELECT full_name INTO trigger_name FROM public.profiles WHERE id = NEW.user_id;

    -- Insert central notification
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        post_author, 
        NEW.user_id, 
        'social', 
        trigger_name || ' liked your post', 
        '"' || substring(post_content from 1 for 40) || '..."', 
        '/feed', 
        NEW.post_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS post_like_notification ON public.post_likes;
CREATE TRIGGER post_like_notification
    AFTER INSERT ON public.post_likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_post_like();

-- 3. Add Postgres trigger for post comments
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
    post_author uuid;
    trigger_name text;
BEGIN
    SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
    
    IF post_author = NEW.user_id THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO trigger_name FROM public.profiles WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        post_author, 
        NEW.user_id, 
        'social', 
        trigger_name || ' commented on your post', 
        NEW.content, 
        '/feed', 
        NEW.post_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS post_comment_notification ON public.post_comments;
CREATE TRIGGER post_comment_notification
    AFTER INSERT ON public.post_comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_post_comment();


