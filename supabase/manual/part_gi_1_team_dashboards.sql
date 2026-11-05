-- PART GI-1 - per-team dashboards: counts each team needs, nothing personal. Safe to run more than once.
--
-- WHY: the owner team asked for role-appropriate numbers: support (tickets, SLA, first reply, backlog), trust and safety (reports, escalations,
-- take-downs waiting for a second person, appeals), finance (paid vs free, invoices, refunds waiting) and growth (new and active users).
-- WHAT IT ADDS: public.get_team_stats(p_team text), read only, ONE json object of counts (no names, no emails, no ticket or report text).
--   p_team = 'support'  -> admin and super admin
--   p_team = 'trust'    -> moderator, admin, super admin
--   p_team = 'finance'  -> finance role, admin, super admin
--   p_team = 'growth'   -> admin and super admin
-- Every number is read in its own protected block, so a table or column that differs in your project gives a missing number (shown as "n/a"), never an error.
-- Support SLA: an open ticket with no staff reply after 24 hours counts as a breach (change v_sla_hours below if your policy differs).
--
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'get_team_stats';      -- 0 rows before
-- POST-CHECK  (read only): open Moderation (Trust and safety card), Admin (Support, Trust, Growth), Finance, Super admin > Overview: the cards show numbers.
--   A moderator asking for 'finance' is refused.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.team_num(p_sql text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n numeric;
BEGIN
  EXECUTE p_sql INTO n;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.team_num(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_stats(p_team text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rank integer := CASE WHEN auth.uid() IS NULL THEN 0 ELSE public.staff_rank(auth.uid()) END;
  v_fin boolean := false;
  v_sla_hours integer := 24;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  v_fin := EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'finance');

  IF p_team = 'support' THEN
    IF v_rank < 2 THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('team', 'support', 'generated_at', now(),
      'tickets_open',     public.team_num($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') $q$),
      'sla_breaches',     public.team_num(format($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') and first_response_at is null and created_at < now() - interval '%s hours' $q$, v_sla_hours)),
      'first_reply_min',  public.team_num($q$ select round(avg(extract(epoch from (first_response_at - created_at)) / 60)) from public.support_tickets where first_response_at is not null and created_at > now() - interval '30 days' $q$),
      'backlog_age_hours', public.team_num($q$ select round(extract(epoch from (now() - min(created_at))) / 3600) from public.support_tickets where status not in ('resolved','closed') $q$),
      'unassigned',       public.team_num($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') and assigned_to is null $q$));
  ELSIF p_team = 'trust' THEN
    IF v_rank < 1 THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('team', 'trust', 'generated_at', now(),
      'reports_open',     public.team_num($q$ select count(*) from public.content_reports where status not in ('resolved','dismissed','closed','actioned','rejected') $q$),
      'escalations',      public.team_num($q$ select count(*) from public.content_reports where status not in ('resolved','dismissed','closed','actioned','rejected') and coalesce(escalation_level, 0) > 0 $q$),
      'takedowns_pending', public.team_num($q$ select count(*) from public.gov_approval_queue where status = 'pending' and action = 'takedown' $q$),
      'appeals_open',     public.team_num($q$ select count(*) from public.appeals where status = 'pending' $q$));
  ELSIF p_team = 'finance' THEN
    IF v_rank < 2 AND NOT v_fin THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('team', 'finance', 'generated_at', now(),
      'paying',  public.team_num($q$ select count(distinct s.owner_id) from public.subscriptions s join public.plans p on p.code = s.plan_code
                                    where s.owner_type = 'user' and s.status in ('active','past_due') and s.provider is not null and coalesce(p.price_monthly_minor, 0) > 0 $q$),
      'users_total', public.team_num($q$ select count(*) from auth.users $q$),
      'invoices_30d', public.team_num($q$ select count(*) from public.invoices where created_at > now() - interval '30 days' $q$),
      'refunds_pending', public.team_num($q$ select count(*) from public.refunds where status in ('pending','requested') $q$));
  ELSIF p_team = 'growth' THEN
    IF v_rank < 2 THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('team', 'growth', 'generated_at', now(),
      'users_total',  public.team_num($q$ select count(*) from auth.users $q$),
      'users_new_7d', public.team_num($q$ select count(*) from auth.users where created_at > now() - interval '7 days' $q$),
      'users_new_30d', public.team_num($q$ select count(*) from auth.users where created_at > now() - interval '30 days' $q$),
      'users_active_7d', public.team_num($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '7 days' $q$),
      'users_active_30d', public.team_num($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '30 days' $q$));
  END IF;
  RAISE EXCEPTION 'Unknown team';
END;
$$;
REVOKE ALL ON FUNCTION public.get_team_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_stats(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
