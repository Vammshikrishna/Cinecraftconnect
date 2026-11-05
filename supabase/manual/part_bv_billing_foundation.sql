-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bv: billing foundation. Everything is built now; nothing is charged until a super admin flips the switch
--
-- The app is in BETA: every feature is free for everybody. This part adds the structure payments will need, so that
-- turning them on later is a configuration change (connect a provider, review the impact report, flip the mode), not
-- a rebuild. While billing_mode is 'beta' nothing here changes what anybody can do.
--
--   1. Mode            platform_settings: billing_mode ('beta' or 'live'), billing_beta_ends_at, payments_enabled
--   2. Plans           plans, plan_entitlements   what each plan includes (a feature on/off, or a limit)
--   3. Subscriptions   one live subscription per person or company page; status 'beta' for the free period,
--                      entitlement_overrides for founding members, comps and trials
--   4. Entitlements    my_entitlements() for the screens, has_entitlement() and entitlement_limit() for the database;
--                      in beta they answer "yes, unlimited" to everything
--   5. Limits          triggers on the tables that have plan limits (projects, project spaces, private rooms, portfolio
--                      items, job postings). They do nothing in beta; in live mode they refuse the row over the limit
--   6. Money tables    orders, payments, refunds, an append-only ledger, fee rules and the provider event log
--   7. Events          billing_apply_event(): the one function that moves orders and subscriptions, called only by the
--                      server after it has verified a provider's webhook
--   8. Admin           the impact report ("who would hit a limit if we went live"), the mode switch, founding-member grants
--
-- Staff accounts never buy or sell (see docs/STAFF_ACCOUNT_RULES.md), so they have no plan and the limits skip them.
-- Run after part_bu. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── 1. mode ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT s.value #>> '{}' FROM public.platform_settings s WHERE s.key = 'billing_mode'), 'beta');
$$;
GRANT EXECUTE ON FUNCTION public.billing_mode() TO authenticated, anon;

INSERT INTO public.platform_settings (key, value) VALUES ('billing_mode', '"beta"'::jsonb) ON CONFLICT (key) DO NOTHING;
INSERT INTO public.platform_settings (key, value) VALUES ('payments_enabled', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;


-- ── 2. plans ────────────────────────────────────────────────────────────────────────────────────
-- The prices and limits below are the draft from the app's pricing file. They are NOT active until you decide the model.
CREATE TABLE IF NOT EXISTS public.plans (
  code                 text PRIMARY KEY,
  name                 text NOT NULL,
  audience             text NOT NULL DEFAULT 'person' CHECK (audience IN ('person', 'organization')),
  description          text,
  price_monthly_minor  integer NOT NULL DEFAULT 0 CHECK (price_monthly_minor >= 0),
  price_yearly_minor   integer NOT NULL DEFAULT 0 CHECK (price_yearly_minor >= 0),
  currency             text NOT NULL DEFAULT 'INR' CHECK (char_length(currency) = 3),
  trial_days           integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  is_default           boolean NOT NULL DEFAULT false,   -- the plan someone has when they hold no subscription
  is_active            boolean NOT NULL DEFAULT false,   -- may be bought
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_one_default ON public.plans (audience) WHERE is_default;

-- value: true / false for a feature, a number for a limit, null (JSON null) for "unlimited"
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_code  text NOT NULL REFERENCES public.plans(code) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  PRIMARY KEY (plan_code, key)
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_read ON public.plans;
CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS plan_entitlements_read ON public.plan_entitlements;
CREATE POLICY plan_entitlements_read ON public.plan_entitlements FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.plans (code, name, audience, description, price_monthly_minor, price_yearly_minor, is_default, is_active, sort_order) VALUES
  ('fan',         'Fan',                'person',       'Follow, rate and join public discussions.',                               0,      0,       true,  true,  1),
  ('creator_pro', 'Creator Pro',        'person',       'Publish, message everyone, build a portfolio and run projects.',          29900,  249900,  false, false, 2),
  ('studio',      'Studio / Company',   'organization', 'A verified company page, unlimited projects, announcements and analytics.', 299900, 2499900, false, false, 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_code, key, value) VALUES
  ('fan',         'posts.create',            'false'),
  ('fan',         'dm.creators',             'false'),
  ('fan',         'rooms.private.max',       '0'),
  ('fan',         'portfolio.items.max',     '0'),
  ('fan',         'projects.max',            '0'),
  ('fan',         'analytics.advanced',      'false'),
  ('creator_pro', 'posts.create',            'true'),
  ('creator_pro', 'dm.creators',             'true'),
  ('creator_pro', 'rooms.private.max',       '3'),
  ('creator_pro', 'portfolio.items.max',     'null'),
  ('creator_pro', 'projects.max',            '3'),
  ('creator_pro', 'analytics.advanced',      'true'),
  ('creator_pro', 'verified.badge',          'true'),
  ('creator_pro', 'promotions.buy',          'true'),
  ('studio',      'posts.create',            'true'),
  ('studio',      'dm.creators',             'true'),
  ('studio',      'rooms.private.max',       'null'),
  ('studio',      'portfolio.items.max',     'null'),
  ('studio',      'projects.max',            'null'),
  ('studio',      'jobs.active.max',         'null'),
  ('studio',      'team.seats.max',          '10'),
  ('studio',      'analytics.advanced',      'true'),
  ('studio',      'company.page.verified',   'true'),
  ('studio',      'promotions.buy',          'true')
ON CONFLICT (plan_code, key) DO NOTHING;


-- ── 3. subscriptions and overrides ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type               text NOT NULL CHECK (owner_type IN ('user', 'page')),
  owner_id                 uuid NOT NULL,
  plan_code                text NOT NULL REFERENCES public.plans(code),
  status                   text NOT NULL CHECK (status IN ('beta', 'trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_interval         text CHECK (billing_interval IN ('monthly', 'yearly')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
-- one subscription that counts, per person or page
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_current
  ON public.subscriptions (owner_type, owner_id) WHERE status IN ('beta', 'trialing', 'active', 'past_due');
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_ref
  ON public.subscriptions (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;

-- comps, founding members, trials and one-off exceptions: a single feature or limit for one owner, with an end date
CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type  text NOT NULL CHECK (owner_type IN ('user', 'page')),
  owner_id    uuid NOT NULL,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  reason      text NOT NULL,
  expires_at  timestamptz,
  granted_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entitlement_overrides_owner ON public.entitlement_overrides (owner_type, owner_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_read_own ON public.subscriptions;
CREATE POLICY subscriptions_read_own ON public.subscriptions FOR SELECT TO authenticated
  USING (
    (owner_type = 'user' AND owner_id = auth.uid())
    OR (owner_type = 'page' AND EXISTS (SELECT 1 FROM public.company_page_admins a WHERE a.page_id = subscriptions.owner_id AND a.user_id = auth.uid()))
  );
-- no write policies: only the functions below (and the server) change subscriptions and overrides


-- ── 4. entitlements ─────────────────────────────────────────────────────────────────────────────
-- merge rule when several sources apply: a feature is on if ANY source says on; a limit is the HIGHEST number, and
-- "unlimited" (JSON null) beats every number
CREATE OR REPLACE FUNCTION public._merge_entitlement(a jsonb, b jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF a IS NULL THEN RETURN b; END IF;
  IF b IS NULL THEN RETURN a; END IF;
  IF a = 'null'::jsonb OR b = 'null'::jsonb THEN RETURN 'null'::jsonb; END IF;
  IF jsonb_typeof(a) = 'boolean' AND jsonb_typeof(b) = 'boolean' THEN RETURN to_jsonb((a)::text::boolean OR (b)::text::boolean); END IF;
  IF jsonb_typeof(a) = 'number' AND jsonb_typeof(b) = 'number' THEN RETURN CASE WHEN (a)::text::numeric >= (b)::text::numeric THEN a ELSE b END; END IF;
  RETURN b;
END;
$$;

-- what this person gets under the rules of the paid plans, ignoring beta mode (the impact report uses this)
CREATE OR REPLACE FUNCTION public.resolve_entitlements(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_rec record;
  v_has_person_sub boolean := false;
BEGIN
  -- 1. the person's own subscription, or the default plan
  FOR v_rec IN
    SELECT pe.key, pe.value
    FROM public.subscriptions s
    JOIN public.plan_entitlements pe ON pe.plan_code = s.plan_code
    WHERE s.owner_type = 'user' AND s.owner_id = p_user
      AND s.status IN ('beta', 'trialing', 'active', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LOOP
    v_has_person_sub := true;
    v_result := jsonb_set(v_result, ARRAY[v_rec.key], public._merge_entitlement(v_result -> v_rec.key, v_rec.value), true);
  END LOOP;

  IF NOT v_has_person_sub THEN
    FOR v_rec IN
      SELECT pe.key, pe.value
      FROM public.plans p
      JOIN public.plan_entitlements pe ON pe.plan_code = p.code
      WHERE p.is_default AND p.audience = 'person'
    LOOP
      v_result := jsonb_set(v_result, ARRAY[v_rec.key], public._merge_entitlement(v_result -> v_rec.key, v_rec.value), true);
    END LOOP;
  END IF;

  -- 2. a company page they run (a studio plan covers its admins)
  FOR v_rec IN
    SELECT pe.key, pe.value
    FROM public.company_page_admins a
    JOIN public.subscriptions s ON s.owner_type = 'page' AND s.owner_id = a.page_id
         AND s.status IN ('beta', 'trialing', 'active', 'past_due')
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
    JOIN public.plan_entitlements pe ON pe.plan_code = s.plan_code
    WHERE a.user_id = p_user
  LOOP
    v_result := jsonb_set(v_result, ARRAY[v_rec.key], public._merge_entitlement(v_result -> v_rec.key, v_rec.value), true);
  END LOOP;

  -- 3. exceptions granted to this person
  FOR v_rec IN
    SELECT o.key, o.value FROM public.entitlement_overrides o
    WHERE o.owner_type = 'user' AND o.owner_id = p_user AND (o.expires_at IS NULL OR o.expires_at > now())
  LOOP
    v_result := jsonb_set(v_result, ARRAY[v_rec.key], public._merge_entitlement(v_result -> v_rec.key, v_rec.value), true);
  END LOOP;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_entitlements(uuid) FROM PUBLIC;

-- for the screens: the mode, when beta ends, the plan, and what is unlocked
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := public.billing_mode();
  v_sub record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('mode', v_mode, 'all_unlocked', v_mode = 'beta', 'entitlements', '{}'::jsonb);
  END IF;

  SELECT s.plan_code, s.status, s.current_period_end, s.cancel_at_period_end INTO v_sub
  FROM public.subscriptions s
  WHERE s.owner_type = 'user' AND s.owner_id = auth.uid() AND s.status IN ('beta', 'trialing', 'active', 'past_due')
  LIMIT 1;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'beta_ends_at', (SELECT s.value #>> '{}' FROM public.platform_settings s WHERE s.key = 'billing_beta_ends_at'),
    'all_unlocked', v_mode = 'beta',
    'plan', COALESCE(v_sub.plan_code, (SELECT p.code FROM public.plans p WHERE p.is_default AND p.audience = 'person')),
    'status', v_sub.status,
    'period_end', v_sub.current_period_end,
    'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
    'entitlements', public.resolve_entitlements(auth.uid())
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_entitlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated, anon;

-- for the database: a yes or no, and a limit (NULL = unlimited). In beta both say "everything, unlimited".
CREATE OR REPLACE FUNCTION public.has_entitlement(p_user uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
BEGIN
  IF public.billing_mode() = 'beta' THEN RETURN true; END IF;
  v_value := public.resolve_entitlements(p_user) -> p_key;
  IF v_value IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(v_value) = 'boolean' THEN RETURN (v_value)::text::boolean; END IF;
  IF v_value = 'null'::jsonb THEN RETURN true; END IF;                          -- unlimited
  IF jsonb_typeof(v_value) = 'number' THEN RETURN (v_value)::text::numeric > 0; END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.has_entitlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.entitlement_limit(p_user uuid, p_key text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
BEGIN
  IF public.billing_mode() = 'beta' THEN RETURN NULL; END IF;
  v_value := public.resolve_entitlements(p_user) -> p_key;
  IF v_value IS NULL THEN RETURN 0; END IF;                                      -- not in any plan: none allowed
  IF v_value = 'null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(v_value) = 'number' THEN RETURN (v_value)::text::integer; END IF;
  IF jsonb_typeof(v_value) = 'boolean' THEN RETURN CASE WHEN (v_value)::text::boolean THEN NULL ELSE 0 END; END IF;
  RETURN 0;
END;
$$;
REVOKE ALL ON FUNCTION public.entitlement_limit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.entitlement_limit(uuid, text) TO authenticated;


-- ── 5. limits: wired now, silent in beta ────────────────────────────────────────────────────────
-- how many of a thing this person has already (the same counting is used by the impact report)
CREATE OR REPLACE FUNCTION public.count_for_limit(p_key text, p_user uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v integer := 0;
BEGIN
  IF p_key = 'projects.max' THEN
    SELECT count(*)::int INTO v FROM public.projects WHERE creator_id = p_user;
  ELSIF p_key = 'rooms.private.max' THEN
    SELECT count(*)::int INTO v FROM public.discussion_rooms WHERE creator_id = p_user AND room_type IN ('private', 'secret');
  ELSIF p_key = 'portfolio.items.max' THEN
    SELECT count(*)::int INTO v FROM public.portfolio_items WHERE user_id = p_user;
  ELSIF p_key = 'jobs.active.max' THEN
    SELECT count(*)::int INTO v FROM public.jobs WHERE posted_by = p_user AND is_active;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.count_for_limit(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_for_limit(text, uuid) TO authenticated;

-- TG_ARGV[0] = the column holding the owner, TG_ARGV[1] = the limit key
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_limit integer;
  v_count integer;
BEGIN
  IF public.billing_mode() = 'beta' THEN RETURN NEW; END IF;   -- beta: nothing is limited
  BEGIN
    v_owner := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_owner IS NULL OR public.is_staff_user(v_owner) THEN RETURN NEW; END IF;
  -- a private room limit only counts private rooms
  IF TG_ARGV[1] = 'rooms.private.max' AND COALESCE(to_jsonb(NEW) ->> 'room_type', 'public') NOT IN ('private', 'secret') THEN
    RETURN NEW;
  END IF;
  IF TG_ARGV[1] = 'jobs.active.max' AND COALESCE((to_jsonb(NEW) ->> 'is_active')::boolean, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_limit := public.entitlement_limit(v_owner, TG_ARGV[1]);
  IF v_limit IS NULL THEN RETURN NEW; END IF;                  -- unlimited on this plan
  v_count := public.count_for_limit(TG_ARGV[1], v_owner);
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your plan allows % of these. Upgrade to add more.', v_limit
      USING ERRCODE = 'P0001', HINT = 'plan_limit:' || TG_ARGV[1];
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  pair text[];
  pairs text[][] := ARRAY[
    ['projects', 'creator_id', 'projects.max'],
    ['discussion_rooms', 'creator_id', 'rooms.private.max'],
    ['portfolio_items', 'user_id', 'portfolio.items.max'],
    ['jobs', 'posted_by', 'jobs.active.max']
  ];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = pair[1] AND c.column_name = pair[2]) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'enforce_plan_limit_' || pair[3], pair[1]);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit(%L, %L)',
                     'enforce_plan_limit_' || pair[3], pair[1], pair[2], pair[3]);
    END IF;
  END LOOP;
END $$;


-- ── 6. money tables (no provider connected, nothing writes to them yet) ─────────────────────────
-- Money is an integer in the smallest unit (paise, cents) plus a currency. Never a decimal.
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL,                 -- 'booking', 'quote', 'subscription', 'promotion'
  percent_bps    integer NOT NULL DEFAULT 0 CHECK (percent_bps BETWEEN 0 AND 10000),   -- 1000 = 10%
  fixed_minor    integer NOT NULL DEFAULT 0 CHECK (fixed_minor >= 0),
  currency       text NOT NULL DEFAULT 'INR',
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('booking', 'quote', 'subscription', 'promotion')),
  subject_id         uuid,                                      -- the booking, quote, plan or listing being bought
  buyer_id           uuid NOT NULL,
  seller_id          uuid,                                      -- null when the platform sells (subscriptions, promotions)
  amount_minor       integer NOT NULL CHECK (amount_minor >= 0),
  fee_minor          integer NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  tax_minor          integer NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  currency           text NOT NULL DEFAULT 'INR',
  status             text NOT NULL DEFAULT 'created'
                       CHECK (status IN ('created', 'awaiting_payment', 'paid', 'fulfilled', 'settled', 'expired', 'cancelled', 'refunded', 'partially_refunded', 'disputed')),
  plan_code          text,
  billing_interval   text,
  provider           text,
  provider_order_id  text,
  expires_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_buyer ON public.orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller ON public.orders (seller_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_ref ON public.orders (provider, provider_order_id) WHERE provider_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.orders(id),
  provider             text NOT NULL,
  provider_payment_id  text NOT NULL,
  amount_minor         integer NOT NULL CHECK (amount_minor >= 0),
  currency             text NOT NULL DEFAULT 'INR',
  status               text NOT NULL CHECK (status IN ('authorized', 'captured', 'failed')),
  method               text,
  failure_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES public.orders(id),
  payment_id          uuid REFERENCES public.payments(id),
  amount_minor        integer NOT NULL CHECK (amount_minor > 0),
  reason              text NOT NULL,
  requested_by        uuid,
  approved_by         uuid,
  status              text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'processed', 'rejected', 'failed')),
  provider_refund_id  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- the ledger: double entry, append only. Every movement of money is a pair of lines that add up to zero.
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_group   uuid NOT NULL,                       -- the lines of one movement share a group
  account       text NOT NULL,                       -- 'provider_clearing', 'platform_revenue', 'platform_fee', 'seller_payable:<id>', 'refunds'
  direction     text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor  integer NOT NULL CHECK (amount_minor > 0),
  currency      text NOT NULL DEFAULT 'INR',
  order_id      uuid REFERENCES public.orders(id),
  kind          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_group ON public.ledger_entries (entry_group);
CREATE INDEX IF NOT EXISTS ledger_order ON public.ledger_entries (order_id);

CREATE OR REPLACE FUNCTION public.ledger_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The ledger is append only. Correct a mistake with a new entry.';
END;
$$;
DROP TRIGGER IF EXISTS ledger_no_change ON public.ledger_entries;
CREATE TRIGGER ledger_no_change BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_is_append_only();

-- every provider webhook, once. The pair (provider, event_id) is unique, so a replay does nothing the second time.
CREATE TABLE IF NOT EXISTS public.provider_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,
  event_id      text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  result        text,
  processed_at  timestamptz,
  received_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;

-- people read their own orders and what belongs to them; nothing else is readable or writable from the app
DROP POLICY IF EXISTS orders_read_own ON public.orders;
CREATE POLICY orders_read_own ON public.orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
DROP POLICY IF EXISTS payments_read_own ON public.payments;
CREATE POLICY payments_read_own ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));
DROP POLICY IF EXISTS refunds_read_own ON public.refunds;
CREATE POLICY refunds_read_own ON public.refunds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));
-- fee_rules, ledger_entries and provider_events have no policy: staff reach them through functions only


-- ── 7. the one function that moves money state (server only) ────────────────────────────────────
-- The edge function verifies the provider's signature, stores the event in provider_events, and then calls this with a
-- NORMALISED event, so no provider's own format ever reaches the database. Calling it twice with the same event is safe.
--   {"type":"payment.captured", "order_id":"...", "provider":"razorpay", "provider_payment_id":"...", "amount_minor":29900, "method":"upi"}
--   {"type":"payment.failed",   "order_id":"...", "provider":"...", "provider_payment_id":"...", "reason":"..."}
--   {"type":"refund.processed", "order_id":"...", "amount_minor":1000, "provider_refund_id":"..."}
--   {"type":"subscription.activated"|"subscription.renewed", "owner_type":"user|page", "owner_id":"...", "plan_code":"...",
--    "interval":"monthly|yearly", "period_start":"...", "period_end":"...", "provider":"...", "provider_subscription_id":"...", "provider_customer_id":"..."}
--   {"type":"subscription.past_due"|"subscription.cancelled"|"subscription.expired", "provider":"...", "provider_subscription_id":"..."}
CREATE OR REPLACE FUNCTION public.billing_apply_event(p_event jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := p_event ->> 'type';
  v_order public.orders%ROWTYPE;
  v_group uuid := gen_random_uuid();
  v_amount integer;
  v_fee integer;
  v_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the server may apply billing events';
  END IF;

  IF v_type = 'payment.captured' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    IF v_order.status IN ('paid', 'fulfilled', 'settled', 'refunded', 'partially_refunded') THEN RETURN 'already_applied'; END IF;
    v_amount := (p_event ->> 'amount_minor')::integer;
    IF v_amount <> v_order.amount_minor + v_order.tax_minor THEN
      RETURN 'amount_mismatch';                                   -- never trust a payment that does not match the order
    END IF;

    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount_minor, currency, status, method)
    VALUES (v_order.id, p_event ->> 'provider', p_event ->> 'provider_payment_id', v_amount, v_order.currency, 'captured', p_event ->> 'method')
    ON CONFLICT (provider, provider_payment_id) DO NOTHING;

    UPDATE public.orders SET status = 'paid', updated_at = now() WHERE id = v_order.id;

    v_fee := v_order.fee_minor;
    INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
    VALUES (v_group, 'provider_clearing', 'debit', v_amount, v_order.currency, v_order.id, 'payment');
    IF v_order.seller_id IS NULL THEN
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'platform_revenue', 'credit', v_order.amount_minor, v_order.currency, v_order.id, 'payment');
    ELSE
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'seller_payable:' || v_order.seller_id::text, 'credit', v_order.amount_minor - v_fee, v_order.currency, v_order.id, 'payment');
      IF v_fee > 0 THEN
        INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
        VALUES (v_group, 'platform_fee', 'credit', v_fee, v_order.currency, v_order.id, 'payment');
      END IF;
    END IF;
    IF v_order.tax_minor > 0 THEN
      INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
      VALUES (v_group, 'tax_payable', 'credit', v_order.tax_minor, v_order.currency, v_order.id, 'payment');
    END IF;
    RETURN 'applied';

  ELSIF v_type = 'payment.failed' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount_minor, currency, status, failure_reason)
    VALUES (v_order.id, p_event ->> 'provider', p_event ->> 'provider_payment_id', v_order.amount_minor + v_order.tax_minor, v_order.currency, 'failed', left(p_event ->> 'reason', 300))
    ON CONFLICT (provider, provider_payment_id) DO NOTHING;
    RETURN 'applied';

  ELSIF v_type = 'refund.processed' THEN
    SELECT * INTO v_order FROM public.orders WHERE id = (p_event ->> 'order_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN 'order_not_found'; END IF;
    v_amount := (p_event ->> 'amount_minor')::integer;
    IF EXISTS (SELECT 1 FROM public.refunds r WHERE r.provider_refund_id = p_event ->> 'provider_refund_id') THEN RETURN 'already_applied'; END IF;
    INSERT INTO public.refunds (order_id, amount_minor, reason, status, provider_refund_id)
    VALUES (v_order.id, v_amount, COALESCE(p_event ->> 'reason', 'Refund'), 'processed', p_event ->> 'provider_refund_id');
    INSERT INTO public.ledger_entries (entry_group, account, direction, amount_minor, currency, order_id, kind)
    VALUES (v_group, 'refunds', 'debit', v_amount, v_order.currency, v_order.id, 'refund'),
           (v_group, 'provider_clearing', 'credit', v_amount, v_order.currency, v_order.id, 'refund');
    v_status := CASE WHEN v_amount >= v_order.amount_minor + v_order.tax_minor THEN 'refunded' ELSE 'partially_refunded' END;
    UPDATE public.orders SET status = v_status, updated_at = now() WHERE id = v_order.id;
    RETURN 'applied';

  ELSIF v_type IN ('subscription.activated', 'subscription.renewed') THEN
    INSERT INTO public.subscriptions (owner_type, owner_id, plan_code, status, billing_interval, current_period_start, current_period_end,
                                      provider, provider_customer_id, provider_subscription_id)
    VALUES (p_event ->> 'owner_type', (p_event ->> 'owner_id')::uuid, p_event ->> 'plan_code', 'active', p_event ->> 'interval',
            (p_event ->> 'period_start')::timestamptz, (p_event ->> 'period_end')::timestamptz,
            p_event ->> 'provider', p_event ->> 'provider_customer_id', p_event ->> 'provider_subscription_id')
    ON CONFLICT (owner_type, owner_id) WHERE status IN ('beta', 'trialing', 'active', 'past_due')
    DO UPDATE SET plan_code = EXCLUDED.plan_code, status = 'active', billing_interval = EXCLUDED.billing_interval,
                  current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
                  provider = EXCLUDED.provider, provider_customer_id = EXCLUDED.provider_customer_id,
                  provider_subscription_id = EXCLUDED.provider_subscription_id, cancel_at_period_end = false, updated_at = now();
    RETURN 'applied';

  ELSIF v_type = 'subscription.past_due' THEN
    UPDATE public.subscriptions SET status = 'past_due', updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id';
    RETURN 'applied';

  ELSIF v_type IN ('subscription.cancelled', 'subscription.expired') THEN
    UPDATE public.subscriptions
       SET status = CASE WHEN v_type = 'subscription.expired' THEN 'expired' ELSE 'cancelled' END, updated_at = now()
     WHERE provider = p_event ->> 'provider' AND provider_subscription_id = p_event ->> 'provider_subscription_id';
    RETURN 'applied';
  END IF;

  RETURN 'ignored';
END;
$$;
REVOKE ALL ON FUNCTION public.billing_apply_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_event(jsonb) TO service_role;

-- subscriptions that ran out (the end of a trial or founding period, or a lapsed payment) fall back to the default plan
CREATE OR REPLACE FUNCTION public.billing_expire_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.subscriptions
     SET status = 'expired', updated_at = now()
   WHERE status IN ('beta', 'trialing') AND current_period_end IS NOT NULL AND current_period_end <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_expire_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_expire_subscriptions() TO service_role, authenticated;


-- ── 8. admin: the impact report, the mode switch, founding members ──────────────────────────────
-- "If we went live today, who would hit a limit?" Counted against what each person would hold under the paid rules
-- (their subscription or override if they have one, otherwise the default plan).
CREATE OR REPLACE FUNCTION public.billing_live_impact()
RETURNS TABLE (entitlement_key text, accounts_affected integer, accounts_total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_key text;
  v_affected integer;
  v_total integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see the billing impact';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;

  SELECT count(*)::int INTO v_total FROM public.profiles p WHERE NOT public.is_staff_user(p.id);

  -- limits: people who already have more than their plan would allow
  FOREACH v_key IN ARRAY ARRAY['projects.max', 'rooms.private.max', 'portfolio.items.max', 'jobs.active.max'] LOOP
    SELECT count(*)::int INTO v_affected
    FROM public.profiles p
    WHERE NOT public.is_staff_user(p.id)
      AND (
        CASE
          WHEN (public.resolve_entitlements(p.id) -> v_key) IS NULL THEN 0
          WHEN (public.resolve_entitlements(p.id) -> v_key) = 'null'::jsonb THEN 2147483647
          ELSE ((public.resolve_entitlements(p.id) -> v_key)::text)::numeric::integer
        END
      ) < public.count_for_limit(v_key, p.id);
    RETURN QUERY SELECT v_key, v_affected, v_total;
  END LOOP;

  -- features: people who use a feature their plan would not include (posting is the main one)
  SELECT count(*)::int INTO v_affected
  FROM public.profiles p
  WHERE NOT public.is_staff_user(p.id)
    AND COALESCE((public.resolve_entitlements(p.id) -> 'posts.create')::text, 'false') = 'false'
    AND EXISTS (SELECT 1 FROM public.posts po WHERE po.author_id = p.id);
  RETURN QUERY SELECT 'posts.create'::text, v_affected, v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_live_impact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_live_impact() TO authenticated;

-- founding members: give a plan to everybody (or one kind of account) for a number of days, so the move to paid is a
-- soft landing. They fall back to the default plan when the period ends (billing_expire_subscriptions).
CREATE OR REPLACE FUNCTION public.billing_grant_founding_plan(p_plan_code text, p_days integer, p_account_types text[] DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can grant plans';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF p_days < 1 OR p_days > 730 THEN
    RAISE EXCEPTION 'Choose between 1 and 730 days';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = p_plan_code AND audience = 'person') THEN
    RAISE EXCEPTION 'Unknown personal plan';
  END IF;

  INSERT INTO public.subscriptions (owner_type, owner_id, plan_code, status, current_period_start, current_period_end)
  SELECT 'user', p.id, p_plan_code, 'trialing', now(), now() + make_interval(days => p_days)
  FROM public.profiles p
  WHERE NOT public.is_staff_user(p.id)
    AND (p_account_types IS NULL OR COALESCE(p.account_type, 'creator') = ANY (p_account_types))
  ON CONFLICT (owner_type, owner_id) WHERE status IN ('beta', 'trialing', 'active', 'past_due') DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.founding_grant', auth.uid(), p_plan_code, 'plan', left(p_reason, 300),
          jsonb_build_object('days', p_days, 'account_types', p_account_types, 'granted', v_count));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_grant_founding_plan(text, integer, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_grant_founding_plan(text, integer, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_set_mode(p_mode text, p_beta_ends_at timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before text := public.billing_mode();
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change the billing mode';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF p_mode NOT IN ('beta', 'live') THEN
    RAISE EXCEPTION 'The mode is beta or live';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF p_mode = 'live' AND NOT COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'payments_enabled'), false) THEN
    RAISE EXCEPTION 'Payments are not switched on yet, so the app cannot go live. Connect a provider and enable payments first.';
  END IF;

  INSERT INTO public.platform_settings (key, value) VALUES ('billing_mode', to_jsonb(p_mode))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.platform_settings (key, value) VALUES ('billing_beta_ends_at', COALESCE(to_jsonb(p_beta_ends_at), 'null'::jsonb))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.mode_changed', auth.uid(), 'billing_mode', 'settings', left(p_reason, 300),
          jsonb_build_object('before', v_before, 'after', p_mode, 'beta_ends_at', p_beta_ends_at));
END;
$$;
REVOKE ALL ON FUNCTION public.billing_set_mode(text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_set_mode(text, timestamptz, text) TO authenticated;

-- the switch that says a provider is connected and tested. Kept separate from the mode on purpose: going live needs both.
CREATE OR REPLACE FUNCTION public.billing_set_payments_enabled(p_enabled boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change this';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  INSERT INTO public.platform_settings (key, value) VALUES ('payments_enabled', to_jsonb(p_enabled))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  IF NOT p_enabled AND public.billing_mode() = 'live' THEN
    UPDATE public.platform_settings SET value = '"beta"'::jsonb WHERE key = 'billing_mode';   -- switching payments off returns everyone to free
  END IF;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.payments_enabled', auth.uid(), 'payments_enabled', 'settings', left(p_reason, 300), jsonb_build_object('enabled', p_enabled));
END;
$$;
REVOKE ALL ON FUNCTION public.billing_set_payments_enabled(boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_set_payments_enabled(boolean, text) TO authenticated;

-- the plans with what they include, for the admin screen
CREATE OR REPLACE FUNCTION public.billing_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see billing';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN jsonb_build_object(
    'mode', public.billing_mode(),
    'payments_enabled', COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'payments_enabled'), false),
    'beta_ends_at', (SELECT s.value #>> '{}' FROM public.platform_settings s WHERE s.key = 'billing_beta_ends_at'),
    'subscriptions', (SELECT COALESCE(jsonb_object_agg(x.status, x.n), '{}'::jsonb) FROM (SELECT status, count(*) AS n FROM public.subscriptions GROUP BY status) x),
    'plans', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'code', p.code, 'name', p.name, 'audience', p.audience, 'description', p.description,
                'price_monthly_minor', p.price_monthly_minor, 'price_yearly_minor', p.price_yearly_minor, 'currency', p.currency,
                'is_active', p.is_active, 'is_default', p.is_default,
                'entitlements', (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) FROM public.plan_entitlements e WHERE e.plan_code = p.code)
              ) ORDER BY p.sort_order), '[]'::jsonb) FROM public.plans p)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.billing_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_overview() TO authenticated;


-- ── 9. creating an order (server only) ──────────────────────────────────────────────────────────
-- The price always comes from here, never from the app: a subscription is priced from the plans table, and the platform
-- fee on a sale from fee_rules. The edge function create-checkout calls this and then asks the provider for a checkout.
CREATE OR REPLACE FUNCTION public.billing_create_order(
  p_kind text, p_buyer uuid, p_seller uuid, p_subject_id uuid,
  p_plan_code text DEFAULT NULL, p_interval text DEFAULT NULL, p_amount_minor integer DEFAULT NULL, p_currency text DEFAULT 'INR'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
  v_currency text := p_currency;
  v_fee integer := 0;
  v_rule record;
  v_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the server may create orders';
  END IF;
  IF public.is_staff_user(p_buyer) OR (p_seller IS NOT NULL AND public.is_staff_user(p_seller)) THEN
    RAISE EXCEPTION 'Staff accounts do not buy or sell';
  END IF;
  IF NOT COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'payments_enabled'), false) THEN
    RAISE EXCEPTION 'Payments are not switched on';
  END IF;

  IF p_kind = 'subscription' THEN
    SELECT CASE WHEN p_interval = 'yearly' THEN pl.price_yearly_minor ELSE pl.price_monthly_minor END, pl.currency
      INTO v_amount, v_currency
      FROM public.plans pl WHERE pl.code = p_plan_code AND pl.is_active;
    IF v_amount IS NULL THEN
      RAISE EXCEPTION 'That plan cannot be bought';
    END IF;
  ELSE
    v_amount := p_amount_minor;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'An amount is required';
    END IF;
    SELECT * INTO v_rule FROM public.fee_rules fr
     WHERE fr.kind = p_kind AND fr.starts_at <= now() AND (fr.ends_at IS NULL OR fr.ends_at > now())
     ORDER BY fr.starts_at DESC LIMIT 1;
    IF FOUND THEN
      v_fee := round(v_amount * v_rule.percent_bps / 10000.0)::int + v_rule.fixed_minor;
      IF v_fee > v_amount THEN v_fee := v_amount; END IF;
    END IF;
  END IF;

  INSERT INTO public.orders (kind, subject_id, buyer_id, seller_id, amount_minor, fee_minor, currency, status, plan_code, billing_interval, expires_at)
  VALUES (p_kind, p_subject_id, p_buyer, p_seller, v_amount, v_fee, v_currency, 'awaiting_payment', p_plan_code, p_interval, now() + interval '30 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_create_order(text, uuid, uuid, uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_create_order(text, uuid, uuid, uuid, text, text, integer, text) TO service_role;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- SELECT public.billing_mode();                    -- 'beta': nothing is limited, nothing is charged
-- SELECT public.my_entitlements();                 -- {"mode":"beta","all_unlocked":true,...}
-- Create a project, a private room, a portfolio item: all still work (the limit triggers do nothing in beta).
-- As a super admin: Billing tab → the impact report shows how many people a live switch would affect.
