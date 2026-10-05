-- PART V: company page verification request, insights, showcase, ownership transfer. Run AFTER part U. Safe to re-run.
BEGIN;
-- Company pages, new features: verification request, insights, showcase, ownership transfer.
-- Run AFTER part U (needs parts Q + T for is_market_admin / is_page_manager). Safe to re-run.

-- ── 1. Verification request (an admin approves; nothing else sets the badge) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_page_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.company_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_ref text NOT NULL,                 -- 'page_docs:<path>' in the private bucket
  registration_number text,
  website text,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_page_verification_pending ON public.company_page_verification_requests (page_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_page_verification_status ON public.company_page_verification_requests (status, created_at);
ALTER TABLE public.company_page_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or admins read page verification" ON public.company_page_verification_requests;
CREATE POLICY "Owner or admins read page verification" ON public.company_page_verification_requests FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_market_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('page_docs', 'page_docs', false) ON CONFLICT (id) DO UPDATE SET public = false;
DROP POLICY IF EXISTS "Page docs upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Page docs read owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "Page docs delete own folder" ON storage.objects;
CREATE POLICY "Page docs upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'page_docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Page docs read owner or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'page_docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_market_admin()));
CREATE POLICY "Page docs delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'page_docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.submit_page_verification(p_page_id uuid, p_document_ref text, p_registration text, p_website text, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_page company_pages%ROWTYPE;
BEGIN
  SELECT * INTO v_page FROM company_pages WHERE id = p_page_id;
  IF v_uid IS NULL OR v_page.id IS NULL OR v_page.owner_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the owner can request verification');
  END IF;
  IF v_page.is_verified THEN RETURN jsonb_build_object('success', false, 'message', 'This page is already verified'); END IF;
  IF p_document_ref IS NULL OR p_document_ref NOT LIKE 'page_docs:' || v_uid::text || '/%' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attach a company document first');
  END IF;
  IF EXISTS (SELECT 1 FROM company_page_verification_requests WHERE page_id = p_page_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'message', 'A request is already under review');
  END IF;
  INSERT INTO company_page_verification_requests (page_id, owner_id, document_ref, registration_number, website, notes)
  VALUES (p_page_id, v_uid, p_document_ref, NULLIF(left(trim(COALESCE(p_registration, '')), 80), ''),
          NULLIF(left(trim(COALESCE(p_website, '')), 200), ''), NULLIF(left(trim(COALESCE(p_notes, '')), 1000), ''));
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_page_verification(uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_page_verification(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req company_page_verification_requests%ROWTYPE;
  v_slug text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_market_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not allowed');
  END IF;
  SELECT * INTO v_req FROM company_page_verification_requests WHERE id = p_request_id;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'message', 'Request not found or already reviewed'); END IF;

  UPDATE company_page_verification_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewed_by = v_uid, reviewed_at = now(), review_note = NULLIF(trim(COALESCE(p_note, '')), '')
  WHERE id = p_request_id;

  IF p_approve THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE company_pages SET is_verified = true WHERE id = v_req.page_id;
    PERFORM set_config('app.market_system', '', true);
  END IF;

  SELECT slug INTO v_slug FROM company_pages WHERE id = v_req.page_id;
  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_req.owner_id, v_uid, 'page_verification',
          CASE WHEN p_approve THEN 'Your page is verified' ELSE 'Verification not approved' END,
          CASE WHEN p_approve THEN 'Your company page now shows the verified badge.'
               ELSE 'We could not verify your page.' || CASE WHEN p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN ' Note: ' || p_note ELSE '' END END,
          '/pages/' || COALESCE(v_slug, v_req.page_id::text), v_req.page_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_page_verification(uuid, boolean, text) TO authenticated;

-- ── 2. Insights ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.company_pages(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON public.company_page_views (page_id, created_at DESC);
ALTER TABLE public.company_page_views ENABLE ROW LEVEL SECURITY;
-- no direct access: written by record_page_view(), read through page_analytics()

CREATE OR REPLACE FUNCTION public.record_page_view(p_page_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = p_page_id AND user_id = v_uid)
     OR EXISTS (SELECT 1 FROM company_pages WHERE id = p_page_id AND owner_id = v_uid) THEN RETURN; END IF;   -- the team's own opens do not count
  IF NOT EXISTS (SELECT 1 FROM company_pages WHERE id = p_page_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM company_page_views WHERE page_id = p_page_id AND viewer_id = v_uid AND created_at > now() - interval '12 hours') THEN RETURN; END IF;
  INSERT INTO company_page_views (page_id, viewer_id) VALUES (p_page_id, v_uid);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_page_view(uuid) TO authenticated;

-- owner and every page admin role (including analyst) can read the numbers; applications only for managers
CREATE OR REPLACE FUNCTION public.page_analytics(p_page_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager boolean := public.is_page_manager(p_page_id, v_uid);
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (
       v_manager
       OR EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = p_page_id AND user_id = v_uid AND role = 'analyst')
     ) THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT jsonb_build_object(
    'views', (SELECT count(*) FROM company_page_views WHERE page_id = p_page_id),
    'views_30d', (SELECT count(*) FROM company_page_views WHERE page_id = p_page_id AND created_at > now() - interval '30 days'),
    'unique_viewers', (SELECT count(DISTINCT viewer_id) FROM company_page_views WHERE page_id = p_page_id),
    'followers', (SELECT count(*) FROM company_page_followers WHERE page_id = p_page_id),
    'followers_30d', (SELECT count(*) FROM company_page_followers WHERE page_id = p_page_id AND created_at > now() - interval '30 days'),
    'posts', (SELECT count(*) FROM posts WHERE page_id = p_page_id),
    'posts_30d', (SELECT count(*) FROM posts WHERE page_id = p_page_id AND created_at > now() - interval '30 days'),
    'open_jobs', (SELECT count(*) FROM jobs WHERE page_id = p_page_id AND is_active AND NOT is_draft),
    'applications', CASE WHEN v_manager THEN (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id = a.job_id WHERE j.page_id = p_page_id) ELSE NULL END,
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d::date,
        'views', (SELECT count(*) FROM company_page_views v WHERE v.page_id = p_page_id AND v.created_at::date = d::date),
        'followers', (SELECT count(*) FROM company_page_followers f WHERE f.page_id = p_page_id AND f.created_at::date = d::date))
        ORDER BY d)
      FROM generate_series(current_date - 13, current_date, interval '1 day') d
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.page_analytics(uuid) TO authenticated;

-- ── 3. Showcase (gallery images and showreel links) ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_page_showcase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.company_pages(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  url text NOT NULL CHECK (url ~* '^https://' AND length(url) <= 1000),
  caption text CHECK (caption IS NULL OR length(caption) <= 200),
  added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_showcase_page ON public.company_page_showcase (page_id, created_at DESC);
ALTER TABLE public.company_page_showcase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view showcase" ON public.company_page_showcase;
CREATE POLICY "Anyone can view showcase" ON public.company_page_showcase FOR SELECT USING (true);
DROP POLICY IF EXISTS "Managers add showcase" ON public.company_page_showcase;
CREATE POLICY "Managers add showcase" ON public.company_page_showcase FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() AND public.is_page_manager(page_id, auth.uid()));
DROP POLICY IF EXISTS "Managers remove showcase" ON public.company_page_showcase;
CREATE POLICY "Managers remove showcase" ON public.company_page_showcase FOR DELETE TO authenticated
  USING (public.is_page_manager(page_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.company_page_showcase_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM company_page_showcase WHERE page_id = NEW.page_id) >= 12 THEN
    RAISE EXCEPTION 'A page can show up to 12 items' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_company_page_showcase_limit ON public.company_page_showcase;
CREATE TRIGGER trg_company_page_showcase_limit BEFORE INSERT ON public.company_page_showcase
  FOR EACH ROW EXECUTE FUNCTION public.company_page_showcase_limit();

-- ── 4. Ownership transfer (to someone already on the team) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_page_ownership(p_page_id uuid, p_new_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_page company_pages%ROWTYPE;
BEGIN
  SELECT * INTO v_page FROM company_pages WHERE id = p_page_id;
  IF v_page.id IS NULL OR v_uid IS NULL OR v_page.owner_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the owner can transfer the page');
  END IF;
  IF p_new_owner = v_uid THEN RETURN jsonb_build_object('success', false, 'message', 'You already own this page'); END IF;
  IF NOT EXISTS (SELECT 1 FROM company_page_members WHERE page_id = p_page_id AND user_id = p_new_owner) THEN
    RETURN jsonb_build_object('success', false, 'message', 'The new owner must be on the team first');
  END IF;

  PERFORM set_config('app.market_system', '1', true);
  UPDATE company_pages SET owner_id = p_new_owner WHERE id = p_page_id;
  PERFORM set_config('app.market_system', '', true);

  -- full access for the new owner; the previous owner stays on as a super admin
  INSERT INTO company_page_admins (page_id, user_id, role) VALUES (p_page_id, p_new_owner, 'super_admin')
  ON CONFLICT (page_id, user_id) DO UPDATE SET role = 'super_admin';
  INSERT INTO company_page_admins (page_id, user_id, role) VALUES (p_page_id, v_uid, 'super_admin')
  ON CONFLICT (page_id, user_id) DO UPDATE SET role = 'super_admin';
  DELETE FROM company_page_members WHERE page_id = p_page_id AND user_id = p_new_owner;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_new_owner, v_uid, 'page_role', 'You now own ' || v_page.name,
          'The ownership of this page was transferred to you.', '/pages/' || v_page.slug, p_page_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_page_ownership(uuid, uuid) TO authenticated;

COMMIT;
