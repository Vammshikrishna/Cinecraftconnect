-- 40_fix_review_schema.sql
-- Forcefully ensures that the film_reviews table has the is_anonymous column
-- and refreshes the schema cache.

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='film_reviews' AND column_name='is_anonymous'
    ) THEN
        ALTER TABLE public.film_reviews ADD COLUMN is_anonymous BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Also add is_spoiler just in case it's missing
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='film_reviews' AND column_name='is_spoiler'
    ) THEN
        ALTER TABLE public.film_reviews ADD COLUMN is_spoiler BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'film_reviews_user_tmdb_unique'
    ) THEN
        ALTER TABLE public.film_reviews ADD CONSTRAINT film_reviews_user_tmdb_unique UNIQUE (user_id, tmdb_id);
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
