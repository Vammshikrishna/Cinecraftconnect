-- PART GB (account overview): the extra facts staff see on an account record. Safe to run more than once.
--
-- WHAT IT ADDS
--   * staff_account_overview(user) for admins and up. ONE json object, counts and amounts only:
--       orders     how many orders the person bought and sold, how much they paid / were paid (totals per currency), refunds and disputes
--       sessions   the devices they signed in on: device name, platform, last active, whether it is still signed in, whether it looks suspicious
--                  (no IP address, no tokens, nothing that could be used to sign in)
--       reports    reports against them and reports they filed, with the five most recent against them (reason and status, not the content)
--       warnings   active and total strikes, earlier suspensions
--   * Every block is read on its own, so a table or column that differs in your project gives a missing block (shown as "not available"), never an error.
--   * Each look is written to the audit log (who looked at which account), because it shows payment and device facts.
-- The web app keeps working before this is applied: the account record shows a short note in place of the new block.
--
-- PREFLIGHT (read only):  select proname from pg_proc where proname = 'staff_account_overview';   -- 0 rows before
-- POST-CHECK  (read only): sign in as an admin, open Admin > User Management > a person > View record: the "Orders, devices and reports" block fills in.
--   As a moderator or any other account the call is refused.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- helper that runs one read-only query and returns its json, or NULL if the query cannot run here (same idea as plan_stat_json in part FZ)
CREATE OR REPLACE FUNCTION public.overview_json(p_sql text, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j jsonb;
BEGIN
  EXECUTE p_sql INTO j USING p_user;
  RETURN j;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.overview_json(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_account_overview(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_orders   jsonb;
  v_sessions jsonb;
  v_reports  jsonb;
  v_warnings jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;

  v_orders := public.overview_json($q$
    select jsonb_build_object(
      'bought', (select count(*) from public.orders o where o.buyer_id = $1),
      'sold',   (select count(*) from public.orders o where o.seller_id = $1),
      'paid_by_currency', (select coalesce(jsonb_object_agg(x.currency, x.total), '{}'::jsonb) from (
          select o.currency, sum(o.amount_minor + o.tax_minor) as total from public.orders o
           where o.buyer_id = $1 and o.status in ('paid', 'fulfilled', 'settled', 'partially_refunded') group by o.currency) x),
      'earned_by_currency', (select coalesce(jsonb_object_agg(x.currency, x.total), '{}'::jsonb) from (
          select o.currency, sum(o.amount_minor - o.fee_minor) as total from public.orders o
           where o.seller_id = $1 and o.status in ('paid', 'fulfilled', 'settled', 'partially_refunded') group by o.currency) x),
      'refunded', (select count(*) from public.orders o where (o.buyer_id = $1 or o.seller_id = $1) and o.status in ('refunded', 'partially_refunded')),
      'disputed', (select count(*) from public.orders o where (o.buyer_id = $1 or o.seller_id = $1) and o.status = 'disputed'),
      'last_order_at', (select max(o.created_at) from public.orders o where o.buyer_id = $1 or o.seller_id = $1)
    )
  $q$, p_user);

  v_sessions := public.overview_json($q$
    select jsonb_build_object(
      'active', (select count(*) from public.user_sessions s where s.user_id = $1 and s.revoked_at is null),
      'total',  (select count(*) from public.user_sessions s where s.user_id = $1),
      'suspicious', (select count(*) from public.user_sessions s where s.user_id = $1 and s.suspicious),
      'devices', (select coalesce(jsonb_agg(jsonb_build_object(
          'device', coalesce(d.device_name, 'Unknown device'), 'platform', d.platform, 'app_version', d.app_version,
          'last_active_at', d.last_active_at, 'signed_in', d.revoked_at is null, 'suspicious', coalesce(d.suspicious, false)
        ) order by d.last_active_at desc), '[]'::jsonb) from (
          select * from public.user_sessions s where s.user_id = $1 order by s.last_active_at desc limit 10) d)
    )
  $q$, p_user);

  v_reports := public.overview_json($q$
    select jsonb_build_object(
      'against_total', (select count(*) from public.content_reports c
                         where (c.target_type = 'user' and c.target_id = $1::text)
                            or (c.target_type = 'post' and c.target_id in (select po.id::text from public.posts po where po.author_id = $1))),
      'against_open',  (select count(*) from public.content_reports c
                         where c.status in ('pending', 'reviewing')
                           and ((c.target_type = 'user' and c.target_id = $1::text)
                             or (c.target_type = 'post' and c.target_id in (select po.id::text from public.posts po where po.author_id = $1)))),
      'filed_total',   (select count(*) from public.content_reports c where c.reported_by = $1),
      'filed_dismissed', (select count(*) from public.content_reports c where c.reported_by = $1 and c.status = 'dismissed'),
      'recent_against', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'status', r.status, 'target_type', r.target_type, 'created_at', r.created_at)
                                                    order by r.created_at desc), '[]'::jsonb) from (
          select c.* from public.content_reports c
           where (c.target_type = 'user' and c.target_id = $1::text)
              or (c.target_type = 'post' and c.target_id in (select po.id::text from public.posts po where po.author_id = $1))
           order by c.created_at desc limit 5) r)
    )
  $q$, p_user);

  v_warnings := public.overview_json($q$
    select jsonb_build_object(
      'strikes_active', (select count(*) from public.user_strikes k where k.user_id = $1 and k.revoked_at is null and k.expires_at > now()),
      'strikes_total',  (select count(*) from public.user_strikes k where k.user_id = $1),
      'suspensions',    (select count(*) from public.user_bans b where b.user_id = $1),
      'last_strike_at', (select max(k.created_at) from public.user_strikes k where k.user_id = $1)
    )
  $q$, p_user);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' ELSE 'admin' END,
          'account_overview_view', 'user', p_user::text, '{}'::jsonb);

  RETURN jsonb_build_object('generated_at', now(), 'orders', v_orders, 'sessions', v_sessions, 'reports', v_reports, 'warnings', v_warnings);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_account_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_account_overview(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
