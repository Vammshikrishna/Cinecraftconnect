-- ============================================================================
-- FIX LIKES & SYNC COUNTS
-- ============================================================================

-- 1. Ensure Post Likes Policies are 100% correct
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting/old policies
DROP POLICY IF EXISTS "Public view post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Authenticated users can create post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can delete own post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "view_all_likes" ON public.post_likes;
DROP POLICY IF EXISTS "manage_own_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;

-- Recreate Simple Policies (Select All, Insert/Delete Own)
CREATE POLICY "view_all_likes" ON public.post_likes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage_own_likes" ON public.post_likes
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 2. REFRESH TRIGGERS
-- Ensure the count update triggers are definitely active
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


-- 3. SYNC COUNTS (Self-Healing)
-- Recalculate all like counts to match reality
UPDATE public.posts p
SET like_count = (
    SELECT COUNT(*) 
    FROM public.post_likes pl 
    WHERE pl.post_id = p.id
);
