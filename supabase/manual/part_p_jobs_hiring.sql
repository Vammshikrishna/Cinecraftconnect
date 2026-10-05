-- PART P: jobs & hiring overhaul (security fixes + new hiring features). Run AFTER the other parts. Safe to run now.
-- Needs Postgres 12+ (ALTER TYPE ADD VALUE inside a transaction).
BEGIN;
-- Jobs & hiring overhaul: security fixes + the data model for the new hiring features.
--
-- SECURITY FIXES
--   * Applicants could UPDATE their own application (status, shortlisted, ...): the old "Applicant Create/View" rule
--     was a catch-all (FOR ALL). Applicants may now only create, read and withdraw (delete) their own application.
--   * Hiring team access was limited to jobs.posted_by, so people who manage a company page saw no applicants for the
--     page's jobs. can_manage_job() now covers the poster and the page owner / admins / members.
--   * Anyone could create a job under someone else's company page: now the user must manage that page.
--   * The resumes bucket was readable by every signed-in user (and linked publicly). It is now private: the owner and
--     the hiring team of the job they applied to can read it.
--   * Applications are only accepted for open, published, not-expired jobs, and never for your own job.
--
-- NEW
--   job fields (deadline, pay currency/period, department, work mode, shoot dates, openings, screening questions,
--   drafts); application fields (answers, rating, rejection reason); applicant notes; interviews with accept/decline;
--   saved job alerts; job views + analytics; notifications to applicants on every status change.

-- ── 0. Pipeline stage "offered" (must be committed before anything uses it) ───────────────────────────────────────
ALTER TYPE public.job_application_status ADD VALUE IF NOT EXISTS 'offered';

-- ── 1. Who manages a job / a page ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_page_manager(p_page_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_page_id IS NOT NULL AND p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM company_pages cp WHERE cp.id = p_page_id AND cp.owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM company_page_admins a WHERE a.page_id = p_page_id AND a.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM company_page_members m WHERE m.page_id = p_page_id AND m.user_id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_job(p_job_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = p_job_id
      AND (j.posted_by = p_user_id OR public.is_page_manager(j.page_id, p_user_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_page_manager(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_job(uuid, uuid) TO authenticated, service_role;

-- ── 2. Job fields ─────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pay_period text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT 'onsite';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shoot_start date;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shoot_end date;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS openings integer NOT NULL DEFAULT 1;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS screening_questions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_pay_period_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_pay_period_check
  CHECK (pay_period IS NULL OR pay_period IN ('hour', 'day', 'week', 'month', 'year', 'project'));
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_work_mode_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_work_mode_check CHECK (work_mode IN ('onsite', 'hybrid', 'remote'));
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_openings_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_openings_check CHECK (openings >= 1 AND openings <= 500);
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_screening_questions_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_screening_questions_check CHECK (jsonb_typeof(screening_questions) = 'array');

-- A draft is never visible to the public (the public read rule is "is_active = true").
CREATE OR REPLACE FUNCTION public.jobs_enforce_draft_inactive()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_draft THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_jobs_enforce_draft_inactive ON public.jobs;
CREATE TRIGGER trg_jobs_enforce_draft_inactive BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_enforce_draft_inactive();

CREATE INDEX IF NOT EXISTS idx_jobs_active_created ON public.jobs (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_page ON public.jobs (page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON public.jobs (deadline) WHERE deadline IS NOT NULL;

-- Creating a job under a company page requires managing that page.
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = posted_by AND (page_id IS NULL OR public.is_page_manager(page_id, auth.uid())));

-- Closes postings whose deadline has passed (also called lazily by the apps; schedule it if pg_cron is available).
CREATE OR REPLACE FUNCTION public.close_overdue_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH closed AS (
    UPDATE jobs SET is_active = false
    WHERE is_active = true AND deadline IS NOT NULL AND deadline < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM closed;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_overdue_jobs() TO authenticated, service_role;

-- ── 3. Application fields + rules ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS rating smallint;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;
ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_rating_check;
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));

CREATE INDEX IF NOT EXISTS idx_job_applications_job_status ON public.job_applications (job_id, status);

DROP POLICY IF EXISTS "Applicant Create/View" ON public.job_applications;
DROP POLICY IF EXISTS "Employer View Applications" ON public.job_applications;
DROP POLICY IF EXISTS "Job posters can view applications" ON public.job_applications;
DROP POLICY IF EXISTS "Job posters can update status" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants can apply to open jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants can withdraw own application" ON public.job_applications;
DROP POLICY IF EXISTS "Hiring team can view applications" ON public.job_applications;
DROP POLICY IF EXISTS "Hiring team can update applications" ON public.job_applications;

CREATE POLICY "Applicants can view own applications" ON public.job_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

CREATE POLICY "Applicants can apply to open jobs" ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND status = 'pending'
    AND COALESCE(is_shortlisted, false) = false
    AND rating IS NULL
    AND rejection_reason IS NULL
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_id
        AND j.is_active = true
        AND j.is_draft = false
        AND (j.deadline IS NULL OR j.deadline > now())
        AND j.posted_by <> auth.uid()
    )
  );

CREATE POLICY "Applicants can withdraw own application" ON public.job_applications FOR DELETE TO authenticated
  USING (applicant_id = auth.uid());

CREATE POLICY "Hiring team can view applications" ON public.job_applications FOR SELECT TO authenticated
  USING (public.can_manage_job(job_id, auth.uid()));

CREATE POLICY "Hiring team can update applications" ON public.job_applications FOR UPDATE TO authenticated
  USING (public.can_manage_job(job_id, auth.uid()))
  WITH CHECK (public.can_manage_job(job_id, auth.uid()));

-- Belt and braces: even if a policy is loosened later, only the hiring team may change an application.
CREATE OR REPLACE FUNCTION public.job_applications_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_job(NEW.job_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the hiring team can change an application' USING ERRCODE = '42501';
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id THEN
    RAISE EXCEPTION 'job_id and applicant_id cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_job_applications_guard_update ON public.job_applications;
CREATE TRIGGER trg_job_applications_guard_update BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.job_applications_guard_update();

-- Tell the applicant when their application moves (the UI always promised this; nothing sent it).
CREATE OR REPLACE FUNCTION public.notify_applicant_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text;
  v_job_title text;
  v_heading text;
  v_body text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
  v_job_title := COALESCE(v_job_title, 'a job');

  CASE NEW.status::text
    WHEN 'reviewing' THEN
      v_heading := 'Your application is being reviewed';
      v_body := 'The hiring team is reviewing your application for ' || v_job_title || '.';
    WHEN 'interviewing' THEN
      v_heading := 'You are moving to interviews';
      v_body := 'Good news! You have been shortlisted for an interview for ' || v_job_title || '.';
    WHEN 'offered' THEN
      v_heading := 'You received an offer';
      v_body := 'The hiring team made you an offer for ' || v_job_title || '. Check your application for details.';
    WHEN 'accepted' THEN
      v_heading := 'You are hired';
      v_body := 'Congratulations! You have been selected for ' || v_job_title || '.';
    WHEN 'rejected' THEN
      v_heading := 'Update on your application';
      v_body := 'The hiring team will not be moving forward with your application for ' || v_job_title || '.'
                || CASE WHEN NEW.rejection_reason IS NOT NULL AND length(trim(NEW.rejection_reason)) > 0
                        THEN ' Note: ' || NEW.rejection_reason ELSE '' END;
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (NEW.applicant_id, auth.uid(), 'job_application_status', v_heading, v_body, '/jobs/applications', NEW.job_id, false);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_applicant_on_status_change ON public.job_applications;
CREATE TRIGGER trg_notify_applicant_on_status_change AFTER UPDATE OF status ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_applicant_on_status_change();

-- ── 4. Applicant notes (private to the hiring team) ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_applicant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_applicant_notes_app ON public.job_applicant_notes (application_id, created_at);
ALTER TABLE public.job_applicant_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hiring team reads notes" ON public.job_applicant_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM job_applications a WHERE a.id = application_id AND public.can_manage_job(a.job_id, auth.uid())));
CREATE POLICY "Hiring team writes notes" ON public.job_applicant_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM job_applications a WHERE a.id = application_id AND public.can_manage_job(a.job_id, auth.uid())));
CREATE POLICY "Authors delete own notes" ON public.job_applicant_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ── 5. Interviews ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 10 AND 480),
  mode text NOT NULL DEFAULT 'video' CHECK (mode IN ('video', 'call', 'in_person')),
  location text,
  notes text,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'declined', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_interviews_app ON public.job_interviews (application_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_job_interviews_job ON public.job_interviews (job_id);
ALTER TABLE public.job_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hiring team manages interviews" ON public.job_interviews FOR ALL TO authenticated
  USING (public.can_manage_job(job_id, auth.uid()))
  WITH CHECK (public.can_manage_job(job_id, auth.uid()));

-- proposed_by is always the person who creates the interview (not whatever the client sends).
CREATE OR REPLACE FUNCTION public.job_interviews_set_proposer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.proposed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_job_interviews_set_proposer ON public.job_interviews;
CREATE TRIGGER trg_job_interviews_set_proposer BEFORE INSERT ON public.job_interviews
  FOR EACH ROW EXECUTE FUNCTION public.job_interviews_set_proposer();
CREATE POLICY "Applicants read their interviews" ON public.job_interviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM job_applications a WHERE a.id = application_id AND a.applicant_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.job_interviews_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_job_interviews_touch ON public.job_interviews;
CREATE TRIGGER trg_job_interviews_touch BEFORE UPDATE ON public.job_interviews
  FOR EACH ROW EXECUTE FUNCTION public.job_interviews_touch();

-- Applicant gets a notification when an interview is proposed / changed / cancelled.
CREATE OR REPLACE FUNCTION public.notify_applicant_on_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_applicant uuid;
  v_job_title text;
BEGIN
  SELECT a.applicant_id INTO v_applicant FROM job_applications a WHERE a.id = NEW.application_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
  IF v_applicant IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_applicant, NEW.proposed_by, 'job_interview', 'Interview proposed',
            'You have been invited to interview for ' || COALESCE(v_job_title, 'a job') || ' on '
              || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC. Please confirm.',
            '/jobs/applications', NEW.job_id, false);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_applicant, auth.uid(), 'job_interview', 'Interview cancelled',
            'Your interview for ' || COALESCE(v_job_title, 'a job') || ' was cancelled by the hiring team.',
            '/jobs/applications', NEW.job_id, false);
  ELSIF TG_OP = 'UPDATE' AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_applicant, auth.uid(), 'job_interview', 'Interview rescheduled',
            'Your interview for ' || COALESCE(v_job_title, 'a job') || ' moved to '
              || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC. Please confirm.',
            '/jobs/applications', NEW.job_id, false);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_applicant_on_interview ON public.job_interviews;
CREATE TRIGGER trg_notify_applicant_on_interview AFTER INSERT OR UPDATE ON public.job_interviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_applicant_on_interview();

-- The applicant confirms or declines (they cannot edit interviews directly).
CREATE OR REPLACE FUNCTION public.respond_to_interview(p_interview_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_status text := CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  SELECT i.*, a.applicant_id, j.title AS job_title, j.posted_by
  INTO v_row
  FROM job_interviews i
  JOIN job_applications a ON a.id = i.application_id
  JOIN jobs j ON j.id = i.job_id
  WHERE i.id = p_interview_id;

  IF v_row.id IS NULL OR v_row.applicant_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Interview not found');
  END IF;
  IF v_row.status NOT IN ('proposed', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'This interview can no longer be changed');
  END IF;

  UPDATE job_interviews SET status = v_status WHERE id = p_interview_id;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_row.posted_by, v_uid, 'job_interview',
          CASE WHEN p_accept THEN 'Interview confirmed' ELSE 'Interview declined' END,
          'The applicant ' || CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END
            || ' the interview for ' || v_row.job_title || '.',
          '/jobs/manage', v_row.job_id, false);

  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_to_interview(uuid, boolean) TO authenticated;

-- ── 6. Job alerts (saved searches) ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords text,
  job_type text,
  work_mode text CHECK (work_mode IS NULL OR work_mode IN ('onsite', 'hybrid', 'remote')),
  department text,
  location text,
  min_salary numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON public.job_alerts (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON public.job_alerts (user_id);
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own job alerts" ON public.job_alerts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Max 10 alerts per person.
CREATE OR REPLACE FUNCTION public.job_alerts_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM job_alerts WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'You can save up to 10 job alerts' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_job_alerts_limit ON public.job_alerts;
CREATE TRIGGER trg_job_alerts_limit BEFORE INSERT ON public.job_alerts
  FOR EACH ROW EXECUTE FUNCTION public.job_alerts_limit();

CREATE OR REPLACE FUNCTION public.notify_job_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_haystack text;
BEGIN
  IF NEW.is_active IS NOT TRUE OR NEW.is_draft THEN
    RETURN NEW;
  END IF;
  -- only when the job BECOMES visible (new job, or a draft being published / a closed job reopened)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_active IS TRUE AND OLD.is_draft = false THEN
      RETURN NEW;
    END IF;
  END IF;

  v_haystack := lower(COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.company, ''));

  FOR r IN
    SELECT a.user_id
    FROM job_alerts a
    WHERE a.is_active
      AND a.user_id <> NEW.posted_by
      AND (a.job_type IS NULL OR a.job_type = NEW.type::text)
      AND (a.work_mode IS NULL OR a.work_mode = NEW.work_mode)
      AND (a.department IS NULL OR COALESCE(NEW.department, '') ILIKE '%' || a.department || '%')
      AND (a.location IS NULL OR NEW.work_mode = 'remote' OR COALESCE(NEW.location, '') ILIKE '%' || a.location || '%')
      AND (a.min_salary IS NULL OR COALESCE(NEW.salary_max, NEW.salary_min, 0) >= a.min_salary)
      AND (a.keywords IS NULL OR trim(a.keywords) = '' OR NOT EXISTS (
            SELECT 1 FROM unnest(string_to_array(lower(trim(a.keywords)), ' ')) w
            WHERE w <> '' AND position(w IN v_haystack) = 0))
    LIMIT 500
  LOOP
    INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (r.user_id, NEW.posted_by, 'job_alert', 'New job matching your alert',
            NEW.title || ' · ' || NEW.company, '/jobs/' || NEW.id::text, NEW.id, false);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_job_alerts ON public.jobs;
CREATE TRIGGER trg_notify_job_alerts AFTER INSERT OR UPDATE OF is_active, is_draft ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_alerts();

-- ── 7. Views + analytics for the hiring team ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_views_job ON public.job_views (job_id, created_at DESC);
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;
-- No direct access: views are written by record_job_view() and read through job_analytics().

CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF public.can_manage_job(p_job_id, v_uid) THEN RETURN; END IF;           -- the team's own opens do not count
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id AND is_active = true) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM job_views WHERE job_id = p_job_id AND viewer_id = v_uid AND created_at > now() - interval '12 hours') THEN
    RETURN;
  END IF;
  INSERT INTO job_views (job_id, viewer_id) VALUES (p_job_id, v_uid);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_job_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.job_analytics(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.can_manage_job(p_job_id, auth.uid()) THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT jsonb_build_object(
    'views', (SELECT count(*) FROM job_views WHERE job_id = p_job_id),
    'unique_viewers', (SELECT count(DISTINCT viewer_id) FROM job_views WHERE job_id = p_job_id),
    'saves', (SELECT count(*) FROM job_bookmarks WHERE job_id = p_job_id),
    'applications', (SELECT count(*) FROM job_applications WHERE job_id = p_job_id),
    'by_status', COALESCE((
      SELECT jsonb_object_agg(status::text, c)
      FROM (SELECT status, count(*) AS c FROM job_applications WHERE job_id = p_job_id GROUP BY status) s
    ), '{}'::jsonb),
    'shortlisted', (SELECT count(*) FROM job_applications WHERE job_id = p_job_id AND is_shortlisted),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d::date,
        'views', (SELECT count(*) FROM job_views v WHERE v.job_id = p_job_id AND v.created_at::date = d::date),
        'applications', (SELECT count(*) FROM job_applications a WHERE a.job_id = p_job_id AND a.created_at::date = d::date))
        ORDER BY d)
      FROM generate_series(current_date - 13, current_date, interval '1 day') d
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.job_analytics(uuid) TO authenticated;

-- ── 8. Resumes: private bucket, readable by the owner and the hiring team of the job they applied to ───────────────
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

DROP POLICY IF EXISTS "Auth upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Auth view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete resumes" ON storage.objects;
DROP POLICY IF EXISTS "Owner update resumes" ON storage.objects;
DROP POLICY IF EXISTS "Resumes upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Resumes read owner or hiring team" ON storage.objects;
DROP POLICY IF EXISTS "Resumes update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Resumes delete own folder" ON storage.objects;

CREATE POLICY "Resumes upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Resumes read owner or hiring team" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.job_applications a
        WHERE (a.resume_url = 'resumes:' || name OR a.resume_url LIKE '%/resumes/' || name)
          AND public.can_manage_job(a.job_id, auth.uid())
      )
    )
  );

CREATE POLICY "Resumes update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Resumes delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
