-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.user_film_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tmdb_id INTEGER NOT NULL,
    rating NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, tmdb_id)
);

-- Enable RLS
ALTER TABLE public.user_film_ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to fix "Policy Already Exists" error
DROP POLICY IF EXISTS "Allow view all ratings" ON public.user_film_ratings;
DROP POLICY IF EXISTS "Allow users to manage own ratings" ON public.user_film_ratings;
DROP POLICY IF EXISTS "Dev Allow All Ratings" ON public.user_film_ratings; -- Cleanup any old dev policies

-- Create Policies
CREATE POLICY "Allow view all ratings" ON public.user_film_ratings 
FOR SELECT USING (true);

CREATE POLICY "Allow users to manage own ratings" ON public.user_film_ratings 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Force PostgREST Schema Cache Reload (Fixes the 404 error if table was hidden)
NOTIFY pgrst, 'reload config';
