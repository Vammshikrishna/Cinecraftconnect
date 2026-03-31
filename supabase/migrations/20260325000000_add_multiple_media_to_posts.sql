-- 20260325000000_add_multiple_media_to_posts.sql

-- 1. Add media_items column to posts table as JSONB (more compatible with JS/Supabase than jsonb[])
ALTER TABLE public.posts DROP COLUMN IF EXISTS media_items;
ALTER TABLE public.posts ADD COLUMN media_items jsonb DEFAULT '[]'::jsonb;

-- 2. Migrate existing single-media posts to media_items jsonb array
UPDATE public.posts 
SET media_items = jsonb_build_array(jsonb_build_object('url', media_url, 'type', media_type))
WHERE media_url IS NOT NULL;

-- 3. Update the updated_at column to reflect any changes
UPDATE public.posts SET updated_at = now() WHERE media_url IS NOT NULL;
