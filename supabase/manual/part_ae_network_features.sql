-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AE – Network: missing features
--   * "who can send me connection requests" (everyone / only people with a mutual connection / nobody)
--   * a short note with a connection request
--   * ignore a request quietly (the sender is not told), and bring it back later
--   * one function returns my connections / requests / sent / ignored with mutual-connection counts
-- Run after part AD, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. columns ───────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_connections ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.user_connections ADD COLUMN IF NOT EXISTS ignored_at timestamptz;
ALTER TABLE public.user_connections DROP CONSTRAINT IF EXISTS user_connections_note_len;
ALTER TABLE public.user_connections ADD CONSTRAINT user_connections_note_len CHECK (note IS NULL OR char_length(note) <= 200);

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS allow_connection_requests text DEFAULT 'everyone';
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_allow_connection_requests_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_allow_connection_requests_check
  CHECK (allow_connection_requests IS NULL OR allow_connection_requests IN ('everyone', 'mutuals', 'nobody'));

-- ── 2. guard (replaces the part AD version): adds the request setting and the note ───────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_user_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reverse public.user_connections%ROWTYPE;
  v_pref text;
BEGIN
  IF public.market_is_system() OR public.is_market_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.follower_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only send requests as yourself' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.follower_id = NEW.following_id THEN
      RAISE EXCEPTION 'You cannot connect with yourself' USING ERRCODE = 'P0001';
    END IF;
    NEW.status := 'pending';
    NEW.created_at := now();
    NEW.ignored_at := NULL;
    NEW.note := left(NULLIF(btrim(COALESCE(NEW.note, '')), ''), 200);

    IF EXISTS (SELECT 1 FROM public.blocked_users
                WHERE (user_id = NEW.follower_id AND blocked_user_id = NEW.following_id)
                   OR (user_id = NEW.following_id AND blocked_user_id = NEW.follower_id)) THEN
      RAISE EXCEPTION 'You cannot connect with this person' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_reverse FROM public.user_connections WHERE follower_id = NEW.following_id AND following_id = NEW.follower_id;
    IF FOUND THEN
      IF v_reverse.status = 'accepted' THEN
        RAISE EXCEPTION 'You are already connected' USING ERRCODE = 'P0001';
      END IF;
      -- they already asked you: sending a request back simply accepts theirs
      PERFORM set_config('app.market_system', '1', true);
      UPDATE public.user_connections SET status = 'accepted', ignored_at = NULL WHERE id = v_reverse.id;
      PERFORM set_config('app.market_system', '', true);
      RETURN NULL;
    END IF;

    -- who may send this person a request
    SELECT allow_connection_requests INTO v_pref FROM public.user_settings WHERE user_id = NEW.following_id;
    IF v_pref = 'nobody' THEN
      RAISE EXCEPTION 'This person is not accepting connection requests' USING ERRCODE = 'P0001';
    ELSIF v_pref = 'mutuals' AND NOT EXISTS (
      SELECT 1
        FROM public.user_connections a
        JOIN public.user_connections b
          ON b.status = 'accepted'
         AND (CASE WHEN a.follower_id = NEW.follower_id THEN a.following_id ELSE a.follower_id END)
           = (CASE WHEN b.follower_id = NEW.following_id THEN b.following_id ELSE b.follower_id END)
       WHERE a.status = 'accepted' AND (a.follower_id = NEW.follower_id OR a.following_id = NEW.follower_id)
         AND (b.follower_id = NEW.following_id OR b.following_id = NEW.following_id)
    ) THEN
      RAISE EXCEPTION 'This person only accepts requests from people they have a mutual connection with' USING ERRCODE = 'P0001';
    END IF;

    IF (SELECT count(*) FROM public.user_connections WHERE follower_id = NEW.follower_id AND status = 'pending') >= 100 THEN
      RAISE EXCEPTION 'You have 100 requests waiting. Withdraw some before sending more.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.user_connections WHERE follower_id = NEW.follower_id AND created_at > now() - interval '1 day') >= 40 THEN
      RAISE EXCEPTION 'You have sent a lot of requests today. Please try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the only allowed change is pending -> accepted, by the receiver (ignoring goes through ignore_connection_request)
  IF OLD.status = 'pending' AND NEW.status = 'accepted' AND auth.uid() = OLD.following_id THEN
    NEW.follower_id := OLD.follower_id;
    NEW.following_id := OLD.following_id;
    NEW.created_at := OLD.created_at;
    NEW.note := OLD.note;
    NEW.ignored_at := NULL;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A connection cannot be edited' USING ERRCODE = 'P0001';
END;
$$;

-- ── 3. ignore / bring back a request (the sender sees nothing change) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ignore_connection_request(p_id uuid, p_ignore boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.user_connections
     SET ignored_at = CASE WHEN COALESCE(p_ignore, true) THEN now() ELSE NULL END
   WHERE id = p_id AND following_id = auth.uid() AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.ignore_connection_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ignore_connection_request(uuid, boolean) TO authenticated;

-- ── 4. my network in one call: connections, requests received / sent / ignored, with mutual counts ───────────────
CREATE OR REPLACE FUNCTION public.network_overview()
RETURNS TABLE (
  id uuid, follower_id uuid, following_id uuid, status text, created_at timestamptz, note text, ignored_at timestamptz,
  other_id uuid, full_name text, username text, avatar_url text, cover_image_url text, bio text, location text,
  craft text, account_type text, is_verified boolean, mutual_count integer
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
         COALESCE(p.is_verified, false), COALESCE(mu.n, 0)
    FROM mine m
    JOIN public.profiles p ON p.id = m.other
    LEFT JOIN mut mu ON mu.cid = m.other
   WHERE COALESCE(p.is_banned, false) = false
   ORDER BY m.created_at DESC
   LIMIT 1000;
END;
$$;
REVOKE ALL ON FUNCTION public.network_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_overview() TO authenticated;

COMMIT;
