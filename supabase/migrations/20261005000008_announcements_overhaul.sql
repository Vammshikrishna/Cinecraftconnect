-- Announcements: security fixes + missing features. Run AFTER part W (needs is_page_manager from part T).
-- Safe to re-run.
--
-- SECURITY FIXES
--   * Anyone signed in could create an announcement as ANY company page and with any author. The author is now always
--     the caller and a page announcement needs the person to manage that page (owner / super admin / content admin).
--   * Any page admin row (analysts too) could edit or delete a page's announcements: managers only now.
--   * Platform staff could not remove abusive announcements. They can now (delete / edit), and announcements can be
--     reported and taken down through the normal report flow.
--   * No limits: title / text length caps, 10 announcements per person per day, 3 pinned per publisher.
-- NEW
--   categories, cover image, pinning, audience (everyone / followers / team), expiry, scheduling, "edited" mark,
--   view counts, unread tracking, server-side paging / search / filters, and notifications to the
--   people who follow the publisher (or the team, for team-only announcements).

-- ── columns ───────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS pinned_until timestamptz;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;

-- announcements that already exist were visible and are not re-announced to anyone
UPDATE public.announcements SET notified = true WHERE notified = false AND posted_at <= now();

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_category_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_category_check
  CHECK (category IN ('general', 'event', 'hiring', 'release', 'news', 'maintenance'));
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_audience_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_audience_check CHECK (audience IN ('everyone', 'followers', 'team'));
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_title_len;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_title_len CHECK (char_length(title) BETWEEN 1 AND 150) NOT VALID;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_content_len;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_content_len CHECK (char_length(content) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_image_https;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_image_https CHECK (image_url IS NULL OR image_url ~* '^https://') NOT VALID;

CREATE INDEX IF NOT EXISTS idx_announcements_posted ON public.announcements (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_page ON public.announcements (publisher_page_id, posted_at DESC) WHERE publisher_page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_author ON public.announcements (author_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_unsent ON public.announcements (posted_at) WHERE NOT notified;

-- ── who may see an announcement ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_page_team(p_page_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_page_id IS NOT NULL AND p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM company_pages WHERE id = p_page_id AND owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = p_page_id AND user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM company_page_members WHERE page_id = p_page_id AND user_id = p_user_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_page_team(uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.announcement_visible(p_audience text, p_author uuid, p_page uuid, p_posted timestamptz, p_expires timestamptz, p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- the publisher side and staff always see it (drafts-in-waiting, expired ones, team-only)
  IF p_uid IS NOT NULL AND (p_author = p_uid OR (p_page IS NOT NULL AND public.is_page_manager(p_page, p_uid)) OR public.is_current_user_internal()) THEN
    RETURN true;
  END IF;
  IF p_posted > now() OR (p_expires IS NOT NULL AND p_expires <= now()) THEN
    RETURN false;
  END IF;
  IF p_audience = 'everyone' THEN RETURN true; END IF;
  IF p_uid IS NULL THEN RETURN false; END IF;

  IF p_audience = 'team' THEN
    RETURN p_page IS NOT NULL AND public.is_page_team(p_page, p_uid);
  END IF;
  -- followers
  IF p_page IS NOT NULL THEN
    RETURN public.is_page_team(p_page, p_uid)
        OR EXISTS (SELECT 1 FROM company_page_followers f WHERE f.page_id = p_page AND f.user_id = p_uid);
  END IF;
  RETURN EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = p_uid AND uf.following_id = p_author);
END;
$$;
GRANT EXECUTE ON FUNCTION public.announcement_visible(text, uuid, uuid, timestamptz, timestamptz, uuid) TO anon, authenticated, service_role;

-- ── guard: the caller is the author, page rights, limits, protected columns ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.announcements_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pinned integer;
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.author_id := v_uid;
    NEW.view_count := 0;
    NEW.edited_at := NULL;
    NEW.notified := false;
    IF NEW.posted_at IS NULL THEN NEW.posted_at := now(); END IF;
    IF NEW.posted_at < now() - interval '5 minutes' THEN NEW.posted_at := now(); END IF;   -- no back-dating
    IF (SELECT count(*) FROM announcements WHERE author_id = v_uid AND posted_at > now() - interval '24 hours') >= 10 THEN
      RAISE EXCEPTION 'You can post up to 10 announcements a day' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NOT (OLD.author_id = v_uid OR (OLD.publisher_page_id IS NOT NULL AND public.is_page_manager(OLD.publisher_page_id, v_uid)) OR public.is_current_user_internal()) THEN
      RAISE EXCEPTION 'You cannot change this announcement' USING ERRCODE = '42501';
    END IF;
    NEW.author_id := OLD.author_id;
    NEW.publisher_page_id := OLD.publisher_page_id;
    NEW.view_count := OLD.view_count;
    NEW.notified := OLD.notified;
    IF OLD.posted_at <= now() THEN NEW.posted_at := OLD.posted_at; END IF;     -- only a scheduled one can be re-timed
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.category IS DISTINCT FROM OLD.category OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
      NEW.edited_at := now();
    END IF;
  END IF;

  IF NEW.publisher_page_id IS NOT NULL AND TG_OP = 'INSERT' AND NOT public.is_page_manager(NEW.publisher_page_id, v_uid) THEN
    RAISE EXCEPTION 'You can only announce as a page you manage' USING ERRCODE = '42501';
  END IF;
  IF NEW.publisher_page_id IS NULL AND NEW.audience = 'team' THEN
    NEW.audience := 'everyone';                                              -- a person has no "team"
  END IF;
  IF NEW.posted_at > now() + interval '60 days' THEN
    RAISE EXCEPTION 'An announcement can be scheduled at most 60 days ahead' USING ERRCODE = '22023';
  END IF;
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= NEW.posted_at THEN
    RAISE EXCEPTION 'The end date must be after the start' USING ERRCODE = '22023';
  END IF;

  IF NEW.is_pinned THEN
    SELECT count(*) INTO v_pinned FROM announcements a
    WHERE a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())
      AND a.id <> NEW.id
      AND ((NEW.publisher_page_id IS NOT NULL AND a.publisher_page_id = NEW.publisher_page_id)
        OR (NEW.publisher_page_id IS NULL AND a.publisher_page_id IS NULL AND a.author_id = NEW.author_id));
    IF v_pinned >= 3 THEN
      RAISE EXCEPTION 'You can pin up to 3 announcements. Unpin one first.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.pinned_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_announcements_guard ON public.announcements;
CREATE TRIGGER trg_announcements_guard BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.announcements_guard();

-- ── policies ──────────────────────────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Auth View Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Visible announcements" ON public.announcements;
CREATE POLICY "Visible announcements" ON public.announcements FOR SELECT TO public
  USING (public.announcement_visible(audience, author_id, publisher_page_id, posted_at, expires_at, auth.uid()));

DROP POLICY IF EXISTS "Auth Create Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Create own announcements" ON public.announcements;
CREATE POLICY "Create own announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (publisher_page_id IS NULL OR public.is_page_manager(publisher_page_id, auth.uid())));

DROP POLICY IF EXISTS "Author Manage Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Page admins can manage page announcements" ON public.announcements;
DROP POLICY IF EXISTS "Manage own or page announcements" ON public.announcements;
CREATE POLICY "Manage own or page announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid())) OR public.is_current_user_internal())
  WITH CHECK (true);
DROP POLICY IF EXISTS "Delete own or page announcements" ON public.announcements;
CREATE POLICY "Delete own or page announcements" ON public.announcements FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid())) OR public.is_current_user_internal());

-- ── views, seen ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_views (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, viewer_id)
);
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
-- no direct access: written by record_announcement_view()

CREATE OR REPLACE FUNCTION public.record_announcement_view(p_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM announcements a WHERE a.id = p_announcement_id
                 AND public.announcement_visible(a.audience, a.author_id, a.publisher_page_id, a.posted_at, a.expires_at, v_uid)) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM announcements WHERE id = p_announcement_id AND author_id = v_uid) THEN RETURN; END IF;
  INSERT INTO announcement_views (announcement_id, viewer_id) VALUES (p_announcement_id, v_uid) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE announcements SET view_count = view_count + 1 WHERE id = p_announcement_id;
    PERFORM set_config('app.market_system', '', true);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_announcement_view(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.announcement_seen (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcement_seen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own seen marker" ON public.announcement_seen;
CREATE POLICY "Own seen marker" ON public.announcement_seen FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_announcements_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO announcement_seen (user_id, seen_at) SELECT auth.uid(), now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET seen_at = now();
$$;
GRANT EXECUTE ON FUNCTION public.mark_announcements_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.unread_announcement_count()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer FROM announcements a
  WHERE auth.uid() IS NOT NULL
    AND a.posted_at <= now()
    AND a.author_id IS DISTINCT FROM auth.uid()
    AND a.posted_at > COALESCE((SELECT seen_at FROM announcement_seen WHERE user_id = auth.uid()), now() - interval '14 days');
$$;
GRANT EXECUTE ON FUNCTION public.unread_announcement_count() TO authenticated;

-- ── notifications ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_announcement_notifications(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a announcements%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO a FROM announcements WHERE id = p_id;
  IF a.id IS NULL THEN RETURN; END IF;

  IF a.publisher_page_id IS NOT NULL THEN
    SELECT name INTO v_name FROM company_pages WHERE id = a.publisher_page_id;
  ELSE
    SELECT COALESCE(full_name, username) INTO v_name FROM profiles WHERE id = a.author_id;
  END IF;

  INSERT INTO notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  SELECT r.user_id, a.author_id, 'announcement', COALESCE(v_name, 'New') || ' announced', left(a.title, 120), '/announcements', a.id, false
  FROM (
    SELECT DISTINCT u AS user_id FROM (
      -- the team always hears about it
      SELECT user_id AS u FROM company_page_members WHERE a.publisher_page_id IS NOT NULL AND page_id = a.publisher_page_id
      UNION ALL
      SELECT user_id FROM company_page_admins WHERE a.publisher_page_id IS NOT NULL AND page_id = a.publisher_page_id
      UNION ALL
      -- followers of the page (not for team-only ones)
      SELECT user_id FROM company_page_followers WHERE a.publisher_page_id IS NOT NULL AND a.audience <> 'team' AND page_id = a.publisher_page_id
      UNION ALL
      -- followers of the person
      SELECT follower_id FROM user_follows WHERE a.publisher_page_id IS NULL AND following_id = a.author_id
    ) x
    WHERE u IS NOT NULL AND u <> a.author_id
    LIMIT 500
  ) r;
END;
$$;
REVOKE ALL ON FUNCTION public.send_announcement_notifications(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.announcements_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.posted_at <= now() THEN
    PERFORM public.send_announcement_notifications(NEW.id);
    PERFORM set_config('app.market_system', '1', true);
    UPDATE announcements SET notified = true WHERE id = NEW.id;
    PERFORM set_config('app.market_system', '', true);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_announcements_after_insert ON public.announcements;
CREATE TRIGGER trg_announcements_after_insert AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.announcements_after_insert();

-- scheduled announcements notify when their time comes (called whenever the list is loaded)
CREATE OR REPLACE FUNCTION public.notify_due_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM announcements WHERE NOT notified AND posted_at <= now() ORDER BY posted_at LIMIT 20 LOOP
    PERFORM public.send_announcement_notifications(r.id);
    PERFORM set_config('app.market_system', '1', true);
    UPDATE announcements SET notified = true WHERE id = r.id;
    PERFORM set_config('app.market_system', '', true);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_due_announcements() FROM PUBLIC, anon, authenticated;
-- the list (which runs as the caller) triggers due notifications, so the callers must be allowed to run this
GRANT EXECUTE ON FUNCTION public.notify_due_announcements() TO anon, authenticated;


-- ── the list: paging, search, filters, counts, unread (one call) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_announcements(
  p_limit integer DEFAULT 20,
  p_before timestamptz DEFAULT NULL,
  p_filter text DEFAULT 'all',          -- all | following | mine | pages
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seen timestamptz;
  v_term text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_like text;
  v_rows jsonb;
BEGIN
  PERFORM public.notify_due_announcements();
  IF v_uid IS NOT NULL THEN
    SELECT seen_at INTO v_seen FROM announcement_seen WHERE user_id = v_uid;
  END IF;
  IF v_term IS NOT NULL THEN
    v_like := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  SELECT COALESCE(jsonb_agg(row_json ORDER BY pinned_now DESC, posted_at DESC), '[]'::jsonb) INTO v_rows FROM (
    SELECT
      (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())) AS pinned_now,
      a.posted_at,
      jsonb_build_object(
        'id', a.id, 'title', a.title, 'content', a.content, 'posted_at', a.posted_at,
        'author_id', a.author_id, 'publisher_page_id', a.publisher_page_id,
        'category', a.category, 'image_url', a.image_url, 'audience', a.audience,
        'is_pinned', (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())),
        'expires_at', a.expires_at, 'edited_at', a.edited_at, 'view_count', a.view_count,
        'scheduled', a.posted_at > now(),
        'expired', (a.expires_at IS NOT NULL AND a.expires_at <= now()),
        'unread', (v_uid IS NOT NULL AND a.author_id IS DISTINCT FROM v_uid AND a.posted_at <= now()
                   AND a.posted_at > COALESCE(v_seen, now() - interval '14 days')),
        'profiles', CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name, 'username', pr.username, 'avatar_url', pr.avatar_url) END,
        'company_pages', CASE WHEN cp.id IS NOT NULL THEN jsonb_build_object('id', cp.id, 'name', cp.name, 'logo_url', cp.logo_url, 'slug', cp.slug, 'is_verified', cp.is_verified) END
      ) AS row_json
    FROM announcements a
    LEFT JOIN profiles pr ON pr.id = a.author_id
    LEFT JOIN company_pages cp ON cp.id = a.publisher_page_id
    WHERE (p_category IS NULL OR a.category = p_category)
      AND (v_like IS NULL OR a.title ILIKE v_like OR a.content ILIKE v_like OR cp.name ILIKE v_like)
      AND (CASE p_filter
             WHEN 'following' THEN v_uid IS NOT NULL AND (
                  (a.publisher_page_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_page_followers f WHERE f.page_id = a.publisher_page_id AND f.user_id = v_uid))
               OR (a.publisher_page_id IS NULL AND EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = v_uid AND uf.following_id = a.author_id)))
             WHEN 'mine' THEN v_uid IS NOT NULL AND (a.author_id = v_uid OR (a.publisher_page_id IS NOT NULL AND public.is_page_manager(a.publisher_page_id, v_uid)))
             WHEN 'pages' THEN a.publisher_page_id IS NOT NULL
             ELSE true END)
      AND (
        (p_before IS NULL AND (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())))
        OR (NOT (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())) AND (p_before IS NULL OR a.posted_at < p_before))
      )
    ORDER BY (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())) DESC, a.posted_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  ) q;

  RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_announcements(integer, timestamptz, text, text, text) TO anon, authenticated;

-- ── reports: announcements can be taken down through the normal two-person flow ────────────────────────────────
CREATE OR REPLACE FUNCTION public._apply_report_action(
  p_report_id uuid, p_action text, p_note text, p_maker uuid, p_checker uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_author uuid;
  v_tid uuid;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  BEGIN
    v_tid := v_report.target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  IF v_tid IS NOT NULL THEN
    v_author := CASE v_report.target_type
      WHEN 'user'    THEN v_tid
      WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_tid)
      WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_tid)
      WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_tid)
      WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_tid)
      WHEN 'announcement' THEN (SELECT author_id FROM public.announcements WHERE id = v_tid)
      WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_tid)
      ELSE NULL
    END;
  END IF;

  IF p_action = 'takedown' THEN
    IF v_tid IS NULL OR v_report.target_type NOT IN ('post', 'comment', 'job', 'listing', 'room', 'announcement') THEN
      RAISE EXCEPTION 'Cannot take down target type % (use user management for accounts; messages are encrypted)', v_report.target_type;
    END IF;
    IF v_report.target_type = 'post' THEN DELETE FROM public.posts WHERE id = v_tid;
    ELSIF v_report.target_type = 'comment' THEN DELETE FROM public.post_comments WHERE id = v_tid;
    ELSIF v_report.target_type = 'job' THEN DELETE FROM public.jobs WHERE id = v_tid;
    ELSIF v_report.target_type = 'listing' THEN DELETE FROM public.marketplace_listings WHERE id = v_tid;
    ELSIF v_report.target_type = 'announcement' THEN DELETE FROM public.announcements WHERE id = v_tid;
    ELSIF v_report.target_type = 'room' THEN DELETE FROM public.discussion_rooms WHERE id = v_tid;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
      RAISE EXCEPTION 'Content no longer exists';
    END IF;
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles SET is_shadowbanned = true, shadow_banned_at = now() WHERE id = v_author;
  ELSIF p_action <> 'dismiss' THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  UPDATE public.content_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         reviewed_by = COALESCE(p_checker, p_maker),
         reviewed_at = now(),
         resolution_note = COALESCE(p_note, p_action)
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (COALESCE(p_checker, p_maker), 'moderator', 'report_' || p_action, v_report.target_type, v_report.target_id,
          jsonb_build_object('report_id', p_report_id, 'author_id', v_author, 'note', p_note,
                             'maker_id', p_maker, 'checker_id', p_checker));

  RETURN jsonb_build_object('success', true, 'action', p_action, 'author_id', v_author);
END;
$$;
REVOKE ALL ON FUNCTION public._apply_report_action(uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
