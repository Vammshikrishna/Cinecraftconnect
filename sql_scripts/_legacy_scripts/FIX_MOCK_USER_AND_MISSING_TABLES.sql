-- ============================================================================
-- FIX DB FOR MOCK USER & MISSING TABLES
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Create the missing 'user_film_ratings' table (Fixes 404 Error)
CREATE TABLE IF NOT EXISTS public.user_film_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- Removed REFERENCES to allow flexibility or add it if Profile exists
    tmdb_id INTEGER NOT NULL,
    rating NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, tmdb_id)
);

-- Enable RLS
ALTER TABLE public.user_film_ratings ENABLE ROW LEVEL SECURITY;

-- 2. Create the missing 'user_connections' table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- 3. RELAX permissions for Development (Fixes 406/401 Errors)
-- Since we are using a Mock User, we don't have a real token.
-- These policies allow ANYONE (including our fake user) to read/write.
-- WARNING: REMOVE THESE BEFORE PRODUCTION.

DROP POLICY IF EXISTS "Dev Allow All Ratings" ON public.user_film_ratings;
CREATE POLICY "Dev Allow All Ratings" ON public.user_film_ratings 
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Dev Allow All Connections" ON public.user_connections;
CREATE POLICY "Dev Allow All Connections" ON public.user_connections 
FOR ALL USING (true) WITH CHECK (true);

-- 4. Insert the MOCK User Profile (if possible)
-- Note: This might fail if the ID doesn't exist in auth.users, so we insert into profiles blindly
-- expecting that you might have removed the strict FK constraint or using a lenient mode.
INSERT INTO public.profiles (id, username, full_name, onboarding_completed)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'demo_user',
  'Demo User',
  true
) ON CONFLICT (id) DO NOTHING;
