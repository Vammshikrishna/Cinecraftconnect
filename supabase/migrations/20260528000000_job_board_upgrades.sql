-- 62_job_board_upgrades.sql
-- Enables Advanced Filter features for Job Board: availability, day rate, union membership, saved searches

-- 1. Add fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'unavailable')),
ADD COLUMN IF NOT EXISTS day_rate_min NUMERIC,
ADD COLUMN IF NOT EXISTS day_rate_max NUMERIC,
ADD COLUMN IF NOT EXISTS union_membership TEXT[] DEFAULT '{}';

-- 2. Add fields to jobs and applications
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS is_shortlisted BOOLEAN DEFAULT false;

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS auto_close_on_hire BOOLEAN DEFAULT false;

-- 3. Create job_saved_searches table
CREATE TABLE IF NOT EXISTS public.job_saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    name TEXT,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for job_saved_searches
ALTER TABLE public.job_saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved searches" ON public.job_saved_searches;
CREATE POLICY "Users can view own saved searches" ON public.job_saved_searches FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved searches" ON public.job_saved_searches;
CREATE POLICY "Users can insert own saved searches" ON public.job_saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved searches" ON public.job_saved_searches;
CREATE POLICY "Users can delete own saved searches" ON public.job_saved_searches FOR DELETE USING (auth.uid() = user_id);

-- 4. Trigger for Auto-close position when filled
CREATE OR REPLACE FUNCTION auto_close_job_on_hire()
RETURNS TRIGGER AS $$
BEGIN
    -- If an applicant is accepted, and the job auto-closes
    IF NEW.status = 'accepted' AND (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        UPDATE public.jobs 
        SET is_active = false 
        WHERE id = NEW.job_id AND auto_close_on_hire = true AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_close_job ON public.job_applications;
CREATE TRIGGER trg_auto_close_job
AFTER INSERT OR UPDATE OF status ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION auto_close_job_on_hire();
