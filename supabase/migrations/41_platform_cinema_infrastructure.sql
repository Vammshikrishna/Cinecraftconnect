-- 41_platform_cinema_infrastructure.sql
-- Enables users to submit their own films, shows, and ads directly to the platform

CREATE TABLE IF NOT EXISTS public.platform_cinema (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    type text NOT NULL CHECK (type IN ('movie', 'tv', 'short', 'ad')),
    overview text,
    poster_url text,
    backdrop_url text,
    trailer_url text,
    release_date date DEFAULT CURRENT_DATE,
    genre text[],
    runtime integer,
    credits jsonb DEFAULT '[]'::jsonb,
    is_published boolean DEFAULT true,
    view_count bigint DEFAULT 0
);
-- Update Reviews and Ratings to support internal platform cinema
ALTER TABLE public.film_reviews 
ADD COLUMN IF NOT EXISTS platform_cinema_id uuid REFERENCES public.platform_cinema(id) ON DELETE CASCADE;
ALTER TABLE public.user_film_ratings 
ADD COLUMN IF NOT EXISTS platform_cinema_id uuid REFERENCES public.platform_cinema(id) ON DELETE CASCADE;
-- Relax constraints: tmdb_id OR platform_cinema_id must be present
ALTER TABLE public.film_reviews ALTER COLUMN tmdb_id DROP NOT NULL;
ALTER TABLE public.user_film_ratings ALTER COLUMN tmdb_id DROP NOT NULL;
-- Enable RLS
ALTER TABLE public.platform_cinema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published cinema" ON public.platform_cinema
FOR SELECT USING (is_published = true);
CREATE POLICY "Users can manage their own cinema entries" ON public.platform_cinema
FOR ALL USING (auth.uid() = creator_id);
ALTER TABLE public.platform_cinema 
ADD COLUMN IF NOT EXISTS gallery text[] DEFAULT '{}'::text[];
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_cinema_creator ON public.platform_cinema(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_cinema_type ON public.platform_cinema(type);
CREATE INDEX IF NOT EXISTS idx_platform_cinema_published ON public.platform_cinema(is_published) WHERE is_published = true;
