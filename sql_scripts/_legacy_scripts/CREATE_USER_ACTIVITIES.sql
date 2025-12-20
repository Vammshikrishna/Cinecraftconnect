CREATE TABLE IF NOT EXISTS public.user_activities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities;
CREATE POLICY "Users can view their own activities"
ON public.user_activities FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activities" ON public.user_activities;
CREATE POLICY "Users can update their own activities"
ON public.user_activities FOR UPDATE
USING (auth.uid() = user_id);

-- Depending on who creates activities (triggers or server), we might need an insert policy
-- For now allow authenticated users to insert (e.g. for testing) or assume service role
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.user_activities;
CREATE POLICY "Users can insert their own activities"
ON public.user_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);
