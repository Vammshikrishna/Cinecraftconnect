-- CineCraft Connect: Content Reporting Infrastructure
-- Implements the community-led signals for the Governance Operating System

CREATE TABLE IF NOT EXISTS public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id),
    target_type TEXT NOT NULL, -- 'project', 'discussion', 'post', 'profile', 'comment'
    target_id UUID NOT NULL,
    target_title TEXT, -- Denormalized for quick view
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'dismissed'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    moderator_id UUID REFERENCES public.profiles(id),
    moderator_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexing for Moderation Dashboard performance
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports(target_type, target_id);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Any authenticated user can file a report
CREATE POLICY "Users can create reports" 
ON public.content_reports 
FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

-- 2. Users can view the status of their own reports
CREATE POLICY "Users can view own reports" 
ON public.content_reports 
FOR SELECT 
USING (auth.uid() = reporter_id);

-- 3. Staff can view and manage all reports
CREATE POLICY "Staff can manage all reports" 
ON public.content_reports 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('moderator', 'admin', 'super_admin')
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_content_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_content_reports_timestamp
    BEFORE UPDATE ON public.content_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_timestamp();
