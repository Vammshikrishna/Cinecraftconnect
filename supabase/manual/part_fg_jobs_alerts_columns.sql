-- PART FG (jobs) - fix "column a.job_type does not exist": nobody can PUBLISH a job (POST /rest/v1/jobs returns 400) and job alerts cannot be saved. Safe to run more than once.
--
-- WHAT WENT WRONG: part P (supabase/manual/part_p_jobs_hiring.sql) creates job_alerts with "CREATE TABLE IF NOT EXISTS". The live project already had an OLDER
-- job_alerts table (columns keywords text[], categories, location, is_active, email_notifications), so part P's version was skipped and the table never got
-- job_type, work_mode, department, min_salary (and keywords is an array, the app and the trigger expect plain text). The trigger notify_job_alerts() runs after every
-- job insert / publish and reads those columns, so EVERY job publish fails with: column a.job_type does not exist.
-- THE FIX: add the missing columns, turn keywords into text, make sure the policy and the 10-alerts-per-person limit exist, and re-create the trigger function.
--
-- PREFLIGHT (read only): select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'job_alerts' order by ordinal_position;
--   -- today: no job_type / work_mode / department / min_salary, keywords is ARRAY
-- POST-CHECK  (read only): the same query shows job_type, work_mode, department, min_salary and keywords = text; then publish a job on the website: it appears under Manage postings.

-- If you see "deadlock detected" (40P01): the website was using these tables while this ran. Nothing is half-done (every statement below is safe to repeat),
-- so just run the file again. It no longer wraps everything in one transaction and gives up quickly on a busy table instead of waiting, which avoids the deadlock.
SET lock_timeout = '5s';

ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS job_type text;
ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS work_mode text;
ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS min_salary numeric;
ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.job_alerts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  -- keywords: old text[] -> text (words separated by a space)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_alerts' AND column_name = 'keywords' AND data_type = 'ARRAY') THEN
    ALTER TABLE public.job_alerts ALTER COLUMN keywords TYPE text USING array_to_string(keywords, ' ');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.job_alerts'::regclass AND conname = 'job_alerts_work_mode_check') THEN
    ALTER TABLE public.job_alerts ADD CONSTRAINT job_alerts_work_mode_check CHECK (work_mode IS NULL OR work_mode IN ('onsite', 'hybrid', 'remote'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON public.job_alerts (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_job_alerts_user ON public.job_alerts (user_id);
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own job alerts" ON public.job_alerts;
CREATE POLICY "Users manage own job alerts" ON public.job_alerts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.job_alerts_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r record;
  v_haystack text;
BEGIN
  IF NEW.is_active IS NOT TRUE OR NEW.is_draft THEN
    RETURN NEW;
  END IF;
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
REVOKE ALL ON FUNCTION public.notify_job_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_job_alerts() TO service_role;
DROP TRIGGER IF EXISTS trg_notify_job_alerts ON public.jobs;
CREATE TRIGGER trg_notify_job_alerts AFTER INSERT OR UPDATE OF is_active, is_draft ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_alerts();
