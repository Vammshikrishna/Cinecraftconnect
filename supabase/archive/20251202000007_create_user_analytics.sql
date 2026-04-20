-- Create user_analytics table
CREATE TABLE IF NOT EXISTS public.user_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Create Policies
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
