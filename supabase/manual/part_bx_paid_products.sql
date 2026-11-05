-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bx: vendor verification and the marketplace are separate paid products
--
-- They are NOT part of the creator or studio plans. Each is bought on its own, by whoever needs it:
--
--   vendor_verification   A paid REVIEW of a business (not a paid badge). Pay, then submit documents. The fee covers the
--                         review and one resubmission within 90 days; the badge lasts 12 months, and keeping it means
--                         paying for a new review. Approval is decided only by the review, never by the payment.
--   marketplace_seller    The right to have active listings on the marketplace, monthly or yearly. When it ends the
--                         listings are paused (never deleted) and come back when it is renewed. The commission on a
--                         booking is separate and lives in fee_rules (kind 'booking').
--
-- Same rule as everything in billing: while billing_mode is 'beta' these do nothing and are free. Nothing is enforced until
-- a super admin goes live. Run after part_bv (and bw).
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── 1. the products ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  code            text PRIMARY KEY,
  name            text NOT NULL,
  description     text,
  billing         text NOT NULL CHECK (billing IN ('one_time', 'monthly', 'yearly')),
  price_minor     integer NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency        text NOT NULL DEFAULT 'INR' CHECK (char_length(currency) = 3),
  valid_days      integer NOT NULL CHECK (valid_days > 0),            -- how long one purchase lasts
  uses            integer CHECK (uses IS NULL OR uses > 0),            -- how many times it can be used (NULL = no count)
  is_active       boolean NOT NULL DEFAULT false,                     -- may be bought
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_read ON public.products;
CREATE POLICY products_read ON public.products FOR SELECT TO authenticated, anon USING (true);

-- drafts: prices are placeholders until you decide, and nothing is for sale while is_active is false
INSERT INTO public.products (code, name, description, billing, price_minor, valid_days, uses, is_active, sort_order) VALUES
  ('vendor_verification', 'Business verification', 'A review of your business documents. The fee covers the review and one resubmission. The badge lasts 12 months.', 'one_time', 99900, 365, 2, false, 1),
  ('marketplace_seller',  'Marketplace seller',    'List gear and services on the marketplace. Listings pause if it lapses and return when you renew.',                     'monthly',  49900, 30,  NULL, false, 2)
ON CONFLICT (code) DO NOTHING;

-- what has been bought: one row per paid purchase
CREATE TABLE IF NOT EXISTS public.product_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_code    text NOT NULL REFERENCES public.products(code),
  subject_id      uuid,                                    -- the vendor a verification is for
  order_id        uuid UNIQUE REFERENCES public.orders(id),
  uses_remaining  integer,
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'refunded')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_grants_owner ON public.product_grants (owner_id, product_code, status);
ALTER TABLE public.product_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_grants_read_own ON public.product_grants;
CREATE POLICY product_grants_read_own ON public.product_grants FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- orders can now be for these products
DO $$
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_kind_check;
  ALTER TABLE public.orders ADD CONSTRAINT orders_kind_check
    CHECK (kind IN ('booking', 'quote', 'subscription', 'promotion', 'vendor_verification', 'marketplace_seller'));
END $$;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_code text REFERENCES public.products(code);

-- what the verification request was paid with, and when a verified badge runs out
ALTER TABLE public.vendor_verification_requests ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz;
-- listings paused because the seller plan lapsed (so they can be brought back, unlike a seller's own deactivation)
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS billing_paused boolean NOT NULL DEFAULT false;


-- ── 2. who has access ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_product_access(p_user uuid, p_product text, p_subject uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.billing_mode() = 'beta'
      OR EXISTS (
        SELECT 1 FROM public.product_grants g
        WHERE g.owner_id = p_user AND g.product_code = p_product AND g.status = 'active'
          AND g.valid_from <= now() AND g.valid_until > now()
          AND (g.uses_remaining IS NULL OR g.uses_remaining > 0)
          AND (p_subject IS NULL OR g.subject_id IS NULL OR g.subject_id = p_subject)
      );
$$;
REVOKE ALL ON FUNCTION public.has_product_access(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_product_access(uuid, text, uuid) TO authenticated;

-- for the screens: is it required right now, what does it cost, and what does this person already hold
CREATE OR REPLACE FUNCTION public.my_product_access(p_product text, p_subject uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_grant record;
  v_required boolean := public.billing_mode() = 'live';
BEGIN
  SELECT * INTO v_prod FROM public.products WHERE code = p_product;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT g.valid_until, g.uses_remaining INTO v_grant
  FROM public.product_grants g
  WHERE g.owner_id = auth.uid() AND g.product_code = p_product AND g.status = 'active' AND g.valid_until > now()
    AND (g.uses_remaining IS NULL OR g.uses_remaining > 0)
    AND (p_subject IS NULL OR g.subject_id IS NULL OR g.subject_id = p_subject)
  ORDER BY g.valid_until DESC LIMIT 1;

  RETURN jsonb_build_object(
    'found', true, 'required', v_required, 'mode', public.billing_mode(),
    'has_access', NOT v_required OR v_grant.valid_until IS NOT NULL,
    'valid_until', v_grant.valid_until, 'uses_remaining', v_grant.uses_remaining,
    'name', v_prod.name, 'description', v_prod.description, 'billing', v_prod.billing,
    'price_minor', v_prod.price_minor, 'currency', v_prod.currency, 'is_active', v_prod.is_active, 'valid_days', v_prod.valid_days
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_product_access(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_product_access(text, uuid) TO authenticated;


-- ── 3. a paid order becomes a grant ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_product_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.products%ROWTYPE;
  v_start timestamptz := now();
  v_end timestamptz;
BEGIN
  IF NEW.product_code IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.products WHERE code = NEW.product_code;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- renewing something still running continues from its end, so no paid days are lost
  IF p.billing <> 'one_time' THEN
    SELECT GREATEST(v_start, COALESCE(max(g.valid_until), v_start)) INTO v_start
    FROM public.product_grants g
    WHERE g.owner_id = NEW.buyer_id AND g.product_code = p.code AND g.status = 'active' AND g.valid_until > now();
  END IF;
  v_end := v_start + make_interval(days => p.valid_days);

  INSERT INTO public.product_grants (owner_id, product_code, subject_id, order_id, uses_remaining, valid_from, valid_until)
  VALUES (NEW.buyer_id, p.code, NEW.subject_id, NEW.id, p.uses, v_start, v_end)
  ON CONFLICT (order_id) DO NOTHING;

  -- a renewed seller gets the listings that were paused back
  IF p.code = 'marketplace_seller' THEN
    UPDATE public.marketplace_listings SET is_active = true, billing_paused = false WHERE user_id = NEW.buyer_id AND billing_paused;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  VALUES (NEW.buyer_id, p.name || ' is active', 'Thank you. It runs until ' || to_char(v_end, 'DD Mon YYYY') || '.', 'product_purchased', 'medium',
          CASE WHEN p.code = 'vendor_verification' THEN '/vendors' ELSE '/marketplace/hub' END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_product_on_paid ON public.orders;
CREATE TRIGGER grant_product_on_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.kind IN ('vendor_verification', 'marketplace_seller'))
EXECUTE FUNCTION public.grant_product_on_paid();


-- ── 4. enforcement: silent in beta ──────────────────────────────────────────────────────────────
-- A verification review needs a paid grant with a use left; submitting uses one and links the order.
CREATE OR REPLACE FUNCTION public.require_paid_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant uuid;
BEGIN
  IF public.billing_mode() = 'beta' THEN RETURN NEW; END IF;

  SELECT g.id INTO v_grant
  FROM public.product_grants g
  WHERE g.owner_id = NEW.owner_id AND g.product_code = 'vendor_verification' AND g.status = 'active'
    AND g.valid_until > now() AND (g.uses_remaining IS NULL OR g.uses_remaining > 0)
    AND (g.subject_id IS NULL OR g.subject_id = NEW.vendor_id)
  ORDER BY g.valid_until LIMIT 1
  FOR UPDATE;

  IF v_grant IS NULL THEN
    RAISE EXCEPTION 'Business verification is a paid review. Buy it first, then send your documents.'
      USING ERRCODE = 'P0001', HINT = 'product_required:vendor_verification';
  END IF;

  UPDATE public.product_grants
     SET uses_remaining = CASE WHEN uses_remaining IS NULL THEN NULL ELSE uses_remaining - 1 END,
         status = CASE WHEN uses_remaining IS NOT NULL AND uses_remaining - 1 <= 0 THEN 'used' ELSE status END
   WHERE id = v_grant;
  NEW.order_id := (SELECT order_id FROM public.product_grants WHERE id = v_grant);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS require_paid_verification ON public.vendor_verification_requests;
CREATE TRIGGER require_paid_verification BEFORE INSERT ON public.vendor_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_paid_verification();

-- an approved badge lasts 12 months from the approval
CREATE OR REPLACE FUNCTION public.set_verification_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_verified AND (OLD.is_verified IS DISTINCT FROM true) THEN
    NEW.verification_expires_at := COALESCE(NEW.verification_date, now()) + interval '365 days';
  ELSIF NOT NEW.is_verified THEN
    NEW.verification_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_verification_expiry ON public.vendors;
CREATE TRIGGER set_verification_expiry BEFORE UPDATE OF is_verified ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_verification_expiry();

-- listing on the marketplace needs an active seller purchase (staff accounts never sell)
CREATE OR REPLACE FUNCTION public.require_seller_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.billing_mode() = 'beta' THEN RETURN NEW; END IF;
  IF public.has_product_access(NEW.user_id, 'marketplace_seller') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Selling on the marketplace needs the Marketplace seller plan.'
    USING ERRCODE = 'P0001', HINT = 'product_required:marketplace_seller';
END;
$$;
DROP TRIGGER IF EXISTS require_seller_product ON public.marketplace_listings;
CREATE TRIGGER require_seller_product BEFORE INSERT ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.require_seller_product();

-- run daily (or by hand): ends what has run out. Only does anything when billing is live.
CREATE OR REPLACE FUNCTION public.billing_expire_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grants integer := 0;
  v_listings integer := 0;
  v_badges integer := 0;
BEGIN
  IF public.billing_mode() <> 'live' THEN
    RETURN jsonb_build_object('skipped', 'beta');
  END IF;

  UPDATE public.product_grants SET status = 'expired' WHERE status = 'active' AND valid_until <= now();
  GET DIAGNOSTICS v_grants = ROW_COUNT;

  -- sellers with no running purchase: pause their listings (never delete)
  UPDATE public.marketplace_listings l
     SET is_active = false, billing_paused = true
   WHERE l.is_active AND NOT public.has_product_access(l.user_id, 'marketplace_seller');
  GET DIAGNOSTICS v_listings = ROW_COUNT;

  -- badges past their 12 months
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.vendors SET is_verified = false WHERE is_verified AND verification_expires_at IS NOT NULL AND verification_expires_at <= now();
  GET DIAGNOSTICS v_badges = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);

  RETURN jsonb_build_object('grants_expired', v_grants, 'listings_paused', v_listings, 'badges_expired', v_badges);
END;
$$;
REVOKE ALL ON FUNCTION public.billing_expire_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_expire_products() TO service_role, authenticated;


-- ── 5. orders for products (replaces the version from part_bv; one extra, optional argument) ────
DROP FUNCTION IF EXISTS public.billing_create_order(text, uuid, uuid, uuid, text, text, integer, text);
CREATE OR REPLACE FUNCTION public.billing_create_order(
  p_kind text, p_buyer uuid, p_seller uuid, p_subject_id uuid,
  p_plan_code text DEFAULT NULL, p_interval text DEFAULT NULL, p_amount_minor integer DEFAULT NULL, p_currency text DEFAULT 'INR',
  p_product_code text DEFAULT NULL
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
    IF v_amount IS NULL THEN RAISE EXCEPTION 'That plan cannot be bought'; END IF;

  ELSIF p_kind IN ('vendor_verification', 'marketplace_seller') THEN
    -- these two are bought by name, and the price comes from the products table
    IF p_product_code IS DISTINCT FROM p_kind THEN RAISE EXCEPTION 'Wrong product for this order'; END IF;
    SELECT pr.price_minor, pr.currency INTO v_amount, v_currency FROM public.products pr WHERE pr.code = p_product_code AND pr.is_active;
    IF v_amount IS NULL THEN RAISE EXCEPTION 'That product cannot be bought yet'; END IF;
    IF p_kind = 'vendor_verification' AND NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = p_subject_id AND v.owner_id = p_buyer) THEN
      RAISE EXCEPTION 'You can only buy verification for your own business';
    END IF;

  ELSE
    v_amount := p_amount_minor;
    IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'An amount is required'; END IF;
    SELECT * INTO v_rule FROM public.fee_rules fr
     WHERE fr.kind = p_kind AND fr.starts_at <= now() AND (fr.ends_at IS NULL OR fr.ends_at > now())
     ORDER BY fr.starts_at DESC LIMIT 1;
    IF FOUND THEN
      v_fee := round(v_amount * v_rule.percent_bps / 10000.0)::int + v_rule.fixed_minor;
      IF v_fee > v_amount THEN v_fee := v_amount; END IF;
    END IF;
  END IF;

  INSERT INTO public.orders (kind, subject_id, buyer_id, seller_id, amount_minor, fee_minor, currency, status, plan_code, billing_interval, product_code, expires_at)
  VALUES (p_kind, p_subject_id, p_buyer, p_seller, v_amount, v_fee, v_currency, 'awaiting_payment', p_plan_code, p_interval, p_product_code, now() + interval '30 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_create_order(text, uuid, uuid, uuid, text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_create_order(text, uuid, uuid, uuid, text, text, integer, text, text) TO service_role;


-- ── 6. admin: see and change the products ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.billing_list_products()
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
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sort_order) FROM public.products p), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.billing_list_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_list_products() TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_set_product(p_code text, p_price_minor integer, p_is_active boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change products';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_price_minor < 0 THEN RAISE EXCEPTION 'The price cannot be negative'; END IF;

  SELECT to_jsonb(p) INTO v_before FROM public.products p WHERE p.code = p_code;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Unknown product'; END IF;

  UPDATE public.products SET price_minor = p_price_minor, is_active = p_is_active WHERE code = p_code;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.product_changed', auth.uid(), p_code, 'product', left(p_reason, 300),
          jsonb_build_object('before', jsonb_build_object('price_minor', v_before -> 'price_minor', 'is_active', v_before -> 'is_active'),
                             'after', jsonb_build_object('price_minor', p_price_minor, 'is_active', p_is_active)));
END;
$$;
REVOKE ALL ON FUNCTION public.billing_set_product(text, integer, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_set_product(text, integer, boolean, text) TO authenticated;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- In beta: submit a vendor verification and create a marketplace listing: both still work and cost nothing.
-- SELECT public.my_product_access('vendor_verification');  -- {"required": false, "has_access": true, ...} until live
-- Live (test only): a seller without the product gets "Selling on the marketplace needs the Marketplace seller plan."
