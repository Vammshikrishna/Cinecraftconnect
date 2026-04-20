-- Create profile_views table for tracking visits
CREATE TABLE IF NOT EXISTS public.profile_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a view (anonymous or authenticated)
CREATE POLICY "Anyone can record a profile view"
ON public.profile_views FOR INSERT
WITH CHECK (true);

-- Allow profile owners to see their own views
CREATE POLICY "Profile owners can view their view analytics"
ON public.profile_views FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_id ON public.profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_created_at ON public.profile_views(created_at);
