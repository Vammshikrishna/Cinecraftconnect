-- PART BL: a better moderation queue, and clearer standing for users.
--   * Response targets: every open report gets a due time (urgent 1 hour, high 4 hours, medium 24 hours, low 72 hours).
--     Staff are alerted when reports are overdue.
--   * Duplicate reports: a report on something that already has open reports raises the priority (3 reports = high,
--     5 = urgent), and closing one report closes the others on the same target.
--   * Saved reasons and replies: ready-made wording staff can pick when they give a reason (editable by admins).
--   * Account standing: get_my_account_standing() tells a person their own strikes, mute, suspension and appeal.
-- Run after part BK. Safe to run twice.
BEGIN;

-- ── response targets and priority ───────────────────────────────────────────────────────────────
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS overdue_alerted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_content_reports_open_due ON public.content_reports (due_at) WHERE status IN ('pending', 'reviewing');
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports (target_type, target_id);

CREATE OR REPLACE FUNCTION public.report_due_interval(p_priority text)
RETURNS interval LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_priority WHEN 'urgent' THEN interval '1 hour' WHEN 'high' THEN interval '4 hours'
                         WHEN 'low' THEN interval '72 hours' ELSE interval '24 hours' END;
$$;

CREATE OR REPLACE FUNCTION public.report_priority_rank(p_priority text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.report_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- other people already reported the same thing: it matters more
    SELECT count(*)::int INTO v_open FROM public.content_reports
     WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND status IN ('pending', 'reviewing');
    IF v_open >= 4 AND public.report_priority_rank(NEW.priority) < 4 THEN
      NEW.priority := 'urgent';
    ELSIF v_open >= 2 AND public.report_priority_rank(NEW.priority) < 3 THEN
      NEW.priority := 'high';
    END IF;
    NEW.due_at := now() + public.report_due_interval(NEW.priority);
  ELSIF NEW.priority IS DISTINCT FROM OLD.priority THEN
    -- a higher priority can only bring the deadline forward
    NEW.due_at := LEAST(COALESCE(OLD.due_at, 'infinity'::timestamptz), now() + public.report_due_interval(NEW.priority));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_report_prepare ON public.content_reports;
CREATE TRIGGER trg_report_prepare BEFORE INSERT OR UPDATE OF priority ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.report_prepare();

-- reports that were already open get a deadline too
UPDATE public.content_reports SET due_at = created_at + public.report_due_interval(priority)
 WHERE due_at IS NULL AND status IN ('pending', 'reviewing');

-- ── closing one report closes the others on the same target ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_close_siblings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- reports closed by this very function must not close each other again
  IF NEW.resolution_note LIKE 'Closed together with report%' THEN
    RETURN NULL;
  END IF;
  UPDATE public.content_reports
     SET status = NEW.status, reviewed_by = NEW.reviewed_by, reviewed_at = NEW.reviewed_at,
         resolution_note = 'Closed together with report ' || left(NEW.id::text, 8)
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id
     AND id <> NEW.id AND status IN ('pending', 'reviewing');
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_report_close_siblings ON public.content_reports;
CREATE TRIGGER trg_report_close_siblings AFTER UPDATE OF status ON public.content_reports
  FOR EACH ROW WHEN (NEW.status IN ('resolved', 'dismissed') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.report_close_siblings();

-- ── alert when reports run past their deadline ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.alert_overdue_reports()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  WITH due AS (
    UPDATE public.content_reports SET overdue_alerted_at = now()
     WHERE status IN ('pending', 'reviewing') AND due_at < now() AND overdue_alerted_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM due;
  IF v_count > 0 THEN
    PERFORM public.notify_staff('Reports are overdue', v_count || ' report(s) passed their response target.', '/moderation', 1);
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.alert_overdue_reports() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('alert-overdue-reports', '*/15 * * * *', 'SELECT public.alert_overdue_reports()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule alert_overdue_reports (%). Call it from your own schedule.', SQLERRM;
END $$;

-- ── saved reasons and replies ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mod_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL DEFAULT 'reason' CHECK (kind IN ('reason', 'reply')),
  title      text NOT NULL,
  body       text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mod_templates_kind_title ON public.mod_templates (kind, title);
ALTER TABLE public.mod_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mod_templates_read ON public.mod_templates;
CREATE POLICY mod_templates_read ON public.mod_templates FOR SELECT USING (public.staff_rank(auth.uid()) >= 1);
DROP POLICY IF EXISTS mod_templates_write ON public.mod_templates;
CREATE POLICY mod_templates_write ON public.mod_templates FOR ALL
  USING (public.staff_rank(auth.uid()) >= 2) WITH CHECK (public.staff_rank(auth.uid()) >= 2);

INSERT INTO public.mod_templates (kind, title, body) VALUES
  ('reason', 'Spam', 'Repeated unwanted or promotional content, which breaks our spam rules.'),
  ('reason', 'Harassment', 'Targeting another member with abuse or bullying, which breaks our harassment rules.'),
  ('reason', 'Hate speech', 'Attacking people for who they are, which is not allowed anywhere on CineCraft Connect.'),
  ('reason', 'Explicit content', 'Sexual or graphic content that is not allowed on the platform.'),
  ('reason', 'Misinformation', 'Content that spreads false claims in a way that could mislead or harm others.'),
  ('reason', 'Impersonation', 'Pretending to be another person or company.'),
  ('reason', 'Fraud or scam', 'An attempt to take money or information under false pretences.'),
  ('reason', 'Not a violation', 'We reviewed this and found it does not break our rules.'),
  ('reply',  'Report received', 'Thank you for your report. We have reviewed it and taken the steps our rules call for.')
ON CONFLICT (kind, title) DO NOTHING;

-- ── a person's own standing ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_account_standing()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'is_banned', COALESCE(p.is_banned, false),
      'ban', (SELECT jsonb_build_object('reason', b.reason, 'ban_type', b.ban_type, 'expires_at', b.expires_at, 'since', b.created_at)
                FROM public.user_bans b WHERE b.user_id = v_me AND b.is_active ORDER BY b.created_at DESC LIMIT 1),
      'muted_until', CASE WHEN p.mute_expires_at > now() THEN p.mute_expires_at END,
      'strikes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', s.reason, 'created_at', s.created_at, 'expires_at', s.expires_at)
                                            ORDER BY s.created_at DESC), '[]'::jsonb)
                    FROM public.user_strikes s WHERE s.user_id = v_me AND s.revoked_at IS NULL AND s.expires_at > now()),
      'appeal', (SELECT jsonb_build_object('status', a.status, 'created_at', a.created_at, 'decision_note', a.decision_note)
                   FROM public.appeals a WHERE a.user_id = v_me ORDER BY a.created_at DESC LIMIT 1),
      'can_appeal', COALESCE(p.is_banned, false)
                    AND NOT EXISTS (SELECT 1 FROM public.appeals a WHERE a.user_id = v_me AND a.status = 'pending')
    ) FROM public.profiles p WHERE p.id = v_me
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_account_standing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_standing() TO authenticated;

COMMIT;
