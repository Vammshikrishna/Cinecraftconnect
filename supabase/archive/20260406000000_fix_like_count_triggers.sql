-- 20260406000000_fix_like_count_triggers.sql
-- Description: Fixes the like_count and comment_count triggers to handle NULL values safely using COALESCE.
-- This ensures that increments and decrements work correctly even if the initial count was NULL.

-- 1. Ensure columns have default 0 (if they don't already)
ALTER TABLE public.posts ALTER COLUMN like_count SET DEFAULT 0;
ALTER TABLE public.posts ALTER COLUMN comment_count SET DEFAULT 0;
ALTER TABLE public.posts ALTER COLUMN share_count SET DEFAULT 0;

-- 2. Update existing rows with NULL counts to 0
UPDATE public.posts SET like_count = 0 WHERE like_count IS NULL;
UPDATE public.posts SET comment_count = 0 WHERE comment_count IS NULL;
UPDATE public.posts SET share_count = 0 WHERE share_count IS NULL;

-- 3. Upgrade the like_count trigger function to be robust
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER AS $$
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

-- 4. Upgrade the comment_count trigger function
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $$
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

-- 5. Force a synchronization for all posts to match current row counts
UPDATE public.posts p
SET 
    like_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id),
    comment_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
