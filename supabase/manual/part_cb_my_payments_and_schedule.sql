-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_cb: "My payments" for users, and the scheduled billing jobs
--
--   1. my_billing()               one call for the user's own page: current plan and when it renews, the products they hold,
--                                 gifts that are active, every payment with its receipt number, and their payouts if they sell
--   2. billing_set_cancel_flag()  server only: mark a subscription to end (or not) at the end of the period, after the provider
--                                 has been told
--   3. billing_run_scheduled_jobs()  ends what has run out: trials and founding periods, unaccepted gifts, checkouts nobody
--                                 finished, paid products and verification badges, lapsed payments, expired staff access.
--                                 Scheduled hourly with pg_cron when the extension is available; a super admin can also run
--                                 it by hand and sees when it last ran.
--
-- Run after part_ca. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.my_billing()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('mode', public.billing_mode()); END IF;

  SELECT jsonb_build_object(
           'plan_code', s.plan_code, 'plan_name', COALESCE(pl.name, s.plan_code), 'status', s.status, 'interval', s.billing_interval,
           'period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end,
           'paid', s.provider IS NOT NULL AND s.status IN ('active', 'past_due'),
           'price_minor', CASE WHEN s.billing_interval = 'yearly' THEN pl.price_yearly_minor ELSE pl.price_monthly_minor END,
           'currency', pl.currency
         ) INTO v_sub
  FROM public.subscriptions s LEFT JOIN public.plans pl ON pl.code = s.plan_code
  WHERE s.owner_type = 'user' AND s.owner_id = auth.uid() AND s.status IN ('beta', 'trialing', 'active', 'past_due')
  LIMIT 1;

  RETURN jsonb_build_object(
    'mode', public.billing_mode(),
    'subscription', v_sub,
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', g.product_code, 'name', COALESCE(pd.name, g.product_code), 'valid_until', g.valid_until, 'uses_remaining', g.uses_remaining) ORDER BY g.valid_until)
      FROM public.product_grants g LEFT JOIN public.products pd ON pd.code = g.product_code
      WHERE g.owner_id = auth.uid() AND g.status = 'active' AND g.valid_until > now()
    ), '[]'::jsonb),
    'gifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'label', COALESCE(pl.name, gf.feature_key), 'from_name', gf.from_name,
               'until', CASE WHEN gf.applied_at IS NULL THEN NULL ELSE gf.applied_at + make_interval(days => gf.days) END,
               'starts_when_live', gf.applied_at IS NULL) ORDER BY gf.accepted_at DESC)
      FROM public.gifts gf LEFT JOIN public.plans pl ON pl.code = gf.plan_code
      WHERE gf.recipient_id = auth.uid() AND gf.status = 'accepted'
        AND (gf.applied_at IS NULL OR gf.applied_at + make_interval(days => gf.days) > now())
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT o.id, 'CC-' || upper(left(o.id::text, 8)) AS receipt, o.kind, COALESCE(pr.name, pl.name, o.kind) AS item,
               (o.amount_minor + o.tax_minor) AS amount_minor, o.tax_minor, o.currency, o.status, o.created_at,
               (SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured') AS paid_at,
               COALESCE((SELECT sum(r.amount_minor) FROM public.refunds r WHERE r.order_id = o.id AND r.status = 'processed'), 0)::bigint AS refunded_minor,
               (SELECT d.status FROM public.disputes d WHERE d.order_id = o.id ORDER BY d.created_at DESC LIMIT 1) AS dispute_status,
               (o.status IN ('paid', 'fulfilled', 'settled') AND o.created_at > now() - interval '60 days') AS can_report
        FROM public.orders o
        LEFT JOIN public.products pr ON pr.code = o.product_code
        LEFT JOIN public.plans pl ON pl.code = o.plan_code
        WHERE o.buyer_id = auth.uid() AND o.status NOT IN ('created', 'expired')
        ORDER BY o.created_at DESC LIMIT 50
      ) x
    ), '[]'::jsonb),
    'payouts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', po.id, 'amount_minor', po.amount_minor, 'currency', po.currency, 'status', po.status, 'created_at', po.created_at, 'paid_at', po.paid_at) ORDER BY po.created_at DESC)
      FROM public.payouts po WHERE po.seller_id = auth.uid() AND po.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_billing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_billing() TO authenticated;

-- server only: called by the manage-subscription edge function after the provider has been told
CREATE OR REPLACE FUNCTION public.billing_set_cancel_flag(p_user uuid, p_cancel boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only'; END IF;
  SELECT s.id, s.provider, s.provider_subscription_id, s.status INTO v_row
  FROM public.subscriptions s
  WHERE s.owner_type = 'user' AND s.owner_id = p_user AND s.status IN ('active', 'past_due') AND s.provider IS NOT NULL
  LIMIT 1;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'There is no paid subscription to change'; END IF;
  UPDATE public.subscriptions SET cancel_at_period_end = p_cancel, updated_at = now() WHERE id = v_row.id;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (CASE WHEN p_cancel THEN 'billing.cancel_requested' ELSE 'billing.cancel_withdrawn' END, p_user, v_row.id::text, 'subscription', 'Requested by the subscriber', '{}'::jsonb);
  RETURN jsonb_build_object('provider', v_row.provider, 'provider_subscription_id', v_row.provider_subscription_id);
END;
$$;
REVOKE ALL ON FUNCTION public.billing_set_cancel_flag(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_set_cancel_flag(uuid, boolean) TO service_role;

-- the provider has to be told BEFORE the flag is set, so the edge function first asks which subscription this is
CREATE OR REPLACE FUNCTION public.billing_my_provider_subscription(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('provider', s.provider, 'provider_subscription_id', s.provider_subscription_id)
  FROM public.subscriptions s
  WHERE s.owner_type = 'user' AND s.owner_id = p_user AND s.status IN ('active', 'past_due') AND s.provider IS NOT NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.billing_my_provider_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_my_provider_subscription(uuid) TO service_role;


-- ── scheduled jobs ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_job_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at      timestamptz NOT NULL DEFAULT now(),
  ran_by      text NOT NULL DEFAULT 'schedule',
  result      jsonb NOT NULL,
  duration_ms integer
);
ALTER TABLE public.billing_job_runs ENABLE ROW LEVEL SECURITY;   -- no policy: read through staff_billing_jobs_status()

CREATE OR REPLACE FUNCTION public.billing_run_scheduled_jobs(p_ran_by text DEFAULT 'schedule')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started timestamptz := clock_timestamp();
  v_live boolean := public.billing_mode() = 'live';
  v_result jsonb := '{}'::jsonb;
  v_n integer;
BEGIN
  -- trials and founding periods that have ended
  v_result := v_result || jsonb_build_object('subscriptions_expired', public.billing_expire_subscriptions());

  -- gifts nobody accepted in time
  UPDATE public.gifts SET status = 'expired' WHERE status IN ('sent', 'opened') AND expires_at <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('gifts_expired', v_n);

  -- checkouts that were never finished
  UPDATE public.orders SET status = 'expired', updated_at = now() WHERE status = 'awaiting_payment' AND expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_result := v_result || jsonb_build_object('checkouts_expired', v_n);

  IF v_live THEN
    -- a subscription set to end whose period is over (the provider's own notice normally arrives first)
    UPDATE public.subscriptions SET status = 'cancelled', updated_at = now()
     WHERE status = 'active' AND cancel_at_period_end AND current_period_end IS NOT NULL AND current_period_end <= now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_result := v_result || jsonb_build_object('subscriptions_ended', v_n);

    -- a payment that has failed for a week: access ends
    UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE status = 'past_due' AND updated_at < now() - interval '7 days';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_result := v_result || jsonb_build_object('past_due_expired', v_n);

    -- paid products, seller listings and verification badges
    v_result := v_result || jsonb_build_object('products', public.billing_expire_products());
  ELSE
    v_result := v_result || jsonb_build_object('products', 'skipped in beta');
  END IF;

  v_result := v_result || jsonb_build_object('staff_access_expired', public.purge_expired_staff_access());

  INSERT INTO public.billing_job_runs (ran_by, result, duration_ms)
  VALUES (p_ran_by, v_result, (extract(epoch FROM clock_timestamp() - v_started) * 1000)::int);
  DELETE FROM public.billing_job_runs WHERE ran_at < now() - interval '90 days';
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_run_scheduled_jobs(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_run_scheduled_jobs(text) TO service_role;

-- a super admin can run it now, and see when it last ran
CREATE OR REPLACE FUNCTION public.staff_run_billing_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only a super admin can run the billing jobs'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  RETURN public.billing_run_scheduled_jobs('manual');
END;
$$;
REVOKE ALL ON FUNCTION public.staff_run_billing_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_run_billing_jobs() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_billing_jobs_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled boolean := false;
  v_schedule text;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only a super admin can see this'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT true, schedule FROM cron.job WHERE jobname = ''billing-scheduled-jobs'' LIMIT 1' INTO v_scheduled, v_schedule;
  END IF;
  RETURN jsonb_build_object(
    'scheduled', COALESCE(v_scheduled, false),
    'schedule', v_schedule,
    'cron_available', to_regclass('cron.job') IS NOT NULL,
    'runs', COALESCE((SELECT jsonb_agg(jsonb_build_object('ran_at', r.ran_at, 'ran_by', r.ran_by, 'result', r.result, 'duration_ms', r.duration_ms) ORDER BY r.ran_at DESC)
                        FROM (SELECT * FROM public.billing_job_runs ORDER BY ran_at DESC LIMIT 8) r), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_billing_jobs_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_billing_jobs_status() TO authenticated;

-- schedule it every hour, at 15 past, when pg_cron is installed (Dashboard > Database > Extensions > pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'billing-scheduled-jobs';
      PERFORM cron.schedule('billing-scheduled-jobs', '15 * * * *', $cron$SELECT public.billing_run_scheduled_jobs('schedule');$cron$);
      RAISE NOTICE 'Scheduled billing-scheduled-jobs hourly.';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron is installed but the job could not be scheduled (%). Schedule billing_run_scheduled_jobs() by hand.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. Enable it, or call billing_run_scheduled_jobs() hourly from a scheduled edge function. A super admin can also run it from the Billing tab.';
  END IF;
END $$;

-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- SELECT public.my_billing();                -- as a normal user: your plan, products, gifts, payments and payouts
-- Billing tab → Scheduled jobs: "Run now" runs it and shows what it ended; the list shows the last runs.
