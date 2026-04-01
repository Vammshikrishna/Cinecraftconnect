
-- 20260401000000_add_parent_id_to_post_comments.sql
-- Description: Adds a self-referencing parent_id to post_comments to allow for Instagram-style threaded replies.

-- 1. Add the parent_id column
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- 2. Add an index for faster nested thread lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_id);

-- 3. (Optional) Backfill comment_count on posts to ensure accuracy after structure change
-- This is handled by existing triggers, but good for manual sync
UPDATE public.posts p
SET comment_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
