
-- social_notification_triggers.sql

-- 1. Like Trigger Function
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id uuid;
    actor_name text;
BEGIN
    -- Get the author of the post
    SELECT author_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Don't notify if user likes their own post or if post doesn't exist
    IF target_user_id IS NULL OR target_user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get the name of the person who liked
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id, related_type)
    VALUES (
        target_user_id, 
        'like', 
        'New Like', 
        actor_name || ' liked your post', 
        '/feed', 
        NEW.post_id, 
        'post'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Like Trigger to both possible tables
DROP TRIGGER IF EXISTS on_like_notification ON public.post_likes;
CREATE TRIGGER on_like_notification AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_notification();

DROP TRIGGER IF EXISTS on_like_notification_alt ON public.likes;
CREATE TRIGGER on_like_notification_alt AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_notification();


-- 2. Comment Trigger Function
CREATE OR REPLACE FUNCTION public.handle_post_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id uuid;
    actor_name text;
BEGIN
    -- Get the author of the post
    SELECT author_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Don't notify if user comments on their own post
    IF target_user_id IS NULL OR target_user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get the name of the person who commented
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id, related_type)
    VALUES (
        target_user_id, 
        'comment', 
        'New Comment', 
        actor_name || ' commented: "' || left(NEW.content, 50) || (CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END) || '"', 
        '/feed', 
        NEW.post_id, 
        'post'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Comment Trigger to both possible tables
DROP TRIGGER IF EXISTS on_comment_notification ON public.post_comments;
CREATE TRIGGER on_comment_notification AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_post_comment_notification();

DROP TRIGGER IF EXISTS on_comment_notification_alt ON public.comments;
CREATE TRIGGER on_comment_notification_alt AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.handle_post_comment_notification();


-- 3. Follower Trigger
CREATE OR REPLACE FUNCTION public.handle_follower_notification()
RETURNS TRIGGER AS $$
DECLARE
    actor_name text;
BEGIN
    -- Get the name of the follower
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id, related_type)
    VALUES (
        NEW.following_id, 
        'new_follower', 
        'New Connection', 
        actor_name || ' ' || (CASE WHEN NEW.status = 'pending' THEN 'wants to connect' ELSE 'is now connected' END), 
        '/network', 
        NEW.follower_id, 
        'profile'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follower_notification ON public.user_connections;
CREATE TRIGGER on_follower_notification AFTER INSERT ON public.user_connections FOR EACH ROW EXECUTE FUNCTION public.handle_follower_notification();


-- 4. New Post Trigger (for followers)
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
    INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id, related_type)
    SELECT 
        uc.follower_id, 
        'new_post', 
        'New Post', 
        actor_name || ' shared a new post', 
        '/feed', 
        NEW.id, 
        'post'
    FROM public.user_connections uc
    WHERE uc.following_id = NEW.author_id AND uc.status = 'accepted';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_notification ON public.posts;
CREATE TRIGGER on_post_notification AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.handle_new_post_notification();

-- 5. Enable Realtime for Notifications
-- This is critical so that the UI updates instantly without a refresh
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN others THEN
        -- Table might already be in publication or other error
        NULL;
END $$;

-- Ensure replica identity is set for all payload data
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
