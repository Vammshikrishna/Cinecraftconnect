-- Create Enums
CREATE TYPE job_type AS ENUM ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'project-based');
CREATE TYPE experience_level AS ENUM ('entry', 'junior', 'mid', 'senior', 'lead');

-- Create Jobs Table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    type job_type NOT NULL DEFAULT 'full-time',
    salary_min NUMERIC,
    salary_max NUMERIC,
    experience_level experience_level NOT NULL DEFAULT 'mid',
    requirements TEXT,
    posted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Everyone can view active jobs
CREATE POLICY "Jobs are viewable by everyone" 
ON jobs FOR SELECT 
USING (is_active = true);

-- Authenticated users can create jobs
CREATE POLICY "Users can create jobs" 
ON jobs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = posted_by);

-- Users can update their own jobs
CREATE POLICY "Users can update own jobs" 
ON jobs FOR UPDATE 
TO authenticated 
USING (auth.uid() = posted_by);

-- Users can delete their own jobs
CREATE POLICY "Users can delete own jobs" 
ON jobs FOR DELETE 
TO authenticated 
USING (auth.uid() = posted_by);

-- Create Updated At Trigger
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
