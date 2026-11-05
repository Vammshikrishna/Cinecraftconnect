-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CD: alerts on unusual staff behaviour.
-- An hourly check reads the audit log and the access grants and raises an alert when one staff member:
--   * does an unusual number of actions in an hour;
--   * does an unusual number of severe actions (bans, takedowns, role changes, forced logouts) in an hour;
--   * acts against the same person again and again in a day;
--   * is active in the quiet hours (UTC window, set below);
--   * dismisses almost every report they close, over a week;
--   * opens many private spaces or rooms in a day;
--   * closes a report that they filed themselves.
-- Only super admins see the alerts, never the person they are about. Reviewing one needs a note and two-step sign-in.
-- The thresholds are rows in platform_settings and can be changed in Super admin → Staff security.
-- Run after part CC. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  summary      text NOT NULL,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key   text NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'false_alarm')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  review_note  text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_alerts_dedupe ON public.staff_alerts (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_staff_alerts_status ON public.staff_alerts (status, created_at DESC);
ALTER TABLE public.staff_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_alerts_read ON public.staff_alerts;
-- no write policy: only the functions below change this table
CREATE POLICY staff_alerts_read ON public.staff_alerts FOR SELECT
  USING (public.staff_rank(auth.uid()) >= 3 AND staff_id <> auth.uid());

CREATE TABLE IF NOT EXISTS public.staff_behaviour_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at      timestamptz NOT NULL DEFAULT now(),
  ran_by      text NOT NULL,
  new_alerts  integer NOT NULL DEFAULT 0
);
ALTER TABLE public.staff_behaviour_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_behaviour_runs_read ON public.staff_behaviour_runs;
CREATE POLICY staff_behaviour_runs_read ON public.staff_behaviour_runs FOR SELECT USING (public.staff_rank(auth.uid()) >= 3);

-- the thresholds, with their defaults (all integers)
CREATE OR REPLACE FUNCTION public._sb_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'sb_actions_per_hour', 40,    -- any actions by one person in an hour
    'sb_severe_per_hour', 6,      -- severe actions by one person in an hour
    'sb_same_target_24h', 3,      -- actions against the same person in 24 hours
    'sb_quiet_actions_24h', 6,    -- actions inside the quiet hours in 24 hours
    'sb_quiet_start_utc', 20,     -- quiet hours start (UTC hour, 0 to 23)
    'sb_quiet_end_utc', 0,        -- quiet hours end (UTC hour, 0 to 23; may be before the start)
    'sb_dismiss_share_pct', 95,   -- share of closed reports that were dismissed, over 7 days
    'sb_dismiss_min', 20,         -- ... only counted once they closed at least this many
    'sb_grants_24h', 5);          -- private spaces or rooms opened in 24 hours
$$;

CREATE OR REPLACE FUNCTION public._sb(p_key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.billing_setting_int(p_key, (public._sb_defaults() ->> p_key)::integer);
$$;
REVOKE ALL ON FUNCTION public._sb_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sb(text) FROM PUBLIC, anon, authenticated;

-- ── the check ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.scan_staff_behaviour(p_ran_by text DEFAULT 'schedule')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_hour text := to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
  v_day text := to_char(now(), 'YYYYMMDD');
  v_week text := to_char(date_trunc('week', now()), 'IYYYIW');
  v_qs integer := public._sb('sb_quiet_start_utc');
  v_qe integer := public._sb('sb_quiet_end_utc');
  v_new integer := 0;
  r record;
BEGIN
  -- 1. many actions in the last hour
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT a.actor_id, 'many_actions', 'medium',
           'Did ' || count(*) || ' actions in the last hour (usual limit ' || public._sb('sb_actions_per_hour') || ')',
           jsonb_build_object('count', count(*), 'threshold', public._sb('sb_actions_per_hour')),
           'many_actions:' || a.actor_id || ':' || v_hour
      FROM public.audit_logs a
     WHERE a.created_at > now() - interval '1 hour' AND a.actor_id IS NOT NULL AND public.staff_rank(a.actor_id) >= 1
       AND a.action NOT IN ('report_claim') AND a.action NOT LIKE 'auto\_%'
     GROUP BY a.actor_id HAVING count(*) >= public._sb('sb_actions_per_hour')
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 2. many severe actions in the last hour
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT a.actor_id, 'many_severe_actions', 'high',
           'Did ' || count(*) || ' severe actions (bans, takedowns, role changes, forced logouts) in the last hour',
           jsonb_build_object('count', count(*), 'threshold', public._sb('sb_severe_per_hour'), 'actions', jsonb_agg(DISTINCT a.action)),
           'many_severe:' || a.actor_id || ':' || v_hour
      FROM public.audit_logs a
     WHERE a.created_at > now() - interval '1 hour' AND a.actor_id IS NOT NULL AND public.staff_rank(a.actor_id) >= 1
       AND a.action ~ '(ban|takedown|assign_role|revoke_role|force_|shadow)' AND a.action NOT LIKE 'auto\_%'
     GROUP BY a.actor_id HAVING count(*) >= public._sb('sb_severe_per_hour')
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 3. the same person targeted again and again in a day
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT t.actor_id, 'same_target', 'high',
           'Took ' || t.n || ' actions against the same person in 24 hours',
           jsonb_build_object('count', t.n, 'target', t.target, 'threshold', public._sb('sb_same_target_24h')),
           'same_target:' || t.actor_id || ':' || t.target || ':' || v_day
      FROM (
        SELECT a.actor_id, COALESCE(NULLIF(a.metadata ->> 'author_id', ''), CASE WHEN a.target_type = 'user' THEN a.target_id END) AS target, count(*) AS n
          FROM public.audit_logs a
         WHERE a.created_at > now() - interval '24 hours' AND a.actor_id IS NOT NULL AND public.staff_rank(a.actor_id) >= 1
           AND a.action ~ '(ban|takedown|warn|strike|mute|shadow|force_)' AND a.action NOT LIKE 'auto\_%'
         GROUP BY 1, 2
      ) t
     WHERE t.target IS NOT NULL AND t.n >= public._sb('sb_same_target_24h') AND t.target <> t.actor_id::text
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 4. active in the quiet hours
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT a.actor_id, 'quiet_hours', 'low',
           'Did ' || count(*) || ' actions in the quiet hours (' || v_qs || ':00 to ' || v_qe || ':00 UTC) in the last 24 hours',
           jsonb_build_object('count', count(*), 'threshold', public._sb('sb_quiet_actions_24h'), 'start_utc', v_qs, 'end_utc', v_qe),
           'quiet_hours:' || a.actor_id || ':' || v_day
      FROM public.audit_logs a
     WHERE a.created_at > now() - interval '24 hours' AND a.actor_id IS NOT NULL AND public.staff_rank(a.actor_id) >= 1
       AND a.action NOT IN ('report_claim') AND a.action NOT LIKE 'auto\_%'
       AND (CASE WHEN v_qs < v_qe THEN extract(hour FROM a.created_at AT TIME ZONE 'UTC') >= v_qs AND extract(hour FROM a.created_at AT TIME ZONE 'UTC') < v_qe
                 WHEN v_qs > v_qe THEN extract(hour FROM a.created_at AT TIME ZONE 'UTC') >= v_qs OR extract(hour FROM a.created_at AT TIME ZONE 'UTC') < v_qe
                 ELSE false END)
     GROUP BY a.actor_id HAVING count(*) >= public._sb('sb_quiet_actions_24h')
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 5. dismisses almost everything they close
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT c.reviewed_by, 'dismisses_most', 'medium',
           'Dismissed ' || c.dismissed || ' of ' || c.total || ' reports closed in the last 7 days',
           jsonb_build_object('closed', c.total, 'dismissed', c.dismissed, 'threshold_pct', public._sb('sb_dismiss_share_pct')),
           'dismisses_most:' || c.reviewed_by || ':' || v_week
      FROM (
        SELECT reviewed_by, count(*) AS total, count(*) FILTER (WHERE status = 'dismissed') AS dismissed
          FROM public.content_reports
         WHERE reviewed_at > now() - interval '7 days' AND reviewed_by IS NOT NULL AND status IN ('resolved', 'dismissed')
         GROUP BY reviewed_by
      ) c
     WHERE c.total >= public._sb('sb_dismiss_min') AND c.dismissed * 100 >= public._sb('sb_dismiss_share_pct') * c.total
       AND public.staff_rank(c.reviewed_by) >= 1
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 6. many private spaces or rooms opened in a day
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT g.user_id, 'many_access_grants', 'medium',
           'Opened ' || count(*) || ' private spaces or rooms in 24 hours',
           jsonb_build_object('count', count(*), 'threshold', public._sb('sb_grants_24h')),
           'many_grants:' || g.user_id || ':' || v_day
      FROM public.space_access_grants g
     WHERE g.created_at > now() - interval '24 hours' AND public.staff_rank(g.user_id) >= 1
     GROUP BY g.user_id HAVING count(*) >= public._sb('sb_grants_24h')
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  -- 7. closed a report they filed themselves
  FOR r IN
    INSERT INTO public.staff_alerts (staff_id, kind, severity, summary, details, dedupe_key)
    SELECT c.reviewed_by, 'closed_own_report', 'high',
           'Closed a report that they filed themselves',
           jsonb_build_object('report_id', c.id, 'status', c.status),
           'own_report:' || c.id
      FROM public.content_reports c
     WHERE c.reviewed_at > now() - interval '24 hours' AND c.reviewed_by IS NOT NULL AND c.reviewed_by = c.reported_by
       AND public.staff_rank(c.reviewed_by) >= 1
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING staff_id, summary
  LOOP
    v_new := v_new + 1;
    PERFORM public.notify_staff('Unusual staff activity', left(r.summary, 140), '/super-admin', 3, r.staff_id);
  END LOOP;

  INSERT INTO public.staff_behaviour_runs (ran_by, new_alerts) VALUES (p_ran_by, v_new);
  DELETE FROM public.staff_behaviour_runs WHERE ran_at < now() - interval '30 days';
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.scan_staff_behaviour(text) FROM PUBLIC, anon, authenticated;

-- ── what the console uses ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_behaviour_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_defaults jsonb := public._sb_defaults();
  k text;
  v_settings jsonb := '{}'::jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  FOR k IN SELECT jsonb_object_keys(v_defaults) LOOP
    v_settings := v_settings || jsonb_build_object(k, public._sb(k));
  END LOOP;
  RETURN jsonb_build_object(
    'settings', v_settings,
    'scheduled', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
                 AND COALESCE((SELECT true FROM cron.job j WHERE j.jobname = 'staff-behaviour-scan' LIMIT 1), false),
    'runs', (SELECT COALESCE(jsonb_agg(jsonb_build_object('ran_at', x.ran_at, 'ran_by', x.ran_by, 'new_alerts', x.new_alerts) ORDER BY x.ran_at DESC), '[]'::jsonb)
               FROM (SELECT * FROM public.staff_behaviour_runs ORDER BY ran_at DESC LIMIT 5) x));
EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
  RETURN jsonb_build_object('settings', v_settings, 'scheduled', false, 'runs', '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_behaviour_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_behaviour_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_behaviour_alerts(p_status text DEFAULT 'open')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'kind', a.kind, 'severity', a.severity, 'summary', a.summary, 'details', a.details,
      'status', a.status, 'created_at', a.created_at, 'reviewed_at', a.reviewed_at, 'review_note', a.review_note,
      'staff_id', a.staff_id,
      'staff_name', COALESCE(p.full_name, p.username, 'Staff member'),
      'staff_rank', public.staff_rank(a.staff_id),
      'open_for_person', (SELECT count(*) FROM public.staff_alerts o WHERE o.staff_id = a.staff_id AND o.status = 'open')
    ) ORDER BY a.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.staff_alerts
           WHERE staff_id <> auth.uid() AND (p_status = 'all' OR status = p_status)
           ORDER BY created_at DESC LIMIT 100) a
    LEFT JOIN public.profiles p ON p.id = a.staff_id);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_behaviour_alerts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_behaviour_alerts(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_review_behaviour_alert(p_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_staff uuid;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can review this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('confirmed', 'false_alarm') THEN RAISE EXCEPTION 'Choose confirmed or false alarm'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please give a reason (at least 5 characters)'; END IF;
  UPDATE public.staff_alerts
     SET status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), review_note = btrim(p_note)
   WHERE id = p_id AND status = 'open' AND staff_id <> auth.uid()
   RETURNING staff_id INTO v_staff;
  IF v_staff IS NULL THEN RAISE EXCEPTION 'Alert not found, already reviewed, or about you'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'staff_alert_' || p_status, 'staff_alert', p_id::text,
          jsonb_build_object('staff_id', v_staff, 'note', btrim(p_note)));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_review_behaviour_alert(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_review_behaviour_alert(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_behaviour_setting(p_key text, p_value integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can change this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF NOT (public._sb_defaults() ? p_key) THEN RAISE EXCEPTION 'Unknown setting'; END IF;
  IF p_key IN ('sb_quiet_start_utc', 'sb_quiet_end_utc') THEN
    IF p_value NOT BETWEEN 0 AND 23 THEN RAISE EXCEPTION 'An hour must be between 0 and 23'; END IF;
  ELSIF p_key = 'sb_dismiss_share_pct' THEN
    IF p_value NOT BETWEEN 50 AND 100 THEN RAISE EXCEPTION 'A percentage must be between 50 and 100'; END IF;
  ELSIF p_value NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'The value must be between 1 and 1000';
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by) VALUES (p_key, to_jsonb(p_value), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'staff_behaviour_setting', 'platform_setting', p_key, jsonb_build_object('value', p_value));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_behaviour_setting(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_behaviour_setting(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_run_behaviour_scan()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can run this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN public.scan_staff_behaviour('manual');
END;
$$;
REVOKE ALL ON FUNCTION public.staff_run_behaviour_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_run_behaviour_scan() TO authenticated;

-- every hour at :40 (needs the pg_cron extension; without it a super admin can press Run now)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'staff-behaviour-scan';
      PERFORM cron.schedule('staff-behaviour-scan', '40 * * * *', $cron$SELECT public.scan_staff_behaviour('schedule');$cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule the staff behaviour scan (%). Run it from Super admin instead.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. A super admin can run the staff behaviour scan from Super admin → Staff security.';
  END IF;
END $$;

COMMIT;
