-- Add media_items column if it doesn't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_items jsonb DEFAULT '[]'::jsonb;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
