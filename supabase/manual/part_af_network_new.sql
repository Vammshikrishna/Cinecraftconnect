-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AF – Network: new features
--   1. private notes and tags on connections
--   2. crew availability ("open to work") with a Discover filter
--   3. introductions through a mutual connection
--   4. collaborators: people from your project spaces you are not connected to yet
--   5. network insights
--   6. smarter suggestions (shared projects and company pages)
-- Run after part AE, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 0. when a connection was accepted (for "new connections this month") ─────────────────────────────────────────
ALTER TABLE public.user_connections ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
UPDATE public.user_connections SET accepted_at = created_at WHERE status = 'accepted' AND accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_connection_accepted_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    NEW.accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_connection_accepted_at ON public.user_connections;
CREATE TRIGGER trg_set_connection_accepted_at BEFORE UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_connection_accepted_at();

-- ── 1. private notes and tags ────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connection_notes (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  other_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  tags text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, other_id),
  CHECK (owner_id <> other_id)
);
ALTER TABLE public.connection_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connection_notes_own ON public.connection_notes;
CREATE POLICY connection_notes_own ON public.connection_notes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
REVOKE ALL ON public.connection_notes FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_notes TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_connection_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tags text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_connections
                  WHERE status = 'accepted'
                    AND ((follower_id = NEW.owner_id AND following_id = NEW.other_id)
                      OR (follower_id = NEW.other_id AND following_id = NEW.owner_id))) THEN
    RAISE EXCEPTION 'You can only add notes to your connections' USING ERRCODE = 'P0001';
  END IF;
  NEW.note := left(NULLIF(btrim(COALESCE(NEW.note, '')), ''), 500);
  -- tags: lower-case, trimmed, unique, up to 10 of up to 24 characters
  SELECT COALESCE(array_agg(t), '{}') INTO v_tags FROM (
    SELECT DISTINCT left(lower(btrim(x)), 24) AS t FROM unnest(COALESCE(NEW.tags, '{}')) AS x
     WHERE btrim(x) <> '' LIMIT 10) q;
  NEW.tags := v_tags;
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.connection_notes WHERE owner_id = NEW.owner_id) >= 2000 THEN
    RAISE EXCEPTION 'Too many notes' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_connection_note ON public.connection_notes;
CREATE TRIGGER trg_guard_connection_note BEFORE INSERT OR UPDATE ON public.connection_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_connection_note();

-- notes go away with the connection
CREATE OR REPLACE FUNCTION public.drop_notes_with_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.connection_notes
   WHERE (owner_id = OLD.follower_id AND other_id = OLD.following_id)
      OR (owner_id = OLD.following_id AND other_id = OLD.follower_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_drop_notes_with_connection ON public.user_connections;
CREATE TRIGGER trg_drop_notes_with_connection AFTER DELETE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.drop_notes_with_connection();

-- ── 2. crew availability ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_availability (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_looking' CHECK (status IN ('open', 'booked', 'not_looking')),
  booked_until date,
  rate_min integer CHECK (rate_min IS NULL OR rate_min >= 0),
  rate_max integer CHECK (rate_max IS NULL OR rate_max >= 0),
  rate_currency text NOT NULL DEFAULT 'INR',
  cities text[] NOT NULL DEFAULT '{}',
  note text,
  visibility text NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'connections')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_availability_open ON public.profile_availability (status) WHERE status = 'open';

ALTER TABLE public.profile_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_availability_select ON public.profile_availability;
DROP POLICY IF EXISTS profile_availability_insert ON public.profile_availability;
DROP POLICY IF EXISTS profile_availability_update ON public.profile_availability;
DROP POLICY IF EXISTS profile_availability_delete ON public.profile_availability;
CREATE POLICY profile_availability_select ON public.profile_availability FOR SELECT TO authenticated
  USING (user_id = auth.uid()
      OR visibility = 'everyone'
      OR EXISTS (SELECT 1 FROM public.user_connections uc
                  WHERE uc.status = 'accepted'
                    AND ((uc.follower_id = auth.uid() AND uc.following_id = profile_availability.user_id)
                      OR (uc.following_id = auth.uid() AND uc.follower_id = profile_availability.user_id))));
CREATE POLICY profile_availability_insert ON public.profile_availability FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_availability_update ON public.profile_availability FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_availability_delete ON public.profile_availability FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.profile_availability FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_availability TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cities text[];
BEGIN
  IF COALESCE((SELECT account_type FROM public.profiles WHERE id = NEW.user_id), 'fan') = 'fan' THEN
    RAISE EXCEPTION 'Availability is for creators and studios' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.rate_min IS NOT NULL AND NEW.rate_max IS NOT NULL AND NEW.rate_min > NEW.rate_max THEN
    RAISE EXCEPTION 'The minimum rate cannot be higher than the maximum' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status <> 'booked' THEN
    NEW.booked_until := NULL;
  END IF;
  NEW.note := left(NULLIF(btrim(COALESCE(NEW.note, '')), ''), 200);
  NEW.rate_currency := left(upper(COALESCE(NULLIF(btrim(NEW.rate_currency), ''), 'INR')), 3);
  SELECT COALESCE(array_agg(c), '{}') INTO v_cities FROM (
    SELECT DISTINCT left(btrim(x), 40) AS c FROM unnest(COALESCE(NEW.cities, '{}')) AS x WHERE btrim(x) <> '' LIMIT 10) q;
  NEW.cities := v_cities;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_availability ON public.profile_availability;
CREATE TRIGGER trg_guard_profile_availability BEFORE INSERT OR UPDATE ON public.profile_availability
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_availability();

-- can the viewer see this person's availability? (same rule as the policy, for use inside the functions below)
CREATE OR REPLACE FUNCTION public.can_see_availability(p_user uuid, p_visibility text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user = auth.uid() OR p_visibility = 'everyone'
      OR EXISTS (SELECT 1 FROM public.user_connections uc
                  WHERE uc.status = 'accepted'
                    AND ((uc.follower_id = auth.uid() AND uc.following_id = p_user)
                      OR (uc.following_id = auth.uid() AND uc.follower_id = p_user)));
$$;

-- ── 3. introductions ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connection_introductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  via_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> target_id AND requester_id <> via_id AND target_id <> via_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS connection_introductions_pending ON public.connection_introductions (requester_id, target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS connection_introductions_via ON public.connection_introductions (via_id, status);

ALTER TABLE public.connection_introductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connection_introductions_select ON public.connection_introductions;
CREATE POLICY connection_introductions_select ON public.connection_introductions FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR via_id = auth.uid());
REVOKE ALL ON public.connection_introductions FROM anon, PUBLIC;
GRANT SELECT ON public.connection_introductions TO authenticated;
-- writes only through request_introduction / respond_introduction

-- my connections who are also connected to the target (the people who could introduce me)
CREATE OR REPLACE FUNCTION public.introduction_options(p_target uuid)
RETURNS TABLE (id uuid, full_name text, username text, avatar_url text, craft text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url, p.craft
    FROM public.profiles p
   WHERE p.id <> auth.uid() AND p.id <> p_target
     AND EXISTS (SELECT 1 FROM public.user_connections a WHERE a.status = 'accepted'
                  AND ((a.follower_id = auth.uid() AND a.following_id = p.id) OR (a.following_id = auth.uid() AND a.follower_id = p.id)))
     AND EXISTS (SELECT 1 FROM public.user_connections b WHERE b.status = 'accepted'
                  AND ((b.follower_id = p_target AND b.following_id = p.id) OR (b.following_id = p_target AND b.follower_id = p.id)))
     AND COALESCE(p.is_banned, false) = false
   ORDER BY p.full_name
   LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.introduction_options(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.introduction_options(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_introduction(p_target uuid, p_via uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_note text := left(NULLIF(btrim(COALESCE(p_note, '')), ''), 300);
  v_name text;
  v_target_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF p_target IS NULL OR p_via IS NULL OR p_target = v_me OR p_via = v_me OR p_target = p_via THEN
    RAISE EXCEPTION 'Invalid introduction' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_connections WHERE (follower_id = v_me AND following_id = p_target) OR (follower_id = p_target AND following_id = v_me)) THEN
    RAISE EXCEPTION 'You are already connected or have a request open with this person' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_options(p_target) o WHERE o.id = p_via) THEN
    RAISE EXCEPTION 'That person is not connected to both of you' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id IN (p_target, p_via)) OR (b.user_id IN (p_target, p_via) AND b.blocked_user_id = v_me)) THEN
    RAISE EXCEPTION 'You cannot ask for this introduction' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.connection_introductions WHERE requester_id = v_me AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You can ask for up to 5 introductions a day' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.connection_introductions (requester_id, target_id, via_id, note) VALUES (v_me, p_target, p_via, v_note);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You already asked for an introduction to this person' USING ERRCODE = 'P0001';
  END;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  SELECT COALESCE(full_name, username, 'someone') INTO v_target_name FROM public.profiles WHERE id = p_target;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_via, v_me, 'introduction_request', 'Introduction request',
          v_name || ' asks you to introduce them to ' || v_target_name, '/network', p_target, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.request_introduction(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_introduction(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_introduction(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.connection_introductions%ROWTYPE;
  v_pref text;
  v_via_name text;
  v_target_name text;
  v_note text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_row FROM public.connection_introductions WHERE id = p_id AND via_id = v_me AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introduction not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_via_name FROM public.profiles WHERE id = v_me;
  SELECT COALESCE(full_name, username, 'someone') INTO v_target_name FROM public.profiles WHERE id = v_row.target_id;

  IF NOT COALESCE(p_accept, false) THEN
    UPDATE public.connection_introductions SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (v_row.requester_id, v_me, 'introduction_declined', 'Introduction not taken forward',
            v_via_name || ' could not make this introduction', '/network', p_id, false);
    RETURN jsonb_build_object('success', true, 'status', 'declined');
  END IF;

  -- the introduced person still decides: this sends them a normal connection request with the introduction as the note
  IF EXISTS (SELECT 1 FROM public.user_connections WHERE (follower_id = v_row.requester_id AND following_id = v_row.target_id)
                                                     OR (follower_id = v_row.target_id AND following_id = v_row.requester_id)) THEN
    RAISE EXCEPTION 'They are already connected or have a request open' USING ERRCODE = 'P0001';
  END IF;
  SELECT allow_connection_requests INTO v_pref FROM public.user_settings WHERE user_id = v_row.target_id;
  IF v_pref = 'nobody' THEN
    RAISE EXCEPTION 'This person is not accepting connection requests' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_row.requester_id AND b.blocked_user_id = v_row.target_id)
                 OR (b.user_id = v_row.target_id AND b.blocked_user_id = v_row.requester_id)) THEN
    RAISE EXCEPTION 'This introduction cannot be made' USING ERRCODE = 'P0001';
  END IF;

  v_note := left('Introduced by ' || v_via_name || COALESCE(': ' || v_row.note, ''), 200);
  PERFORM set_config('app.market_system', '1', true);
  INSERT INTO public.user_connections (follower_id, following_id, status, note) VALUES (v_row.requester_id, v_row.target_id, 'pending', v_note);
  PERFORM set_config('app.market_system', '', true);

  UPDATE public.connection_introductions SET status = 'accepted', responded_at = now() WHERE id = p_id;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (v_row.requester_id, v_me, 'introduction_accepted', 'Introduction made',
          v_via_name || ' introduced you to ' || v_target_name, '/profile/' || v_row.target_id::text, p_id, false);
  RETURN jsonb_build_object('success', true, 'status', 'accepted');
END;
$$;
REVOKE ALL ON FUNCTION public.respond_introduction(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_introduction(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_introductions()
RETURNS TABLE (
  id uuid, direction text, status text, note text, created_at timestamptz,
  requester_id uuid, requester_name text, requester_avatar text, requester_craft text,
  target_id uuid, target_name text, target_avatar text, target_craft text, via_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.id, CASE WHEN i.via_id = auth.uid() THEN 'incoming' ELSE 'outgoing' END, i.status, i.note, i.created_at,
         i.requester_id, rq.full_name, rq.avatar_url, rq.craft,
         i.target_id, tg.full_name, tg.avatar_url, tg.craft, vi.full_name
    FROM public.connection_introductions i
    JOIN public.profiles rq ON rq.id = i.requester_id
    JOIN public.profiles tg ON tg.id = i.target_id
    JOIN public.profiles vi ON vi.id = i.via_id
   WHERE (i.via_id = auth.uid() AND i.status = 'pending')
      OR (i.requester_id = auth.uid() AND i.created_at > now() - interval '30 days')
   ORDER BY i.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.list_introductions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_introductions() TO authenticated;

-- ── 4. collaborators ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suggest_collaborators(p_limit integer DEFAULT 12)
RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, craft text, location text, is_verified boolean,
  shared_count integer, shared_title text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH my_sp AS (
    SELECT psm.project_space_id AS sid FROM public.project_space_members psm WHERE psm.user_id = auth.uid()
    UNION SELECT ps.id FROM public.project_spaces ps WHERE ps.creator_id = auth.uid()
  ), co AS (
    SELECT psm.user_id AS uid, psm.project_space_id AS sid FROM public.project_space_members psm JOIN my_sp ON my_sp.sid = psm.project_space_id WHERE psm.user_id <> auth.uid()
    UNION SELECT ps.creator_id, ps.id FROM public.project_spaces ps JOIN my_sp ON my_sp.sid = ps.id WHERE ps.creator_id IS NOT NULL AND ps.creator_id <> auth.uid()
  ), agg AS (
    SELECT co.uid, COUNT(DISTINCT co.sid)::integer AS n, (array_agg(ps.name ORDER BY ps.created_at DESC))[1] AS title
      FROM co JOIN public.project_spaces ps ON ps.id = co.sid GROUP BY co.uid
  )
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.craft, p.location, COALESCE(p.is_verified, false), a.n, a.title
    FROM agg a JOIN public.profiles p ON p.id = a.uid
   WHERE COALESCE(p.is_internal, false) = false AND COALESCE(p.is_banned, false) = false AND COALESCE(p.is_shadowbanned, false) = false
     AND NOT EXISTS (SELECT 1 FROM public.user_connections uc
                      WHERE (uc.follower_id = auth.uid() AND uc.following_id = p.id) OR (uc.follower_id = p.id AND uc.following_id = auth.uid()))
     AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                      WHERE (b.user_id = auth.uid() AND b.blocked_user_id = p.id) OR (b.user_id = p.id AND b.blocked_user_id = auth.uid()))
     AND NOT EXISTS (SELECT 1 FROM public.network_dismissed d WHERE d.user_id = auth.uid() AND d.dismissed_id = p.id)
   ORDER BY a.n DESC, p.full_name
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
$$;
REVOKE ALL ON FUNCTION public.suggest_collaborators(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_collaborators(integer) TO authenticated;

-- ── 5. insights ──────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.network_insights()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  WITH mine AS (
    SELECT uc.*, CASE WHEN uc.follower_id = v_me THEN uc.following_id ELSE uc.follower_id END AS other
      FROM public.user_connections uc WHERE uc.follower_id = v_me OR uc.following_id = v_me
  ), conns AS (
    SELECT m.other, COALESCE(m.accepted_at, m.created_at) AS since FROM mine m WHERE m.status = 'accepted'
  )
  SELECT jsonb_build_object(
    'connections', (SELECT count(*) FROM conns),
    'new_30d', (SELECT count(*) FROM conns WHERE since > now() - interval '30 days'),
    'new_prev_30d', (SELECT count(*) FROM conns WHERE since <= now() - interval '30 days' AND since > now() - interval '60 days'),
    'pending_sent', (SELECT count(*) FROM mine WHERE status = 'pending' AND follower_id = v_me),
    'pending_received', (SELECT count(*) FROM mine WHERE status = 'pending' AND following_id = v_me AND ignored_at IS NULL),
    'top_crafts', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', craft, 'count', n)) FROM (
        SELECT p.craft, count(*) AS n FROM conns c JOIN public.profiles p ON p.id = c.other
         WHERE p.craft IS NOT NULL AND btrim(p.craft) <> '' GROUP BY p.craft ORDER BY n DESC, p.craft LIMIT 5) t), '[]'::jsonb),
    'top_locations', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', location, 'count', n)) FROM (
        SELECT p.location, count(*) AS n FROM conns c JOIN public.profiles p ON p.id = c.other
         WHERE p.location IS NOT NULL AND btrim(p.location) <> '' GROUP BY p.location ORDER BY n DESC, p.location LIMIT 5) t), '[]'::jsonb),
    'views_7d', (SELECT count(*) FROM public.profile_views pv WHERE pv.profile_id = v_me AND pv.viewer_id IS DISTINCT FROM v_me AND pv.created_at > now() - interval '7 days'),
    'views_30d', (SELECT count(*) FROM public.profile_views pv WHERE pv.profile_id = v_me AND pv.viewer_id IS DISTINCT FROM v_me AND pv.created_at > now() - interval '30 days'),
    'views_prev_30d', (SELECT count(*) FROM public.profile_views pv WHERE pv.profile_id = v_me AND pv.viewer_id IS DISTINCT FROM v_me AND pv.created_at <= now() - interval '30 days' AND pv.created_at > now() - interval '60 days')
  ) INTO v_out;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.network_insights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_insights() TO authenticated;

-- ── 6. network_overview: now with my note / tags and availability ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.network_overview();
CREATE OR REPLACE FUNCTION public.network_overview()
RETURNS TABLE (
  id uuid, follower_id uuid, following_id uuid, status text, created_at timestamptz, note text, ignored_at timestamptz,
  other_id uuid, full_name text, username text, avatar_url text, cover_image_url text, bio text, location text,
  craft text, account_type text, is_verified boolean, mutual_count integer,
  my_note text, my_tags text[], availability text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  RETURN QUERY
  WITH mine AS (
    SELECT uc.id, uc.follower_id, uc.following_id, uc.status, uc.created_at, uc.note, uc.ignored_at,
           CASE WHEN uc.follower_id = v_me THEN uc.following_id ELSE uc.follower_id END AS other
      FROM public.user_connections uc
     WHERE uc.follower_id = v_me OR uc.following_id = v_me
  ), my_conn AS (
    SELECT m.other FROM mine m WHERE m.status = 'accepted'
  ), mut AS (
    SELECT x.cid, COUNT(DISTINCT x.via)::integer AS n FROM (
      SELECT uc.following_id AS cid, uc.follower_id AS via FROM public.user_connections uc JOIN my_conn ON my_conn.other = uc.follower_id WHERE uc.status = 'accepted'
      UNION ALL
      SELECT uc.follower_id, uc.following_id FROM public.user_connections uc JOIN my_conn ON my_conn.other = uc.following_id WHERE uc.status = 'accepted'
    ) x WHERE x.cid <> v_me GROUP BY x.cid
  )
  SELECT m.id, m.follower_id, m.following_id, m.status, m.created_at, m.note, m.ignored_at,
         p.id, p.full_name, p.username, p.avatar_url, p.cover_image_url, p.bio, p.location, p.craft, p.account_type,
         COALESCE(p.is_verified, false), COALESCE(mu.n, 0),
         cn.note, COALESCE(cn.tags, '{}'),
         CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility) THEN av.status ELSE NULL END
    FROM mine m
    JOIN public.profiles p ON p.id = m.other
    LEFT JOIN mut mu ON mu.cid = m.other
    LEFT JOIN public.connection_notes cn ON cn.owner_id = v_me AND cn.other_id = m.other
    LEFT JOIN public.profile_availability av ON av.user_id = m.other
   WHERE COALESCE(p.is_banned, false) = false
   ORDER BY m.created_at DESC
   LIMIT 1000;
END;
$$;
REVOKE ALL ON FUNCTION public.network_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_overview() TO authenticated;

-- ── 7. suggest_people: availability filter + shared projects / company pages ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.suggest_people(text, text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.suggest_people(
  p_search text DEFAULT NULL,
  p_craft text DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_available_only boolean DEFAULT false
) RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, cover_image_url text, bio text, location text,
  craft text, account_type text, is_verified boolean,
  connection_status text, connection_id uuid, mutual_count integer, suggestion_reason text, availability text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_craft text;
  v_loc text;
  v_viewer_type text;
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_term text;
  v_craft_term text := NULLIF(btrim(COALESCE(p_craft, '')), '');
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT pr.craft, pr.location, COALESCE(pr.account_type, 'talent') INTO v_craft, v_loc, v_viewer_type FROM public.profiles pr WHERE pr.id = v_me;
  IF v_search IS NOT NULL THEN
    v_term := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  IF v_craft_term IS NOT NULL AND lower(v_craft_term) <> 'all' THEN
    v_craft_term := '%' || replace(replace(replace(v_craft_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  ELSE
    v_craft_term := NULL;
  END IF;

  RETURN QUERY
  WITH my AS (
    SELECT CASE WHEN uc.follower_id = v_me THEN uc.following_id ELSE uc.follower_id END AS other
      FROM public.user_connections uc
     WHERE uc.status = 'accepted' AND (uc.follower_id = v_me OR uc.following_id = v_me)
  ), mut AS (
    SELECT x.cid, COUNT(DISTINCT x.via)::integer AS n FROM (
      SELECT uc.following_id AS cid, uc.follower_id AS via FROM public.user_connections uc JOIN my ON my.other = uc.follower_id WHERE uc.status = 'accepted'
      UNION ALL
      SELECT uc.follower_id, uc.following_id FROM public.user_connections uc JOIN my ON my.other = uc.following_id WHERE uc.status = 'accepted'
    ) x WHERE x.cid <> v_me GROUP BY x.cid
  ), my_sp AS (
    SELECT psm.project_space_id AS sid FROM public.project_space_members psm WHERE psm.user_id = v_me
    UNION SELECT ps.id FROM public.project_spaces ps WHERE ps.creator_id = v_me
  ), shared_space AS (
    SELECT psm.user_id AS uid FROM public.project_space_members psm JOIN my_sp ON my_sp.sid = psm.project_space_id WHERE psm.user_id <> v_me
    UNION SELECT ps.creator_id FROM public.project_spaces ps JOIN my_sp ON my_sp.sid = ps.id WHERE ps.creator_id IS NOT NULL AND ps.creator_id <> v_me
  ), shared_page AS (
    SELECT DISTINCT o.user_id AS uid FROM public.company_page_members m JOIN public.company_page_members o ON o.page_id = m.page_id WHERE m.user_id = v_me AND o.user_id <> v_me
  ), cand AS (
    SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.cover_image_url, pr.bio, pr.location, pr.craft, pr.account_type,
           COALESCE(pr.is_verified, false) AS is_verified,
           CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility) THEN av.status ELSE NULL END AS availability
      FROM public.profiles pr
      LEFT JOIN public.profile_availability av ON av.user_id = pr.id
     WHERE pr.id <> v_me
       AND COALESCE(pr.is_internal, false) = false
       AND COALESCE(pr.is_banned, false) = false
       AND COALESCE(pr.is_shadowbanned, false) = false
       AND (CASE WHEN v_viewer_type <> 'fan' THEN pr.account_type IS DISTINCT FROM 'fan'
                 ELSE (p_account_type IS NULL OR pr.account_type = p_account_type) END)
       AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                        WHERE (b.user_id = v_me AND b.blocked_user_id = pr.id) OR (b.user_id = pr.id AND b.blocked_user_id = v_me))
       AND NOT EXISTS (SELECT 1 FROM public.network_dismissed d WHERE d.user_id = v_me AND d.dismissed_id = pr.id)
       AND (v_term IS NULL OR pr.full_name ILIKE v_term OR pr.username ILIKE v_term OR pr.craft ILIKE v_term
            OR EXISTS (SELECT 1 FROM public.user_skills s WHERE s.user_id = pr.id AND s.skill_name ILIKE v_term))
       AND (v_craft_term IS NULL OR pr.craft ILIKE v_craft_term)
       AND (NOT COALESCE(p_available_only, false)
            OR (av.user_id IS NOT NULL AND av.status = 'open' AND public.can_see_availability(av.user_id, av.visibility)))
  ), ranked AS (
    SELECT c.*, rel.cid AS connection_id,
           CASE WHEN rel.status = 'accepted' THEN 'connected'
                WHEN rel.status = 'pending' AND rel.follower_id = v_me THEN 'pending_sent'
                WHEN rel.status = 'pending' THEN 'pending_received'
                ELSE 'none' END AS connection_status,
           COALESCE(m.n, 0) AS mutual_count,
           EXISTS (SELECT 1 FROM shared_space s WHERE s.uid = c.id) AS same_project,
           EXISTS (SELECT 1 FROM shared_page s WHERE s.uid = c.id) AS same_page,
           (v_craft IS NOT NULL AND c.craft IS NOT NULL AND lower(c.craft) = lower(v_craft)) AS same_craft,
           (v_loc IS NOT NULL AND c.location IS NOT NULL AND lower(c.location) = lower(v_loc)) AS same_loc
      FROM cand c
      LEFT JOIN mut m ON m.cid = c.id
      LEFT JOIN LATERAL (
        SELECT uc.id AS cid, uc.status, uc.follower_id FROM public.user_connections uc
         WHERE (uc.follower_id = v_me AND uc.following_id = c.id) OR (uc.follower_id = c.id AND uc.following_id = v_me)
         LIMIT 1) rel ON true
  )
  SELECT r.id, r.username, r.full_name, r.avatar_url, r.cover_image_url, r.bio, r.location, r.craft, r.account_type, r.is_verified,
         r.connection_status, r.connection_id, r.mutual_count,
         CASE WHEN r.connection_status = 'connected' THEN 'Connected'
              WHEN r.connection_status IN ('pending_sent', 'pending_received') THEN 'Pending connection'
              WHEN r.mutual_count > 0 THEN r.mutual_count::text || (CASE WHEN r.mutual_count = 1 THEN ' mutual connection' ELSE ' mutual connections' END)
              WHEN r.same_project THEN 'Shared a project with you'
              WHEN r.same_page THEN 'On the same company page'
              WHEN r.same_craft THEN 'Same craft as you'
              WHEN r.same_loc THEN 'Near you'
              ELSE 'Suggested for you' END,
         r.availability
    FROM ranked r
   ORDER BY CASE r.connection_status WHEN 'none' THEN 0 WHEN 'pending_received' THEN 1 WHEN 'pending_sent' THEN 2 ELSE 3 END,
            (r.mutual_count * 3 + (CASE WHEN r.same_project THEN 6 ELSE 0 END) + (CASE WHEN r.same_page THEN 3 ELSE 0 END)
             + (CASE WHEN r.same_craft THEN 4 ELSE 0 END) + (CASE WHEN r.same_loc THEN 2 ELSE 0 END)
             + (CASE WHEN r.is_verified THEN 1 ELSE 0 END) + (CASE WHEN r.availability = 'open' THEN 1 ELSE 0 END)) DESC,
            md5(r.id::text || current_date::text)
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean) TO authenticated;

COMMIT;
