-- talent_network.sql

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'project-based');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE experience_level AS ENUM ('entry', 'junior', 'mid', 'senior', 'lead');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_application_status AS ENUM ('pending', 'reviewing', 'interviewing', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Company Pages Table (LinkedIn style)
CREATE TABLE IF NOT EXISTS public.company_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  industry TEXT[] DEFAULT '{}',
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+')),
  founded_year INTEGER,
  headquarters TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  specialties TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page Admins
CREATE TABLE IF NOT EXISTS public.company_page_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'content_admin', 'analyst')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- Page Followers
CREATE TABLE IF NOT EXISTS public.company_page_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- Page Team Members
CREATE TABLE IF NOT EXISTS public.company_page_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- 3. Create Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    publisher_page_id UUID REFERENCES public.company_pages(id) ON DELETE CASCADE
);

-- 4. Create Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
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
    posted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    page_id UUID REFERENCES public.company_pages(id) ON DELETE SET NULL
);

-- 5. Create Job Applications Table
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url TEXT,
    status job_application_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    showreel_url TEXT,
    UNIQUE(job_id, applicant_id)
);

-- 6. Create Job Alerts Table
CREATE TABLE IF NOT EXISTS public.job_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    keywords TEXT[],
    categories TEXT[],
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    email_notifications BOOLEAN DEFAULT true
);

-- Triggers to auto-update follower_count
CREATE OR REPLACE FUNCTION update_page_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_pages SET follower_count = follower_count + 1 WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_pages SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.page_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_page_follower_count ON company_page_followers;
CREATE TRIGGER trg_page_follower_count
AFTER INSERT OR DELETE ON company_page_followers
FOR EACH ROW EXECUTE FUNCTION update_page_follower_count();

-- Trigger to auto-insert owner as super_admin
CREATE OR REPLACE FUNCTION auto_add_page_owner_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_page_admins (page_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'super_admin')
  ON CONFLICT (page_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_page_admin ON company_pages;
CREATE TRIGGER trg_auto_page_admin
AFTER INSERT ON company_pages
FOR EACH ROW EXECUTE FUNCTION auto_add_page_owner_as_admin();

-- Enable RLS
ALTER TABLE public.company_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_page_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_page_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_page_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

-- Company Pages policies
DROP POLICY IF EXISTS "Anyone can view company pages" ON public.company_pages;
CREATE POLICY "Anyone can view company pages" ON public.company_pages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can create pages" ON public.company_pages;
CREATE POLICY "Owner can create pages" ON public.company_pages FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner can update pages" ON public.company_pages;
CREATE POLICY "Owner can update pages" ON public.company_pages FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner can delete pages" ON public.company_pages;
CREATE POLICY "Owner can delete pages" ON public.company_pages FOR DELETE USING (auth.uid() = owner_id);

-- Admins policies
DROP POLICY IF EXISTS "Anyone can view page admins" ON public.company_page_admins;
CREATE POLICY "Anyone can view page admins" ON public.company_page_admins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage admins" ON public.company_page_admins;
CREATE POLICY "Owner can manage admins" ON public.company_page_admins FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM company_pages WHERE id = page_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Owner can remove admins" ON public.company_page_admins;
CREATE POLICY "Owner can remove admins" ON public.company_page_admins FOR DELETE USING (
  EXISTS (SELECT 1 FROM company_pages WHERE id = page_id AND owner_id = auth.uid())
);

-- Followers policies
DROP POLICY IF EXISTS "Anyone can view followers" ON public.company_page_followers;
CREATE POLICY "Anyone can view followers" ON public.company_page_followers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow" ON public.company_page_followers;
CREATE POLICY "Users can follow" ON public.company_page_followers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.company_page_followers;
CREATE POLICY "Users can unfollow" ON public.company_page_followers FOR DELETE USING (auth.uid() = user_id);

-- Members policies
DROP POLICY IF EXISTS "Anyone can view members" ON public.company_page_members;
CREATE POLICY "Anyone can view members" ON public.company_page_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can add members" ON public.company_page_members;
CREATE POLICY "Admins can add members" ON public.company_page_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = company_page_members.page_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can remove members" ON public.company_page_members;
CREATE POLICY "Admins can remove members" ON public.company_page_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = company_page_members.page_id AND user_id = auth.uid())
);

-- Announcements policies
DROP POLICY IF EXISTS "Auth View Announcements" ON public.announcements;
CREATE POLICY "Auth View Announcements" ON public.announcements FOR SELECT USING (( SELECT auth.role() AS role) = 'authenticated'::text);

DROP POLICY IF EXISTS "Auth Create Announcements" ON public.announcements;
CREATE POLICY "Auth Create Announcements" ON public.announcements FOR INSERT WITH CHECK (( SELECT auth.role() AS role) = 'authenticated'::text);

DROP POLICY IF EXISTS "Author Manage Announcements" ON public.announcements;
CREATE POLICY "Author Manage Announcements" ON public.announcements FOR ALL USING (( SELECT auth.uid() AS uid) = author_id);

DROP POLICY IF EXISTS "Page admins can manage page announcements" ON public.announcements;
CREATE POLICY "Page admins can manage page announcements" ON public.announcements FOR ALL USING (
  ((publisher_page_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM company_pages WHERE ((company_pages.id = announcements.publisher_page_id) AND (company_pages.owner_id = auth.uid()))))) OR 
  ((publisher_page_id IS NOT NULL) AND (EXISTS ( SELECT 1 FROM company_page_admins WHERE ((company_page_admins.page_id = announcements.publisher_page_id) AND (company_page_admins.user_id = auth.uid())))))
);

-- Jobs policies
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON public.jobs;
CREATE POLICY "Jobs are viewable by everyone" ON public.jobs FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = posted_by);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = posted_by);

DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = posted_by);

-- Job Applications policies
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.job_applications;
CREATE POLICY "Applicants can view own applications" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Job posters can update status" ON public.job_applications;
CREATE POLICY "Job posters can update status" ON public.job_applications FOR UPDATE USING (EXISTS ( SELECT 1 FROM jobs WHERE ((jobs.id = job_applications.job_id) AND (jobs.posted_by = auth.uid()))));

DROP POLICY IF EXISTS "Job posters can view applications" ON public.job_applications;
CREATE POLICY "Job posters can view applications" ON public.job_applications FOR SELECT USING (EXISTS ( SELECT 1 FROM jobs WHERE ((jobs.id = job_applications.job_id) AND (jobs.posted_by = auth.uid()))));

DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;
CREATE POLICY "Users can create applications" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicant Create/View" ON public.job_applications;
CREATE POLICY "Applicant Create/View" ON public.job_applications FOR ALL USING (( SELECT auth.uid() AS uid) = applicant_id);

DROP POLICY IF EXISTS "Employer View Applications" ON public.job_applications;
CREATE POLICY "Employer View Applications" ON public.job_applications FOR SELECT USING (EXISTS ( SELECT 1 FROM jobs WHERE ((jobs.id = job_applications.job_id) AND (jobs.posted_by = ( SELECT auth.uid() AS uid)))));

-- Update triggers for updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
