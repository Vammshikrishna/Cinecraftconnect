-- ============================================================================
-- FIX: USER ANALYTICS & STORAGE POLICIES
-- ============================================================================
-- 1. Re-creates user_analytics table (missing in production)
-- 2. Fixes Storage RLS for 'portfolios' bucket (causing upload errors)
-- ============================================================================

-- 1. USER ANALYTICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own analytics" ON public.user_analytics;
CREATE POLICY "Users can insert their own analytics"
ON public.user_analytics FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own analytics" ON public.user_analytics;
CREATE POLICY "Users can view their own analytics"
ON public.user_analytics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- 2. STORAGE: PORTFOLIOS BUCKET
-- ============================================================================
-- Ensure bucket exists and is public (required for <img> tags usually)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolios', 'portfolios', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Fix RLS Policies
DROP POLICY IF EXISTS "authenticated read portfolios" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload portfolios" ON storage.objects;
DROP POLICY IF EXISTS "owner delete portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Give me access to portfolios" ON storage.objects; -- Cleanup potential old policy

-- READ: Allow Public (since bucket is public) OR Authenticated
-- Using Public Read ensures images load in <img> tags without complex token handling
CREATE POLICY "Public Read Portfolios"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolios');

-- UPLOAD: Authenticated Users Only
CREATE POLICY "Authenticated Upload Portfolios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolios');

-- DELETE: Owner Only
CREATE POLICY "Owner Delete Portfolios"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolios' AND (auth.uid() = owner OR owner IS NULL));

-- UPDATE: Owner Only
CREATE POLICY "Owner Update Portfolios"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolios' AND (auth.uid() = owner OR owner IS NULL));
