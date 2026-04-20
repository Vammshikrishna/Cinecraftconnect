-- talent_network.sql

CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    company_id uuid, -- Link to vendors or company pages
    title text NOT NULL,
    description text,
    location text,
    job_type text, -- 'full-time', 'contract', 'one-day'
    category text,
    salary_range text,
    experience_level text,
    requirements text[],
    status text DEFAULT 'open',
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.job_applications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_uuid_v4(),
    job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    applicant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_url text,
    portfolio_url text,
    cover_letter text,
    showreel_url text,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(job_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS public.job_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    keywords text[],
    categories text[],
    location text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open jobs" ON public.jobs FOR SELECT USING (status = 'open');
CREATE POLICY "Users can apply to jobs" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Applicants can view own applications" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id);
