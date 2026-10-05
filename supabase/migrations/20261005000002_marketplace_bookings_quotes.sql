-- Marketplace & vendors, step 2 + 3: booking workflow, vendor quotes, vendor verification, gear alerts, seller dashboard.
-- Run AFTER part Q (20261005000001). Safe to re-run.
--
--   BOOKINGS      notifications on every step, public availability (booked date ranges), child rows of bundle bookings
--                 are linked to their parent so the screens can hide them.
--   VENDOR QUOTES request -> quote -> accept / decline -> complete, all through functions (no direct writes), with
--                 notifications. Vendor reviews now require an accepted quote.
--   VERIFICATION  vendors submit a document (private bucket); an admin approves or rejects; only that sets the badge.
--   GEAR ALERTS   limit per person.
--   SELLER HUB    listing views + one call that returns the seller's numbers.

-- ── 1. Bundle child bookings get a real link to their parent ──────────────────────────────────────────────────────
ALTER TABLE public.marketplace_bookings ADD COLUMN IF NOT EXISTS parent_booking_id uuid REFERENCES public.marketplace_bookings(id) ON DELETE CASCADE;

UPDATE public.marketplace_bookings c
SET parent_booking_id = p.id
FROM public.marketplace_bookings p
WHERE c.parent_booking_id IS NULL
  AND c.message LIKE 'Child item auto-booked as part of bundle booking: %'
  AND p.id::text = substring(c.message FROM 'bundle booking: (.*)$');

CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_parent ON public.marketplace_bookings (parent_booking_id) WHERE parent_booking_id IS NOT NULL;

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
  IF NEW.parent_booking_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT is_bundle INTO v_is_bundle FROM marketplace_listings WHERE id = NEW.listing_id;
  IF COALESCE(v_is_bundle, false) THEN
    FOR v_child IN SELECT item_id FROM marketplace_bundle_items WHERE bundle_id = NEW.listing_id LOOP
      INSERT INTO marketplace_bookings (listing_id, renter_id, owner_id, start_date, end_date, total_price, status, message, parent_booking_id)
      VALUES (v_child, NEW.renter_id, NEW.owner_id, NEW.start_date, NEW.end_date, 0, NEW.status,
              'Child item auto-booked as part of bundle booking: ' || NEW.id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_bundle_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_child record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.parent_booking_id IS NOT NULL THEN RETURN NEW; END IF;

  FOR v_child IN SELECT id, listing_id FROM marketplace_bookings WHERE parent_booking_id = NEW.id LOOP
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

-- the link to the parent is not editable
CREATE OR REPLACE FUNCTION public.marketplace_bookings_protect_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_booking_id IS DISTINCT FROM OLD.parent_booking_id AND NOT public.market_is_system() AND NOT public.is_market_admin() THEN
    NEW.parent_booking_id := OLD.parent_booking_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_bookings_protect_parent ON public.marketplace_bookings;
CREATE TRIGGER trg_marketplace_bookings_protect_parent BEFORE UPDATE ON public.marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_bookings_protect_parent();

-- ── 2. Booking notifications ──────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text;
  v_range text;
  v_actor uuid := auth.uid();
  v_to uuid;
  v_heading text;
  v_body text;
BEGIN
  IF NEW.parent_booking_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT title INTO v_title FROM marketplace_listings WHERE id = NEW.listing_id;
  v_title := COALESCE(v_title, 'your listing');
  v_range := to_char(NEW.start_date, 'DD Mon') || CASE WHEN NEW.end_date <> NEW.start_date THEN ' – ' || to_char(NEW.end_date, 'DD Mon') ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (NEW.owner_id, NEW.renter_id, 'booking_request', 'New booking request',
            'Someone wants to rent ' || v_title || ' (' || v_range || ').', '/marketplace/bookings', NEW.listing_id, false);
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF v_actor IS NOT NULL AND v_actor = NEW.renter_id THEN
    v_to := NEW.owner_id;
  ELSE
    v_to := NEW.renter_id;
  END IF;

  CASE NEW.status::text
    WHEN 'confirmed' THEN
      v_heading := 'Booking confirmed'; v_body := 'Your booking for ' || v_title || ' (' || v_range || ') was confirmed.';
    WHEN 'cancelled' THEN
      v_heading := CASE WHEN v_to = NEW.owner_id THEN 'Booking cancelled by renter' ELSE 'Booking declined or cancelled' END;
      v_body := CASE WHEN v_to = NEW.owner_id THEN 'The renter cancelled ' ELSE 'The owner cancelled or declined ' END
                || 'the booking for ' || v_title || ' (' || v_range || ').';
    WHEN 'completed' THEN
      v_heading := 'Rental completed'; v_body := 'Your rental of ' || v_title || ' is complete. You can now leave a review.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_to, v_actor, 'booking_update', v_heading, v_body, '/marketplace/bookings', NEW.listing_id, false);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_booking_events ON public.marketplace_bookings;
CREATE TRIGGER trg_notify_booking_events AFTER INSERT OR UPDATE OF status ON public.marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_events();

-- ── 3. Availability: which dates are already taken (no personal data) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.listing_booked_ranges(p_listing_id uuid)
RETURNS TABLE(start_date date, end_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.start_date, b.end_date
  FROM marketplace_bookings b
  WHERE b.status = 'confirmed' AND b.end_date >= current_date
    AND (b.listing_id = p_listing_id
         OR b.listing_id IN (SELECT item_id FROM marketplace_bundle_items WHERE bundle_id = p_listing_id))
  ORDER BY b.start_date;
$$;
GRANT EXECUTE ON FUNCTION public.listing_booked_ranges(uuid) TO anon, authenticated;

-- ── 4. Listing views + seller hub numbers ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listing_views_listing ON public.listing_views (listing_id, created_at DESC);
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;
-- no direct access: written by record_listing_view(), read through seller_hub_stats()

CREATE OR REPLACE FUNCTION public.record_listing_view(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM marketplace_listings WHERE id = p_listing_id AND user_id = v_uid) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM marketplace_listings WHERE id = p_listing_id AND is_active) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM listing_views WHERE listing_id = p_listing_id AND viewer_id = v_uid AND created_at > now() - interval '12 hours') THEN RETURN; END IF;
  INSERT INTO listing_views (listing_id, viewer_id) VALUES (p_listing_id, v_uid);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid) TO authenticated;

-- ── 5. Vendor quotes ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.vendor_services(id) ON DELETE SET NULL,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text,
  brief text NOT NULL CHECK (length(trim(brief)) >= 10 AND length(brief) <= 1500),
  crew_size integer CHECK (crew_size IS NULL OR crew_size BETWEEN 1 AND 1000),
  budget numeric CHECK (budget IS NULL OR budget >= 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'quoted', 'accepted', 'declined', 'cancelled', 'completed')),
  quote_amount numeric CHECK (quote_amount IS NULL OR quote_amount > 0),
  quote_message text CHECK (quote_message IS NULL OR length(quote_message) <= 1000),
  valid_until date,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_quotes_dates CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_vendor ON public.vendor_quotes (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_requester ON public.vendor_quotes (requester_id, status);
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requester reads own quotes" ON public.vendor_quotes;
CREATE POLICY "Requester reads own quotes" ON public.vendor_quotes FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
DROP POLICY IF EXISTS "Vendor owner reads quotes" ON public.vendor_quotes;
CREATE POLICY "Vendor owner reads quotes" ON public.vendor_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.owner_id = auth.uid()));
-- no insert / update / delete policies: everything goes through the functions below

CREATE OR REPLACE FUNCTION public.request_vendor_quote(
  p_vendor_id uuid, p_service_id uuid, p_start date, p_end date, p_location text, p_brief text, p_crew integer, p_budget numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vendor vendors%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Please sign in'); END IF;
  SELECT * INTO v_vendor FROM vendors WHERE id = p_vendor_id;
  IF v_vendor.id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Vendor not found'); END IF;
  IF v_vendor.owner_id = v_uid THEN RETURN jsonb_build_object('success', false, 'message', 'You cannot request a quote from your own business'); END IF;
  IF p_service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vendor_services WHERE id = p_service_id AND vendor_id = p_vendor_id AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'message', 'That service is not available');
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start < current_date OR p_end < p_start OR (p_end - p_start) > 180 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose valid dates (today or later, at most 180 days)');
  END IF;
  IF p_brief IS NULL OR length(trim(p_brief)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Describe what you need (at least 10 characters)');
  END IF;
  IF EXISTS (SELECT 1 FROM vendor_quotes WHERE vendor_id = p_vendor_id AND requester_id = v_uid AND status IN ('requested', 'quoted')) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You already have an open request with this vendor');
  END IF;
  IF (SELECT count(*) FROM vendor_quotes WHERE requester_id = v_uid AND status IN ('requested', 'quoted')) >= 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have too many open requests. Wait for replies first.');
  END IF;

  INSERT INTO vendor_quotes (vendor_id, service_id, requester_id, start_date, end_date, location, brief, crew_size, budget)
  VALUES (p_vendor_id, p_service_id, v_uid, p_start, p_end, NULLIF(left(trim(COALESCE(p_location, '')), 200), ''), trim(p_brief),
          p_crew, p_budget)
  RETURNING id INTO v_id;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_vendor.owner_id, v_uid, 'quote_request', 'New quote request',
          'You have a new request for ' || v_vendor.business_name || ' (' || to_char(p_start, 'DD Mon') || ' – ' || to_char(p_end, 'DD Mon') || ').',
          '/marketplace/quotes', p_vendor_id, false);

  RETURN jsonb_build_object('success', true, 'quote_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_vendor_quote(uuid, uuid, date, date, text, text, integer, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_quote(p_quote_id uuid, p_amount numeric, p_message text, p_valid_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q vendor_quotes%ROWTYPE;
  v_vendor vendors%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM vendor_quotes WHERE id = p_quote_id;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Request not found'); END IF;
  SELECT * INTO v_vendor FROM vendors WHERE id = v_q.vendor_id;
  IF v_uid IS NULL OR v_vendor.owner_id <> v_uid THEN RETURN jsonb_build_object('success', false, 'message', 'Not allowed'); END IF;
  IF v_q.status NOT IN ('requested', 'quoted') THEN RETURN jsonb_build_object('success', false, 'message', 'This request can no longer be quoted'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'message', 'Enter the quote amount'); END IF;

  UPDATE vendor_quotes
  SET status = 'quoted', quote_amount = p_amount, quote_message = NULLIF(left(trim(COALESCE(p_message, '')), 1000), ''),
      valid_until = current_date + LEAST(GREATEST(COALESCE(p_valid_days, 14), 1), 60), responded_at = now(), updated_at = now()
  WHERE id = p_quote_id;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_q.requester_id, v_uid, 'quote_update', 'You received a quote',
          v_vendor.business_name || ' sent you a quote. Review and accept it before it expires.', '/marketplace/quotes', v_q.vendor_id, false);

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_to_quote(uuid, numeric, text, integer) TO authenticated;

-- accept (requester) | decline (either side) | cancel (requester) | complete (vendor, once the job has started)
CREATE OR REPLACE FUNCTION public.decide_quote(p_quote_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q vendor_quotes%ROWTYPE;
  v_vendor vendors%ROWTYPE;
  v_is_vendor boolean;
  v_is_requester boolean;
  v_new text;
  v_to uuid;
  v_heading text;
  v_body text;
BEGIN
  SELECT * INTO v_q FROM vendor_quotes WHERE id = p_quote_id;
  IF v_q.id IS NULL OR v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Request not found'); END IF;
  SELECT * INTO v_vendor FROM vendors WHERE id = v_q.vendor_id;
  v_is_vendor := v_vendor.owner_id = v_uid;
  v_is_requester := v_q.requester_id = v_uid;
  IF NOT v_is_vendor AND NOT v_is_requester THEN RETURN jsonb_build_object('success', false, 'message', 'Not allowed'); END IF;

  IF p_action = 'accept' THEN
    IF NOT v_is_requester OR v_q.status <> 'quoted' THEN RETURN jsonb_build_object('success', false, 'message', 'There is no quote to accept'); END IF;
    IF v_q.valid_until IS NOT NULL AND v_q.valid_until < current_date THEN RETURN jsonb_build_object('success', false, 'message', 'This quote has expired. Ask the vendor for a new one.'); END IF;
    v_new := 'accepted';
    v_to := v_vendor.owner_id; v_heading := 'Quote accepted'; v_body := 'Your quote for ' || v_vendor.business_name || ' was accepted.';
  ELSIF p_action = 'decline' THEN
    IF v_q.status NOT IN ('requested', 'quoted') THEN RETURN jsonb_build_object('success', false, 'message', 'This request is already closed'); END IF;
    v_new := 'declined';
    v_to := CASE WHEN v_is_vendor THEN v_q.requester_id ELSE v_vendor.owner_id END;
    v_heading := 'Request declined';
    v_body := CASE WHEN v_is_vendor THEN v_vendor.business_name || ' declined your request.' ELSE 'A client declined the quote for ' || v_vendor.business_name || '.' END;
  ELSIF p_action = 'cancel' THEN
    IF NOT v_is_requester OR v_q.status NOT IN ('requested', 'quoted', 'accepted') THEN RETURN jsonb_build_object('success', false, 'message', 'You cannot cancel this request'); END IF;
    v_new := 'cancelled';
    v_to := v_vendor.owner_id; v_heading := 'Request cancelled'; v_body := 'A client cancelled their request for ' || v_vendor.business_name || '.';
  ELSIF p_action = 'complete' THEN
    IF NOT v_is_vendor OR v_q.status <> 'accepted' THEN RETURN jsonb_build_object('success', false, 'message', 'Only an accepted job can be completed'); END IF;
    IF v_q.start_date > current_date THEN RETURN jsonb_build_object('success', false, 'message', 'The job has not started yet'); END IF;
    v_new := 'completed';
    v_to := v_q.requester_id; v_heading := 'Job completed'; v_body := 'Your job with ' || v_vendor.business_name || ' is complete. You can now leave a review.';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Unknown action');
  END IF;

  UPDATE vendor_quotes SET status = v_new, updated_at = now() WHERE id = p_quote_id;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_to, v_uid, 'quote_update', v_heading, v_body, '/marketplace/quotes', v_q.vendor_id, false);

  RETURN jsonb_build_object('success', true, 'status', v_new);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decide_quote(uuid, text) TO authenticated;

-- Vendor reviews need a started, accepted quote (one review per person, enforced by the unique index from part Q).
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

  NEW.reviewer_id := v_uid;

  IF NEW.listing_id IS NOT NULL THEN
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
    IF NOT EXISTS (
      SELECT 1 FROM vendor_quotes q
      WHERE q.vendor_id = NEW.vendor_id AND q.requester_id = v_uid AND q.status IN ('accepted', 'completed') AND q.start_date <= current_date
    ) THEN
      RAISE EXCEPTION 'You can review a vendor after working with them (an accepted quote that has started)' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6. Vendor verification ────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_ref text NOT NULL,            -- 'vendor_docs:<path>' in the private bucket
  registration_number text,
  website text,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_verification_pending ON public.vendor_verification_requests (vendor_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vendor_verification_status ON public.vendor_verification_requests (status, created_at);
ALTER TABLE public.vendor_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own verification requests" ON public.vendor_verification_requests;
CREATE POLICY "Owner reads own verification requests" ON public.vendor_verification_requests FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_market_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('vendor_docs', 'vendor_docs', false) ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Vendor docs upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Vendor docs read owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "Vendor docs delete own folder" ON storage.objects;
CREATE POLICY "Vendor docs upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor_docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Vendor docs read owner or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor_docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_market_admin()));
CREATE POLICY "Vendor docs delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor_docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.submit_vendor_verification(p_vendor_id uuid, p_document_ref text, p_registration text, p_website text, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vendor vendors%ROWTYPE;
BEGIN
  SELECT * INTO v_vendor FROM vendors WHERE id = p_vendor_id;
  IF v_uid IS NULL OR v_vendor.id IS NULL OR v_vendor.owner_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  IF v_vendor.is_verified THEN RETURN jsonb_build_object('success', false, 'message', 'This business is already verified'); END IF;
  IF p_document_ref IS NULL OR p_document_ref NOT LIKE 'vendor_docs:' || v_uid::text || '/%' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attach a business document first');
  END IF;
  IF EXISTS (SELECT 1 FROM vendor_verification_requests WHERE vendor_id = p_vendor_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'message', 'A verification request is already under review');
  END IF;
  INSERT INTO vendor_verification_requests (vendor_id, owner_id, document_ref, registration_number, website, notes)
  VALUES (p_vendor_id, v_uid, p_document_ref, NULLIF(left(trim(COALESCE(p_registration, '')), 80), ''), NULLIF(left(trim(COALESCE(p_website, '')), 200), ''),
          NULLIF(left(trim(COALESCE(p_notes, '')), 1000), ''));
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_vendor_verification(uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_vendor_verification(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req vendor_verification_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_market_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  SELECT * INTO v_req FROM vendor_verification_requests WHERE id = p_request_id;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'message', 'Request not found or already reviewed'); END IF;

  UPDATE vendor_verification_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewed_by = v_uid, reviewed_at = now(), review_note = NULLIF(trim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  IF p_approve THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE vendors SET is_verified = true, verification_date = now() WHERE id = v_req.vendor_id;
    PERFORM set_config('app.market_system', '', true);
  END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_req.owner_id, v_uid, 'vendor_verification',
          CASE WHEN p_approve THEN 'Your business is verified' ELSE 'Verification not approved' END,
          CASE WHEN p_approve THEN 'Your vendor profile now shows the verified badge.'
               ELSE 'We could not verify your business.' || CASE WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN ' Note: ' || p_note ELSE '' END END,
          '/vendors/' || v_req.vendor_id::text, v_req.vendor_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_vendor_verification(uuid, boolean, text) TO authenticated;

-- ── 7. Gear alerts: at most 10 per person ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gear_alerts_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM gear_alerts WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'You can save up to 10 gear alerts' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gear_alerts_limit ON public.gear_alerts;
CREATE TRIGGER trg_gear_alerts_limit BEFORE INSERT ON public.gear_alerts
  FOR EACH ROW EXECUTE FUNCTION public.gear_alerts_limit();

-- ── 8. Seller hub numbers (one call) ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_hub_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listings jsonb;
  v_vendors jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'AUTH'); END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_listings FROM (
    SELECT l.id, l.title, l.images[1] AS image, l.price_per_day, l.is_active, COALESCE(l.is_bundle, false) AS is_bundle,
           COALESCE(l.admin_flagged, false) AS admin_flagged, l.created_at,
           (SELECT count(*) FROM listing_views v WHERE v.listing_id = l.id) AS views,
           (SELECT count(*) FROM marketplace_wishlists w WHERE w.listing_id = l.id) AS saves,
           (SELECT count(*) FROM marketplace_bookings b WHERE b.listing_id = l.id AND b.parent_booking_id IS NULL AND b.status = 'pending') AS pending,
           (SELECT count(*) FROM marketplace_bookings b WHERE b.listing_id = l.id AND b.parent_booking_id IS NULL AND b.status = 'confirmed') AS confirmed,
           (SELECT count(*) FROM marketplace_bookings b WHERE b.listing_id = l.id AND b.parent_booking_id IS NULL AND b.status = 'completed') AS completed,
           COALESCE((SELECT sum(b.total_price) FROM marketplace_bookings b WHERE b.listing_id = l.id AND b.parent_booking_id IS NULL AND b.status IN ('confirmed', 'completed')), 0) AS revenue
    FROM marketplace_listings l
    WHERE l.user_id = v_uid
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(y) ORDER BY y.created_at DESC), '[]'::jsonb) INTO v_vendors FROM (
    SELECT v.id, v.business_name, v.logo_url, v.is_verified, v.created_at,
           (SELECT count(*) FROM vendor_quotes q WHERE q.vendor_id = v.id AND q.status = 'requested') AS requested,
           (SELECT count(*) FROM vendor_quotes q WHERE q.vendor_id = v.id AND q.status = 'quoted') AS quoted,
           (SELECT count(*) FROM vendor_quotes q WHERE q.vendor_id = v.id AND q.status = 'accepted') AS accepted,
           (SELECT count(*) FROM vendor_quotes q WHERE q.vendor_id = v.id AND q.status = 'completed') AS completed,
           COALESCE((SELECT sum(q.quote_amount) FROM vendor_quotes q WHERE q.vendor_id = v.id AND q.status IN ('accepted', 'completed')), 0) AS won_value,
           (SELECT status FROM vendor_verification_requests r WHERE r.vendor_id = v.id ORDER BY r.created_at DESC LIMIT 1) AS verification_status
    FROM vendors v
    WHERE v.owner_id = v_uid
  ) y;

  RETURN jsonb_build_object('listings', v_listings, 'vendors', v_vendors);
END;
$$;
GRANT EXECUTE ON FUNCTION public.seller_hub_stats() TO authenticated;

-- ── 9. Gear alert matching runs as the system (the person listing the gear cannot write other people's notifications)
CREATE OR REPLACE FUNCTION public.notify_gear_alert_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, message, action_url, trigger_user_id, related_id)
  SELECT a.user_id, 'gear_alert', 'New Gear Alert Match',
         'A listing matching your alert has been added: ' || NEW.title, '/marketplace/' || NEW.id, NEW.user_id, NEW.id
  FROM gear_alerts a
  WHERE a.user_id <> NEW.user_id
    AND (a.category IS NULL OR a.category = NEW.category)
    AND (a.keyword IS NULL OR NEW.title ILIKE '%' || a.keyword || '%')
    AND (a.max_price IS NULL OR NEW.price_per_day <= a.max_price);
  RETURN NEW;
END;
$$;
