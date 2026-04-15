
-- 20260414160000_fix_post_stats_security.sql
-- Description: Adds SECURITY DEFINER to post statistic triggers to bypass RLS.
-- This ensures that likes and comments correctly update the post's counter columns
-- even if the active user doesn't have direct UPDATE permissions on the post.

-- 1. Redefine Like Count Trigger Function
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts
        SET like_count = COALESCE(like_count, 0) + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts
        SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Redefine Comment Count Trigger Function
-- This counts ALL rows in post_comments, including replies (parent_id is regardless)
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts
        SET comment_count = COALESCE(comment_count, 0) + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts
        SET comment_count = GREATEST(0, COALESCE(comment_count, 0) - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Perform a synchronization to fix any existing stale counts
UPDATE public.posts p
SET 
    like_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id),
    comment_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
