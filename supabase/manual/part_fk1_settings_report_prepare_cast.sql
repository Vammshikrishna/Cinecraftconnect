-- PART FK1 - fix "malformed array literal: not_credible": nobody with a new account could send a report (HTTP 400 from content_reports). Safe to run more than once.
--
-- WHAT WENT WRONG: the trigger function report_prepare (part DP) adds tags to content_reports.auto_actions (a text[] column) with
--   NEW.auto_actions || 'not_credible'
-- Postgres reads a bare quoted word next to an array as another ARRAY, so it tries to parse "not_credible" as an array literal and the whole
-- insert fails. A reporter counts as "not credible" until they have some history, so every new account hit it. Same for flood_queued,
-- trusted_reporter, low_reliability, hide and child_safety.
-- THE FIX: the same function, only with each appended tag cast to text ('not_credible'::text). Nothing else changes.
--
-- PREFLIGHT (read only): select prosrc like '%|| ''not_credible'';%' from pg_proc where proname = 'report_prepare' and pronamespace = 'public'::regnamespace;   -- true now
-- POST-CHECK  (read only): the same query returns false; then report any post from a brand-new account: the report is accepted.

BEGIN;

CREATE OR REPLACE FUNCTION public.report_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open integer;
  v_up integer;
  v_dis integer;
  v_rule record;
  v_author uuid;
  v_is_system boolean;
  v_cred boolean;
  v_flood boolean;
  c_target_hourly_limit CONSTANT integer := 10;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      NEW.due_at := LEAST(COALESCE(OLD.due_at, 'infinity'::timestamptz), now() + public.report_due_interval(NEW.priority));
    END IF;
    RETURN NEW;
  END IF;

  NEW.evidence := public._report_snapshot(NEW.target_type, NEW.target_id);
  v_author := public._report_target_author(NEW.target_type, NEW.target_id);

  v_is_system := NEW.reported_by IS NULL OR COALESCE(NEW.source, 'user') <> 'user';
  -- system cases count as credible (as before); people only when they pass the credibility test
  v_cred := v_is_system OR public.dp_reporter_is_credible(NEW.reported_by);
  IF NOT v_cred THEN NEW.auto_actions := NEW.auto_actions || 'not_credible'::text; END IF;

  -- flood limit: how many reports did this target get in the last hour (all reporters, this one not yet saved)
  SELECT count(*)::int >= c_target_hourly_limit INTO v_flood FROM public.content_reports r
   WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id AND r.created_at > now() - interval '1 hour';
  IF v_flood THEN NEW.auto_actions := NEW.auto_actions || 'flood_queued'::text; END IF;

  SELECT count(*) FILTER (WHERE status = 'resolved')::int, count(*) FILTER (WHERE status = 'dismissed')::int
    INTO v_up, v_dis FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
  IF v_flood THEN
    NULL; -- queued: priority stays as it came in
  ELSIF v_up + v_dis >= 5 AND v_up::numeric / (v_up + v_dis) >= 0.8 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := CASE WHEN NEW.priority = 'low' THEN 'medium' ELSE 'high' END;
    NEW.auto_actions := NEW.auto_actions || 'trusted_reporter'::text;
  ELSIF v_dis >= 8 AND v_up::numeric / GREATEST(v_up + v_dis, 1) <= 0.1 THEN
    NEW.priority := 'low';
    NEW.auto_actions := NEW.auto_actions || 'low_reliability'::text;
  END IF;

  -- how many independent CREDIBLE sources (this report included, if it is credible) have an open report on the same thing
  v_open := public.dp_credible_reporter_count(NEW.target_type, NEW.target_id, NEW.reported_by, v_is_system);
  IF v_flood OR NOT v_cred THEN
    NULL; -- queued or not credible: stored and visible to staff, but no escalation
  ELSIF v_open >= 5 AND public.report_priority_rank(NEW.priority) < 4 THEN
    NEW.priority := 'urgent';
  ELSIF v_open >= 3 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := 'high';
  END IF;

  SELECT * INTO v_rule FROM public._apply_rules(NEW.target_type, NEW.reason, v_open, NEW.evidence, v_author);
  IF NOT v_flood AND v_rule.o_priority IS NOT NULL AND public.report_priority_rank(v_rule.o_priority) > public.report_priority_rank(NEW.priority) THEN
    NEW.priority := v_rule.o_priority;
  END IF;
  -- an automatic hide (soft, reversible: see the header) needs a credible reporter and no flood
  IF v_rule.o_hide AND v_cred AND NOT v_flood THEN NEW.auto_actions := NEW.auto_actions || 'hide'::text; END IF;
  IF array_length(v_rule.o_names, 1) > 0 THEN NEW.auto_actions := NEW.auto_actions || ('rule:' || array_to_string(v_rule.o_names, ', '))::text; END IF;

  NEW.due_at := now() + public.report_due_interval(NEW.priority);

  -- the fast lane overrides everything above, including a low-reliability reporter
  IF NEW.reason = 'child_safety' THEN
    NEW.fast_lane := true;
    NEW.priority := 'urgent';
    NEW.status := 'pending';
    IF NOT ('hide' = ANY (NEW.auto_actions)) THEN NEW.auto_actions := NEW.auto_actions || 'hide'::text; END IF;
    NEW.auto_actions := array_remove(NEW.auto_actions, 'low_reliability') || 'child_safety'::text;
    NEW.due_at := now() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
