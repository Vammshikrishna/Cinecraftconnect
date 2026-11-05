-- PART FX (super admin, 2) - "Overview": one screen that tells the owner team how the platform is doing right now. Safe to run more than once.
--
-- WHY: the Super admin console opens on approvals and settings, but nobody can see the basics at a glance: how many people joined this week, how much
-- is being posted and messaged, how many reports / support tickets / legal requests / incidents are still open, how many decisions are waiting.
-- The CEO, the trust-and-safety lead, the support lead and the compliance lead each need a different number from this list.
-- WHAT IT ADDS: public.get_platform_pulse(), super admins only, read only, returns ONE json object of counts (no personal data, no names, no emails).
-- Every number is read in its own protected block, so a table or column that differs in your project gives a missing number (shown as "n/a"), never an error.
--
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'get_platform_pulse';      -- 0 rows before
-- POST-CHECK  (read only): sign in as a super admin and open Super admin > Overview: the cards show numbers. As anyone else the call is refused.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.pulse_count(p_sql text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql INTO n;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;          -- a missing table or column means "not available", not a broken screen
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_count(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_pulse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Super admins only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'generated_at', now(),
    'users_total',        public.pulse_count($q$ select count(*) from auth.users $q$),
    'users_new_7d',       public.pulse_count($q$ select count(*) from auth.users where created_at > now() - interval '7 days' $q$),
    'users_new_30d',      public.pulse_count($q$ select count(*) from auth.users where created_at > now() - interval '30 days' $q$),
    'users_active_7d',    public.pulse_count($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '7 days' $q$),
    'users_active_30d',   public.pulse_count($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '30 days' $q$),
    'posts_7d',           public.pulse_count($q$ select count(*) from public.posts where created_at > now() - interval '7 days' $q$),
    'messages_7d',        public.pulse_count($q$ select count(*) from public.direct_messages where created_at > now() - interval '7 days' $q$),
    'jobs_open',          public.pulse_count($q$ select count(*) from public.jobs where is_active and not coalesce(is_draft, false) $q$),
    'projects_total',     public.pulse_count($q$ select count(*) from public.projects $q$),
    'reports_open',       public.pulse_count($q$ select count(*) from public.content_reports where status not in ('resolved','dismissed','closed','actioned','rejected') $q$),
    'tickets_open',       public.pulse_count($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') $q$),
    'legal_open',         public.pulse_count($q$ select count(*) from public.legal_requests where status <> 'closed' $q$),
    'incidents_open',     public.pulse_count($q$ select count(*) from public.system_incidents where resolved_at is null $q$),
    'approvals_pending',  public.pulse_count($q$ select count(*) from public.gov_approval_queue where status = 'pending' $q$),
    'staff_total',        public.pulse_count($q$ select count(distinct user_id) from public.user_roles $q$)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_platform_pulse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_pulse() TO authenticated;

NOTIFY pgrst, 'reload schema';
