-- Ensure post_likes table exists (if not already created by another migration)
CREATE TABLE IF NOT EXISTS public.post_likes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

-- Enable RLS on post_likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Policies for post_likes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Public view post_likes'
    ) THEN
        CREATE POLICY "Public view post_likes" ON public.post_likes FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Authenticated users can create post_likes'
    ) THEN
        CREATE POLICY "Authenticated users can create post_likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Users can delete own post_likes'
    ) THEN
        CREATE POLICY "Users can delete own post_likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Function to update post like count
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts
        SET like_count = like_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for post_likes
DROP TRIGGER IF EXISTS update_post_like_count_on_insert ON public.post_likes;
CREATE TRIGGER update_post_like_count_on_insert
AFTER INSERT ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

DROP TRIGGER IF EXISTS update_post_like_count_on_delete ON public.post_likes;
CREATE TRIGGER update_post_like_count_on_delete
AFTER DELETE ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

-- Function to update post comment count
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts
        SET comment_count = comment_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for post_comments
DROP TRIGGER IF EXISTS update_post_comment_count_on_insert ON public.post_comments;
CREATE TRIGGER update_post_comment_count_on_insert
AFTER INSERT ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();

DROP TRIGGER IF EXISTS update_post_comment_count_on_delete ON public.post_comments;
CREATE TRIGGER update_post_comment_count_on_delete
AFTER DELETE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();

-- Backfill counts (optional but good for consistency)
UPDATE public.posts p
SET 
    like_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id),
    comment_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
