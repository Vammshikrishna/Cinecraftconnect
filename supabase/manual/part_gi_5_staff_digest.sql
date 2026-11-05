-- PART GI-5 - staff digest: who gets the daily / weekly numbers email. Safe to run more than once.
--
-- WHY: owners and leads want the platform and team numbers in their inbox without opening the console.
-- WHAT IT ADDS:
--   public.staff_digest_prefs           : one row per staff member: frequency off / daily / weekly. A person OPTS IN FOR THEMSELVES.
--   staff_my_digest() / staff_set_my_digest(freq)   : any staff member reads and sets their own choice
--   staff_digest_recipients()                        : super admins see who is opted in (name, rank, frequency, last sent). No email addresses.
--   staff_digest_remove(user)                        : a super admin can switch SOMEONE ELSE OFF (never on: opting in is personal). Audit-logged.
--   digest_payload(freq)                             : ONLY the service role (the staff-digest edge function). Returns recipients with their email
--                                                      address and the numbers to include. Counts only: no names of members, no report or ticket text.
--   digest_mark_sent(ids)                            : ONLY the service role. Stamps last_sent_at.
-- This part changes no platform-wide setting, so it needs no second approval.
--
-- PREFLIGHT (read only): select to_regclass('public.staff_digest_prefs');      -- null before
-- POST-CHECK  (read only): Super admin > Digests lists opted-in staff; staff header "Email me a digest" (Super admin > Digests) saves your choice.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.staff_digest_prefs (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency     text NOT NULL DEFAULT 'off' CHECK (frequency IN ('off', 'daily', 'weekly')),
  last_sent_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_digest_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_digest_prefs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_my_digest()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('frequency', COALESCE((SELECT frequency FROM public.staff_digest_prefs WHERE user_id = auth.uid()), 'off'),
                            'last_sent_at', (SELECT last_sent_at FROM public.staff_digest_prefs WHERE user_id = auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_my_digest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_my_digest() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_my_digest(p_frequency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF p_frequency NOT IN ('off', 'daily', 'weekly') THEN RAISE EXCEPTION 'Choose off, daily or weekly'; END IF;
  INSERT INTO public.staff_digest_prefs (user_id, frequency, updated_at) VALUES (auth.uid(), p_frequency, now())
  ON CONFLICT (user_id) DO UPDATE SET frequency = EXCLUDED.frequency, updated_at = now();
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' WHEN 2 THEN 'admin' ELSE 'moderator' END,
          'staff_digest_choice', 'user', auth.uid()::text, jsonb_build_object('frequency', p_frequency));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_my_digest(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_my_digest(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_digest_recipients()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can see this' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'scheduled', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
                 AND COALESCE((SELECT true FROM cron.job j WHERE j.jobname LIKE 'staff-digest-%' LIMIT 1), false),
    'recipients', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'name', COALESCE(p.full_name, p.username, 'Staff member'),
                      'rank', public.staff_rank(d.user_id), 'frequency', d.frequency, 'last_sent_at', d.last_sent_at) ORDER BY d.frequency, COALESCE(p.full_name, p.username)), '[]'::jsonb)
                   FROM public.staff_digest_prefs d LEFT JOIN public.profiles p ON p.id = d.user_id WHERE d.frequency <> 'off'));
EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
  RETURN jsonb_build_object('scheduled', false, 'recipients', '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_digest_recipients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_digest_recipients() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_digest_remove(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  UPDATE public.staff_digest_prefs SET frequency = 'off', updated_at = now() WHERE user_id = p_user AND frequency <> 'off';
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'staff_digest_removed', 'user', p_user::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_digest_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_digest_remove(uuid) TO authenticated;

-- service role only: who gets the email and which numbers go in it
CREATE OR REPLACE FUNCTION public.digest_payload(p_frequency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_open_inc bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  IF p_frequency NOT IN ('daily', 'weekly') THEN RAISE EXCEPTION 'Unknown frequency'; END IF;
  RETURN jsonb_build_object(
    'generated_at', now(),
    'frequency', p_frequency,
    'recipients', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'email', u.email,
                      'name', COALESCE(p.full_name, p.username, 'there'), 'rank', public.staff_rank(d.user_id),
                      'finance', EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = d.user_id AND r.role::text = 'finance'))), '[]'::jsonb)
                   FROM public.staff_digest_prefs d JOIN auth.users u ON u.id = d.user_id LEFT JOIN public.profiles p ON p.id = d.user_id
                   WHERE d.frequency = p_frequency AND u.email IS NOT NULL AND public.staff_rank(d.user_id) >= 1),
    'platform', jsonb_build_object(
      'users_total',      public.team_num($q$ select count(*) from auth.users $q$),
      'users_new',        public.team_num(format($q$ select count(*) from auth.users where created_at > now() - interval '%s' $q$, CASE p_frequency WHEN 'daily' THEN '1 day' ELSE '7 days' END)),
      'users_active',     public.team_num(format($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '%s' $q$, CASE p_frequency WHEN 'daily' THEN '1 day' ELSE '7 days' END)),
      'posts',            public.team_num(format($q$ select count(*) from public.posts where created_at > now() - interval '%s' $q$, CASE p_frequency WHEN 'daily' THEN '1 day' ELSE '7 days' END)),
      'incidents_open',   public.team_num($q$ select count(*) from public.system_incidents where resolved_at is null $q$),
      'approvals_pending', public.team_num($q$ select count(*) from public.gov_approval_queue where status = 'pending' $q$),
      'staff_alerts_open', public.team_num($q$ select count(*) from public.staff_alerts where status = 'open' $q$)),
    'support', jsonb_build_object(
      'tickets_open',    public.team_num($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') $q$),
      'sla_breaches',    public.team_num($q$ select count(*) from public.support_tickets where status not in ('resolved','closed') and first_response_at is null and created_at < now() - interval '24 hours' $q$),
      'backlog_age_hours', public.team_num($q$ select round(extract(epoch from (now() - min(created_at))) / 3600) from public.support_tickets where status not in ('resolved','closed') $q$)),
    'trust', jsonb_build_object(
      'reports_open',    public.team_num($q$ select count(*) from public.content_reports where status not in ('resolved','dismissed','closed','actioned','rejected') $q$),
      'escalations',     public.team_num($q$ select count(*) from public.content_reports where status not in ('resolved','dismissed','closed','actioned','rejected') and coalesce(escalation_level, 0) > 0 $q$),
      'appeals_open',    public.team_num($q$ select count(*) from public.appeals where status = 'pending' $q$)),
    'finance', jsonb_build_object(
      'paying',          public.team_num($q$ select count(distinct s.owner_id) from public.subscriptions s join public.plans p on p.code = s.plan_code
                                            where s.owner_type = 'user' and s.status in ('active','past_due') and s.provider is not null and coalesce(p.price_monthly_minor, 0) > 0 $q$),
      'refunds_pending', public.team_num($q$ select count(*) from public.refunds where status in ('pending','requested') $q$)));
END;
$$;
REVOKE ALL ON FUNCTION public.digest_payload(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.digest_payload(text) TO service_role;

CREATE OR REPLACE FUNCTION public.digest_mark_sent(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.staff_digest_prefs SET last_sent_at = now() WHERE user_id = ANY (p_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.digest_mark_sent(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.digest_mark_sent(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
