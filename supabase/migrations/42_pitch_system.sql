-- 42_pitch_system.sql
-- Professional story pitching and collaboration system

-- Pitch Calls (Demand side - posted by Producers/Studios)
CREATE TABLE IF NOT EXISTS public.pitch_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Identity
    title text NOT NULL,
    slug text UNIQUE,
    
    -- Project Details
    project_type text NOT NULL CHECK (project_type IN ('film', 'series', 'short', 'documentary', 'youtube', 'animation', 'branded', 'other')),
    genre text[] DEFAULT '{}',
    subgenre text,
    language text[] DEFAULT '{}',
    format text CHECK (format IN ('film', 'series', 'short', 'documentary', 'youtube', 'animation', 'branded')),
    target_audience text,
    
    -- Commercial
    budget_range text CHECK (budget_range IN ('micro', 'low', 'mid', 'high', 'studio', 'undisclosed')),
    compensation text CHECK (compensation IN ('paid', 'unpaid', 'development_deal', 'revenue_share', 'negotiable')),
    
    -- Story Requirements
    requirement_description text NOT NULL,
    tone text,
    ref_films text,
    
    -- Settings
    deadline date,
    is_open_to_debut boolean DEFAULT false,
    is_regional_welcome boolean DEFAULT false,
    rights_expectation text,
    nda_required boolean DEFAULT false,
    
    -- Status
    status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paused', 'expired')),
    is_published boolean DEFAULT true,
    view_count bigint DEFAULT 0,
    
    -- Attachments
    attachments jsonb DEFAULT '[]'
);

-- Pitch Submissions (Supply side - submitted by Writers/Creators)
CREATE TABLE IF NOT EXISTS public.pitch_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    submitted_at timestamptz DEFAULT now(),
    
    pitch_call_id uuid REFERENCES public.pitch_calls(id) ON DELETE CASCADE NOT NULL,
    submitter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Pitch Content
    title text NOT NULL,
    logline text NOT NULL,
    short_synopsis text NOT NULL,
    full_synopsis text, -- protected, only producer can see
    genre text,
    format text,
    language text,
    tone text,
    why_fits text,
    
    -- IP Protection
    rights_owned boolean DEFAULT true,
    is_original_work boolean DEFAULT true,
    
    -- Attachments (optional)
    treatment_url text,
    lookbook_url text,
    moodboard_url text,
    character_notes text,
    pilot_outline text,
    reference_links text[],
    
    -- Status Workflow
    status text DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'seen', 'under_review', 'shortlisted',
        'interested', 'request_full_deck', 'invite_to_discuss',
        'passed', 'closed', 'collaborating'
    )),
    
    -- NDA Preference
    nda_preferred boolean DEFAULT false,
    
    -- Timestamps for audit
    seen_at timestamptz,
    reviewed_at timestamptz,
    shortlisted_at timestamptz,
    passed_at timestamptz,
    
    UNIQUE(pitch_call_id, submitter_id)
);

-- Access logs for IP protection
CREATE TABLE IF NOT EXISTS public.pitch_access_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    pitch_submission_id uuid REFERENCES public.pitch_submissions(id) ON DELETE CASCADE,
    accessed_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('viewed', 'full_synopsis_viewed', 'attachment_downloaded'))
);

-- Saved Pitch Calls (bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_pitch_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pitch_call_id uuid REFERENCES public.pitch_calls(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(user_id, pitch_call_id)
);

-- Enable RLS
ALTER TABLE public.pitch_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_pitch_calls ENABLE ROW LEVEL SECURITY;

-- Pitch Calls Policies
CREATE POLICY "Anyone authenticated can view open pitch calls" ON public.pitch_calls
    FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = true);

CREATE POLICY "Creators can manage their own pitch calls" ON public.pitch_calls
    FOR ALL USING (auth.uid() = creator_id);

-- Pitch Submissions Policies
-- Submitters see their own submissions
CREATE POLICY "Submitters see their own submissions" ON public.pitch_submissions
    FOR SELECT USING (auth.uid() = submitter_id);

-- Pitch call creators can see submissions to their calls
CREATE POLICY "Pitch call owners see their submissions" ON public.pitch_submissions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT creator_id FROM public.pitch_calls WHERE id = pitch_call_id
        )
    );

-- Submitters can insert their own submissions
CREATE POLICY "Authenticated users can submit pitches" ON public.pitch_submissions
    FOR INSERT WITH CHECK (auth.uid() = submitter_id);

-- Pitch call owners can update submission status
CREATE POLICY "Pitch call owners can update submission status" ON public.pitch_submissions
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT creator_id FROM public.pitch_calls WHERE id = pitch_call_id
        )
    );

-- Access logs
CREATE POLICY "Users can insert their own access logs" ON public.pitch_access_logs
    FOR INSERT WITH CHECK (auth.uid() = accessed_by);

CREATE POLICY "Users see logs for their submissions" ON public.pitch_access_logs
    FOR SELECT USING (
        auth.uid() IN (
            SELECT submitter_id FROM public.pitch_submissions WHERE id = pitch_submission_id
        )
    );

-- Saved pitch calls
CREATE POLICY "Users manage their own saved pitch calls" ON public.saved_pitch_calls
    FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pitch_calls_creator ON public.pitch_calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_pitch_calls_status ON public.pitch_calls(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pitch_calls_published ON public.pitch_calls(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_pitch_submissions_call ON public.pitch_submissions(pitch_call_id);
CREATE INDEX IF NOT EXISTS idx_pitch_submissions_submitter ON public.pitch_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_pitch_submissions_status ON public.pitch_submissions(status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_pitch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER pitch_calls_updated_at
    BEFORE UPDATE ON public.pitch_calls
    FOR EACH ROW EXECUTE FUNCTION public.update_pitch_updated_at();

CREATE TRIGGER pitch_submissions_updated_at
    BEFORE UPDATE ON public.pitch_submissions
    FOR EACH ROW EXECUTE FUNCTION public.update_pitch_updated_at();

-- Notify schema cache
NOTIFY pgrst, 'reload schema';
