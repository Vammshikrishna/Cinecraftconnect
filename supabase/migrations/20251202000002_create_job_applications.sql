-- Create Enum
DO $$ BEGIN
    CREATE TYPE job_application_status AS ENUM ('pending', 'reviewing', 'interviewing', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Job Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url TEXT,
    status job_application_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(job_id, applicant_id)
);

-- Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- Applicants can view their own applications
DROP POLICY IF EXISTS "Applicants can view own applications" ON job_applications;
CREATE POLICY "Applicants can view own applications" 
ON job_applications FOR SELECT 
TO authenticated 
USING (auth.uid() = applicant_id);

-- Job posters can view applications for their jobs
DROP POLICY IF EXISTS "Job posters can view applications" ON job_applications;
CREATE POLICY "Job posters can view applications" 
ON job_applications FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_applications.job_id 
        AND jobs.posted_by = auth.uid()
    )
);

-- Authenticated users can create applications
DROP POLICY IF EXISTS "Users can create applications" ON job_applications;
CREATE POLICY "Users can create applications" 
ON job_applications FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = applicant_id);

-- Job posters can update status
DROP POLICY IF EXISTS "Job posters can update status" ON job_applications;
CREATE POLICY "Job posters can update status" 
ON job_applications FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_applications.job_id 
        AND jobs.posted_by = auth.uid()
    )
);

-- Create Storage Bucket for Resumes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Resume Access" ON storage.objects;
CREATE POLICY "Resume Access"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'resumes' );

DROP POLICY IF EXISTS "Resume Upload" ON storage.objects;
CREATE POLICY "Resume Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Create Updated At Trigger
DROP TRIGGER IF EXISTS update_job_applications_updated_at ON job_applications;
CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
