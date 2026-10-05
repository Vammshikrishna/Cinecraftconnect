-- PART Q: marketplace & vendors security fixes. Run AFTER part P. Safe to re-run.
BEGIN;
-- Marketplace & vendors: security fixes.
--
--   * Bookings could be created with a client-supplied owner / price / status, double-booked, and either side could
--     rewrite any column (a renter could confirm their own booking or change the price). Bookings are now created only
--     through request_booking() (server-side price, ownership, availability checks) and changes are limited to the
--     allowed status moves for each side.
--   * Reviews were open to anyone, any number of times. Listing reviews now need a real (confirmed/completed, started)
--     booking, one review per booking; vendor reviews are one per person and never for your own business. Reviews can
--     only be edited for 48 hours and never re-pointed at another listing.
--   * Owners could clear their own moderation flag or fake the review-derived condition score, and vendors could mark
--     themselves verified. Those columns are now written only by the system / admins.
--   * Bundles could contain other people's gear. Items must now belong to the bundle owner.
--   * Wishlist share tokens lived on the (publicly readable) profiles table. They are now private.
--   * Basic abuse limits: listings, vendor profiles, services, pending bookings.
--
-- Safe to re-run.

-- ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_market_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.has_role('admin'::public.app_role, auth.uid()), false)
      OR COALESCE(public.has_role('super_admin'::public.app_role, auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_market_admin() TO authenticated, service_role;

-- Triggers that must write protected columns set this flag first (transaction-local, not settable by clients).
CREATE OR REPLACE FUNCTION public.market_is_system()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NULL OR COALESCE(current_setting('app.market_system', true), '') = '1';
$$;

-- ── 1. Wishlist share tokens → private table ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist_share_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wishlist_share_tokens ENABLE ROW LEVEL SECURITY;
-- no policies: only the functions below touch it

INSERT INTO public.wishlist_share_tokens (user_id, token)
SELECT id, wishlist_share_token FROM public.profiles WHERE wishlist_share_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_wishlist_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT token INTO v_token FROM wishlist_share_tokens WHERE user_id = v_uid;
  IF v_token IS NULL THEN
    INSERT INTO wishlist_share_tokens (user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
    SELECT token INTO v_token FROM wishlist_share_tokens WHERE user_id = v_uid;
  END IF;
  RETURN v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_wishlist_token() TO authenticated;

-- Lets a person rotate the link (old links stop working).
CREATE OR REPLACE FUNCTION public.reset_my_wishlist_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  INSERT INTO wishlist_share_tokens (user_id, token) VALUES (v_uid, v_token)
  ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = now();
  RETURN v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_my_wishlist_token() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_wishlist(p_token uuid)
RETURNS TABLE(id uuid, listing_id uuid, title text, description text, price_per_day numeric, images text[], user_id uuid, owner_profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, l.id AS listing_id, l.title, l.description, l.price_per_day, l.images, w.user_id, l.user_id AS owner_profile_id
  FROM marketplace_wishlists w
  JOIN wishlist_share_tokens t ON t.user_id = w.user_id
  JOIN marketplace_listings l ON l.id = w.listing_id
  WHERE t.token = p_token AND l.is_active = true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_wishlist(uuid) TO anon, authenticated;

-- The old column stays (older app builds still read it) but no longer holds anything.
UPDATE public.profiles SET wishlist_share_token = NULL WHERE wishlist_share_token IS NOT NULL;

-- ── 2. Listings: protected columns + limits ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marketplace_listings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM marketplace_listings WHERE user_id = NEW.user_id AND is_active) >= 100 THEN
      RAISE EXCEPTION 'You have reached the limit of 100 active listings' USING ERRCODE = 'P0001';
    END IF;
    NEW.admin_flagged := false;
    NEW.condition_score := 0;
  ELSE
    -- moderation flag and the review-derived score are not the owner's to edit
    NEW.admin_flagged := OLD.admin_flagged;
    NEW.condition_score := OLD.condition_score;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_listings_guard ON public.marketplace_listings;
CREATE TRIGGER trg_marketplace_listings_guard BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_listings_guard();

-- The condition triggers run as the reviewer, who is not the listing owner, so their UPDATE silently did nothing.
-- They now run as the system and set the flag the guard above recognises.
CREATE OR REPLACE FUNCTION public.flag_listing_on_poor_condition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  poor_reviews_count integer;
BEGIN
  IF NEW.listing_id IS NOT NULL AND NEW.condition_rating IS NOT NULL AND NEW.condition_rating <= 2 THEN
    SELECT COUNT(*) INTO poor_reviews_count
    FROM marketplace_reviews WHERE listing_id = NEW.listing_id AND condition_rating <= 2;

    IF poor_reviews_count >= 3 THEN
      PERFORM set_config('app.market_system', '1', true);
      UPDATE marketplace_listings SET admin_flagged = true WHERE id = NEW.listing_id AND admin_flagged = false;
      PERFORM set_config('app.market_system', '', true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_listing_condition_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_listing uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.listing_id ELSE NEW.listing_id END;
BEGIN
  IF v_listing IS NOT NULL THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE marketplace_listings
    SET condition_score = (
      SELECT COALESCE(AVG(condition_rating), 0)::numeric(3, 2)
      FROM marketplace_reviews WHERE listing_id = v_listing AND condition_rating IS NOT NULL
    )
    WHERE id = v_listing;
    PERFORM set_config('app.market_system', '', true);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 3. Bundles may only contain the owner's own gear ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert bundle items for their own listings" ON public.marketplace_bundle_items;
CREATE POLICY "Users can insert bundle items for their own listings" ON public.marketplace_bundle_items FOR INSERT TO authenticated
  WITH CHECK (
    bundle_id <> item_id
    AND EXISTS (SELECT 1 FROM marketplace_listings b WHERE b.id = bundle_id AND b.user_id = auth.uid() AND b.is_bundle)
    AND EXISTS (SELECT 1 FROM marketplace_listings i WHERE i.id = item_id AND i.user_id = auth.uid() AND NOT COALESCE(i.is_bundle, false))
  );

-- ── 4. Vendors: verification is not self-service; limits ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendors_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM vendors WHERE owner_id = NEW.owner_id) >= 3 THEN
      RAISE EXCEPTION 'You can have up to 3 vendor profiles' USING ERRCODE = 'P0001';
    END IF;
    NEW.is_verified := false;
    NEW.verification_date := NULL;
  ELSE
    NEW.is_verified := OLD.is_verified;
    NEW.verification_date := OLD.verification_date;
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_vendors_guard ON public.vendors;
CREATE TRIGGER trg_vendors_guard BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.vendors_guard();

CREATE OR REPLACE FUNCTION public.vendor_services_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM vendor_services WHERE vendor_id = NEW.vendor_id) >= 50 THEN
    RAISE EXCEPTION 'A vendor can list up to 50 services' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_vendor_services_limit ON public.vendor_services;
CREATE TRIGGER trg_vendor_services_limit BEFORE INSERT ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.vendor_services_limit();

-- ── 5. Bookings ───────────────────────────────────────────────────────────────────────────────────────────────────
-- Direct inserts are gone: bookings are created by request_booking() below.
DROP POLICY IF EXISTS "Users can create bookings" ON public.marketplace_bookings;

-- The bundle trigger inserts child rows as the system (the renter no longer has insert rights).
CREATE OR REPLACE FUNCTION public.block_bundle_children_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_bundle boolean;
  v_child uuid;
BEGIN
  SELECT is_bundle INTO v_is_bundle FROM marketplace_listings WHERE id = NEW.listing_id;
  IF COALESCE(v_is_bundle, false) THEN
    FOR v_child IN SELECT item_id FROM marketplace_bundle_items WHERE bundle_id = NEW.listing_id LOOP
      INSERT INTO marketplace_bookings (listing_id, renter_id, owner_id, start_date, end_date, total_price, status, message)
      VALUES (v_child, NEW.renter_id, NEW.owner_id, NEW.start_date, NEW.end_date, 0, NEW.status,
              'Child item auto-booked as part of bundle booking: ' || NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_conflicts(p_listing_id uuid, p_start date, p_end date, p_exclude uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_bookings b
    WHERE b.listing_id = p_listing_id
      AND b.status = 'confirmed'
      AND b.start_date <= p_end AND b.end_date >= p_start
      AND (p_exclude IS NULL OR b.id <> p_exclude)
  );
$$;
GRANT EXECUTE ON FUNCTION public.booking_conflicts(uuid, date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_booking(p_listing_id uuid, p_start date, p_end date, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing marketplace_listings%ROWTYPE;
  v_days integer;
  v_total numeric(10, 2);
  v_id uuid;
  v_child uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please sign in to request a booking');
  END IF;

  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id;
  IF v_listing.id IS NULL OR v_listing.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'This listing is not available');
  END IF;
  IF v_listing.user_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot book your own listing');
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start < current_date OR p_end < p_start THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose valid dates (today or later, end after start)');
  END IF;
  v_days := (p_end - p_start) + 1;
  IF v_days > 90 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bookings can be at most 90 days');
  END IF;
  IF (SELECT count(*) FROM marketplace_bookings WHERE renter_id = v_uid AND status = 'pending') >= 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have too many pending requests. Wait for replies first.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM marketplace_bookings
    WHERE renter_id = v_uid AND listing_id = p_listing_id AND status IN ('pending', 'confirmed')
      AND start_date <= p_end AND end_date >= p_start
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You already have a request for these dates');
  END IF;
  IF public.booking_conflicts(p_listing_id, p_start, p_end) THEN
    RETURN jsonb_build_object('success', false, 'message', 'These dates are already booked');
  END IF;
  IF COALESCE(v_listing.is_bundle, false) THEN
    FOR v_child IN SELECT item_id FROM marketplace_bundle_items WHERE bundle_id = p_listing_id LOOP
      IF public.booking_conflicts(v_child, p_start, p_end) THEN
        RETURN jsonb_build_object('success', false, 'message', 'One of the items in this bundle is already booked for these dates');
      END IF;
    END LOOP;
  END IF;

  -- price is always worked out here, never taken from the client
  IF v_listing.price_per_week IS NOT NULL AND v_days >= 7 THEN
    v_total := (v_days / 7) * v_listing.price_per_week + (v_days % 7) * v_listing.price_per_day;
  ELSE
    v_total := v_days * v_listing.price_per_day;
  END IF;

  INSERT INTO marketplace_bookings (listing_id, renter_id, owner_id, start_date, end_date, total_price, status, message)
  VALUES (p_listing_id, v_uid, v_listing.user_id, p_start, p_end, v_total, 'pending', NULLIF(left(trim(COALESCE(p_message, '')), 500), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_id, 'days', v_days, 'total_price', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_booking(uuid, date, date, text) TO authenticated;

-- Who may change what on a booking.
CREATE OR REPLACE FUNCTION public.marketplace_bookings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner boolean;
  v_renter boolean;
  v_ok boolean := false;
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id OR NEW.renter_id IS DISTINCT FROM OLD.renter_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date OR NEW.total_price IS DISTINCT FROM OLD.total_price
     OR NEW.message IS DISTINCT FROM OLD.message OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the booking status can be changed' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_owner := v_uid = OLD.owner_id;
  v_renter := v_uid = OLD.renter_id;

  IF v_owner THEN
    v_ok := (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled'))
         OR (OLD.status = 'confirmed' AND NEW.status IN ('completed', 'cancelled'));
    IF OLD.status = 'confirmed' AND NEW.status = 'completed' AND OLD.start_date > current_date THEN
      RAISE EXCEPTION 'A booking can only be completed once it has started' USING ERRCODE = '22023';
    END IF;
  ELSIF v_renter THEN
    v_ok := OLD.status IN ('pending', 'confirmed') AND NEW.status = 'cancelled';
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'You cannot change this booking from % to %', OLD.status, NEW.status USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'confirmed' THEN
    -- one confirmed booking per listing and date range (lock so two simultaneous confirms cannot both win)
    PERFORM pg_advisory_xact_lock(hashtext(NEW.listing_id::text));
    IF public.booking_conflicts(NEW.listing_id, NEW.start_date, NEW.end_date, NEW.id) THEN
      RAISE EXCEPTION 'These dates are already booked by another confirmed booking' USING ERRCODE = '23P01';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_bookings_guard ON public.marketplace_bookings;
CREATE TRIGGER trg_marketplace_bookings_guard BEFORE UPDATE ON public.marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_bookings_guard();

-- Keep the auto-created child bookings of a bundle in step with the parent.
CREATE OR REPLACE FUNCTION public.cascade_bundle_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_child record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM marketplace_listings WHERE id = NEW.listing_id AND is_bundle) THEN RETURN NEW; END IF;

  FOR v_child IN
    SELECT id, listing_id FROM marketplace_bookings
    WHERE message = 'Child item auto-booked as part of bundle booking: ' || NEW.id
  LOOP
    IF NEW.status = 'confirmed' THEN
      PERFORM pg_advisory_xact_lock(hashtext(v_child.listing_id::text));
      IF public.booking_conflicts(v_child.listing_id, NEW.start_date, NEW.end_date, v_child.id) THEN
        RAISE EXCEPTION 'An item in this bundle is already booked for these dates' USING ERRCODE = '23P01';
      END IF;
    END IF;
    PERFORM set_config('app.market_system', '1', true);
    UPDATE marketplace_bookings SET status = NEW.status WHERE id = v_child.id;
    PERFORM set_config('app.market_system', '', true);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cascade_bundle_booking_status ON public.marketplace_bookings;
CREATE TRIGGER trg_cascade_bundle_booking_status AFTER UPDATE OF status ON public.marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.cascade_bundle_booking_status();

CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_listing_status ON public.marketplace_bookings (listing_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_renter ON public.marketplace_bookings (renter_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_owner ON public.marketplace_bookings (owner_id, status);

-- ── 6. Reviews ────────────────────────────────────────────────────────────────────────────────────────────────────
-- one vendor review per person (keep the newest if someone already posted several)
DELETE FROM public.marketplace_reviews r
USING public.marketplace_reviews newer
WHERE r.vendor_id IS NOT NULL AND r.vendor_id = newer.vendor_id AND r.reviewer_id = newer.reviewer_id
  AND (r.created_at, r.id) < (newer.created_at, newer.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_reviews_vendor ON public.marketplace_reviews (reviewer_id, vendor_id) WHERE vendor_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_reviews_booking ON public.marketplace_reviews (booking_id) WHERE booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.marketplace_reviews_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking uuid;
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.listing_id IS DISTINCT FROM OLD.listing_id OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id THEN
      RAISE EXCEPTION 'A review cannot be moved to another listing or vendor' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT
  NEW.reviewer_id := v_uid;

  IF NEW.listing_id IS NOT NULL THEN
    -- the reviewer must have a booking that has started (confirmed or completed) for this listing, not yet reviewed
    SELECT b.id INTO v_booking
    FROM marketplace_bookings b
    WHERE b.renter_id = v_uid
      AND b.listing_id = NEW.listing_id
      AND b.status IN ('confirmed', 'completed')
      AND b.start_date <= current_date
      AND (NEW.booking_id IS NULL OR b.id = NEW.booking_id)
      AND NOT EXISTS (SELECT 1 FROM marketplace_reviews r WHERE r.booking_id = b.id)
    ORDER BY b.end_date DESC
    LIMIT 1;
    IF v_booking IS NULL THEN
      RAISE EXCEPTION 'You can review gear after a booking has started and you have not reviewed it yet' USING ERRCODE = '42501';
    END IF;
    NEW.booking_id := v_booking;
  ELSIF NEW.vendor_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM vendors WHERE id = NEW.vendor_id AND owner_id = v_uid) THEN
      RAISE EXCEPTION 'You cannot review your own business' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_reviews_guard ON public.marketplace_reviews;
CREATE TRIGGER trg_marketplace_reviews_guard BEFORE INSERT OR UPDATE ON public.marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_reviews_guard();

DROP POLICY IF EXISTS "Users can create reviews" ON public.marketplace_reviews;
CREATE POLICY "Users can create reviews" ON public.marketplace_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.marketplace_reviews;
CREATE POLICY "Users can update their own reviews" ON public.marketplace_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id AND created_at > now() - interval '48 hours')
  WITH CHECK (auth.uid() = reviewer_id);

-- A wishlist row can only exist once per person and listing.
DELETE FROM public.marketplace_wishlists w
USING public.marketplace_wishlists newer
WHERE w.user_id = newer.user_id AND w.listing_id = newer.listing_id AND (w.created_at, w.id) < (newer.created_at, newer.id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_wishlists_user_listing ON public.marketplace_wishlists (user_id, listing_id);

COMMIT;
