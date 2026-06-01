-- 58_fix_notifications_triggers.sql
-- Migration to fix notifications triggers schema mismatch and drop duplicate/obsolete triggers.

-- 1. Drop duplicate/obsolete/broken triggers on post_likes and post_comments
DROP TRIGGER IF EXISTS on_like_notification ON public.post_likes;
DROP TRIGGER IF EXISTS update_post_like_count_on_insert ON public.post_likes;
DROP TRIGGER IF EXISTS update_post_like_count_on_delete ON public.post_likes;

DROP TRIGGER IF EXISTS on_comment_notification ON public.post_comments;
DROP TRIGGER IF EXISTS update_post_comment_count_on_insert ON public.post_comments;
DROP TRIGGER IF EXISTS update_post_comment_count_on_delete ON public.post_comments;

-- 2. Drop obsolete/broken trigger functions
DROP FUNCTION IF EXISTS public.handle_post_like_notification() CASCADE;
DROP FUNCTION IF EXISTS public.handle_post_comment_notification() CASCADE;
DROP FUNCTION IF EXISTS public.update_post_like_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_post_comment_count() CASCADE;

-- 3. Fix handle_follower_notification() to map trigger_user_id and remove related_type/priority
CREATE OR REPLACE FUNCTION public.handle_follower_notification()
RETURNS TRIGGER AS $$
DECLARE
    actor_name text;
BEGIN
    -- Get the name of the follower
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        NEW.following_id, 
        NEW.follower_id,
        'new_follower', 
        'New Connection', 
        actor_name || ' ' || (CASE WHEN NEW.status = 'pending' THEN 'wants to connect' ELSE 'is now connected' END), 
        '/network', 
        NEW.follower_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix handle_new_post_notification() to map trigger_user_id and remove related_type/priority
CREATE OR REPLACE FUNCTION public.handle_new_post_notification()
RETURNS TRIGGER AS $$
DECLARE
    actor_name text;
BEGIN
    -- Get the name of the author
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.author_id;

    -- Insert notifications for all followers
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    SELECT 
        uc.follower_id, 
        NEW.author_id,
        'new_post', 
        'New Post', 
        actor_name || ' shared a new post', 
        '/feed', 
        NEW.id
    FROM public.user_connections uc
    WHERE uc.following_id = NEW.author_id AND uc.status = 'accepted';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix handle_new_mention_notification() to map trigger_user_id (from actor_id) and remove related_type/priority
CREATE OR REPLACE FUNCTION public.handle_new_mention_notification()
RETURNS TRIGGER AS $$
DECLARE
    _mentioner_name TEXT;
    _page_url TEXT;
BEGIN
    -- Get Mentioner Name
    SELECT full_name INTO _mentioner_name FROM public.profiles WHERE id = NEW.mentioner_id;
    
    -- Set page URL based on related_type
    IF NEW.related_type = 'post' THEN
        _page_url := '/feed';
    ELSIF NEW.related_type = 'chat_message' THEN
        _page_url := '/messages';
    END IF;

    -- Insert into notifications
    INSERT INTO public.notifications (
        user_id, 
        trigger_user_id, 
        type, 
        title, 
        message, 
        related_id, 
        action_url
    )
    VALUES (
        NEW.mentioned_id, 
        NEW.mentioner_id, 
        'mention', 
        'New Mention', 
        COALESCE(_mentioner_name, 'Someone') || ' mentioned you in a ' || REPLACE(NEW.related_type, '_', ' ') || '.', 
        NEW.related_id, 
        _page_url
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix handle_mass_notifications() to map trigger_user_id (from actor_id) and remove related_type/priority
CREATE OR REPLACE FUNCTION public.handle_mass_notifications()
RETURNS TRIGGER AS $$
DECLARE
    _target_user_id UUID;
    _actor_id UUID;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _action_url TEXT;
BEGIN
    _actor_id := auth.uid();

    -- A. HANDLE NEW JOBS (Job Alerts)
    IF TG_TABLE_NAME = 'jobs' AND TG_OP = 'INSERT' THEN
        -- Notify users whose craft or bio matches the job title/description
        FOR _target_user_id IN 
            SELECT id FROM public.profiles 
            WHERE (craft IS NOT NULL AND (NEW.title ILIKE '%' || craft || '%' OR NEW.description ILIKE '%' || craft || '%'))
            OR (bio IS NOT NULL AND (bio ILIKE '%' || NEW.title || '%'))
        LOOP
            -- Don't notify the person who posted the job
            IF _target_user_id != NEW.posted_by THEN
                INSERT INTO public.notifications (
                    user_id, trigger_user_id, type, title, message, related_id, action_url
                ) VALUES (
                    _target_user_id, 
                    NEW.posted_by, 
                    'job_alert', 
                    'New Job Match!', 
                    'A new job "' || NEW.title || '" matches your profile.', 
                    NEW.id, 
                    '/jobs/' || NEW.id
                );
            END IF;
        END LOOP;

    -- B. HANDLE ANNOUNCEMENTS (Global)
    ELSIF TG_TABLE_NAME = 'announcements' AND TG_OP = 'INSERT' THEN
        -- Notify EVERYONE
        FOR _target_user_id IN SELECT id FROM public.profiles LOOP
            INSERT INTO public.notifications (
                user_id, trigger_user_id, type, title, message, related_id, action_url
            ) VALUES (
                _target_user_id, 
                NEW.author_id, 
                'system_announcement', 
                'Platform Announcement', 
                NEW.title, 
                NEW.id, 
                '/announcements'
            );
        END LOOP;

    -- C. HANDLE NETWORK SUGGESTIONS (On Profile Update)
    ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
        -- Only trigger if onboarding was just completed
        IF OLD.onboarding_completed = false AND NEW.onboarding_completed = true THEN
            FOR _target_user_id IN 
                SELECT id FROM public.profiles 
                WHERE id != NEW.id 
                AND (craft = NEW.craft OR location = NEW.location)
                LIMIT 5 -- Suggest up to 5 relevant people
            LOOP
                SELECT COALESCE(full_name, username) INTO _title FROM public.profiles WHERE id = _target_user_id;
                
                INSERT INTO public.notifications (
                    user_id, trigger_user_id, type, title, message, related_id, action_url
                ) VALUES (
                    NEW.id, 
                    _target_user_id, 
                    'network_suggestion', 
                    'Suggested Connection', 
                    'You might know ' || COALESCE(_title, 'this user') || ' who is also a ' || COALESCE(NEW.craft, 'creator') || '.', 
                    _target_user_id, 
                    '/profile/' || _target_user_id
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable Realtime for posts, post_likes, and post_comments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'post_likes') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
        END IF;
    END IF;
END $$;
