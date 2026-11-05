-- PART FZ - dashboard numbers: how many people PAY, how many use the app for free, and how they split by plan and by account type. Safe to run more than once.
--
-- WHY: nobody on the team can see how many users are paying and how many are not. The finance, growth and support leads all ask this first.
-- WHAT IT ADDS: public.get_user_plan_stats(), staff only (admin and super admin), read only, returns ONE json object of counts. No names, no emails, no personal data.
-- WHO COUNTS AS WHAT (one group per person, a person is never counted twice):
--   paying     = a person with a subscription in status active or past_due that came through a payment provider, on a plan that costs money
--   trialing   = a free trial of a paid plan
--   gifted     = a paid plan given without a payment (gift, founding plan, or granted by staff)
--   beta       = everyone on the free beta (no payments are switched on yet: today this is every account)
--   free       = everyone else (no paid plan at all)
-- Every number is read in its own protected block, so a table or column that differs in your project gives a missing number (shown as "n/a"), never an error.
--
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'get_user_plan_stats';      -- 0 rows before
-- POST-CHECK  (read only): sign in as an admin or super admin and open Admin > Operations or Super admin > Overview: the "Paying and free users" card shows numbers.
--   As any other account the call is refused.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.plan_stat_json(p_sql text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j jsonb;
BEGIN
  EXECUTE p_sql INTO j;
  RETURN j;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.plan_stat_json(text) FROM PUBLIC, anon, authenticated;

-- same helper as part FX (repeated here so this file works on its own)
CREATE OR REPLACE FUNCTION public.pulse_count(p_sql text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql INTO n;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_count(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_plan_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_groups jsonb;
  v_types  jsonb;
  v_plans  jsonb;
  v_total  bigint;
  v_active bigint;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;

  -- one row per person: the best group that person belongs to
  v_groups := public.plan_stat_json($q$
    with best as (
      select s.owner_id,
             min(case
                   when s.status in ('active', 'past_due') and s.provider is not null and coalesce(p.price_monthly_minor, 0) > 0 then 1
                   when s.status = 'trialing' and coalesce(p.price_monthly_minor, 0) > 0 then 2
                   when s.status in ('active', 'past_due') and s.provider is null and coalesce(p.price_monthly_minor, 0) > 0 then 3
                   when s.status = 'beta' then 4
                   else 5
                 end) as grp
      from public.subscriptions s
      left join public.plans p on p.code = s.plan_code
      where s.owner_type = 'user'
      group by s.owner_id
    ),
    everyone as (
      select u.id, u.last_sign_in_at, coalesce(b.grp, 5) as grp
      from auth.users u left join best b on b.owner_id = u.id
    )
    select jsonb_build_object(
      'paying',   count(*) filter (where grp = 1),
      'trialing', count(*) filter (where grp = 2),
      'gifted',   count(*) filter (where grp = 3),
      'beta',     count(*) filter (where grp = 4),
      'free',     count(*) filter (where grp = 5),
      'paying_active_30d', count(*) filter (where grp = 1 and last_sign_in_at > now() - interval '30 days'),
      'free_active_30d',   count(*) filter (where grp in (4, 5) and last_sign_in_at > now() - interval '30 days'),
      'total',    count(*)
    ) from everyone
  $q$);

  v_types := public.plan_stat_json($q$
    select jsonb_build_object(
      'fan',     count(*) filter (where p.account_type = 'fan'),
      'creator', count(*) filter (where p.account_type = 'creator' or p.account_type is null),
      'studio',  count(*) filter (where p.account_type = 'studio')
    ) from public.profiles p
  $q$);

  v_plans := public.plan_stat_json($q$
    select coalesce(jsonb_agg(jsonb_build_object('plan_code', x.plan_code, 'name', x.name, 'status', x.status, 'people', x.n) order by x.n desc), '[]'::jsonb)
    from (
      select s.plan_code, p.name, s.status, count(distinct s.owner_id) as n
      from public.subscriptions s left join public.plans p on p.code = s.plan_code
      where s.owner_type = 'user' and s.status in ('beta', 'trialing', 'active', 'past_due')
      group by s.plan_code, p.name, s.status
    ) x
  $q$);

  v_total  := (v_groups ->> 'total')::bigint;
  v_active := public.pulse_count($q$ select count(*) from auth.users where last_sign_in_at > now() - interval '30 days' $q$);

  RETURN jsonb_build_object(
    'generated_at', now(),
    'groups', v_groups,
    'account_types', v_types,
    'plans', v_plans,
    'users_active_30d', v_active,
    'paid_share_pct', case when coalesce(v_total, 0) > 0 and v_groups is not null
                           then round(((v_groups ->> 'paying')::numeric / v_total) * 100, 1) else null end,
    'paying_pages', public.pulse_count($q$ select count(distinct owner_id) from public.subscriptions s join public.plans p on p.code = s.plan_code
                                          where s.owner_type = 'page' and s.status in ('active', 'past_due') and s.provider is not null and coalesce(p.price_monthly_minor, 0) > 0 $q$)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_plan_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plan_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
