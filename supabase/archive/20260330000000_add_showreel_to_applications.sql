-- Add showreel_url to job_applications
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS showreel_url TEXT;
