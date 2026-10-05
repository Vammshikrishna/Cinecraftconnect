-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AD – Network: security and bug fixes
--   * a connection request can only be created as "pending" (nobody can create an accepted connection by themselves)
--   * only the person who RECEIVED a request can accept it; nothing else about a connection can be edited
--   * no connecting to yourself, no duplicate / reverse pairs (A->B and B->A become one connection), blocked people
--     cannot send requests, blocking removes the connection, request limits
--   * the connection graph is private: you only see rows you are part of; counts and a person's connection list go
--     through functions that respect profile visibility
--   * one notification per request (the duplicate trigger is dropped), the sender is told when a request is accepted
--   * "People you may know" is computed on the server: real mutual connections, ranking, paging, remembered dismissals
-- Run after part AC. Then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. clean up existing rows, then add the rules ────────────────────────────────────────────────────────────────
DELETE FROM public.user_connections WHERE follower_id = following_id;

-- A->B and B->A: keep the accepted one, otherwise the older one
DELETE FROM public.user_connections a
 USING public.user_connections b
 WHERE a.follower_id = b.following_id AND a.following_id = b.follower_id AND a.id <> b.id
   AND ((a.status = 'pending' AND b.status = 'accepted')
     OR (a.status = b.status AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))));

ALTER TABLE public.user_connections DROP CONSTRAINT IF EXISTS user_connections_not_self;
ALTER TABLE public.user_connections ADD CONSTRAINT user_connections_not_self CHECK (follower_id <> following_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_connections_pair_unique
  ON public.user_connections (LEAST(follower_id, following_id), GREATEST(follower_id, following_id));
CREATE INDEX IF NOT EXISTS idx_user_connections_created ON public.user_connections (follower_id, created_at DESC);

-- ── 2. policies: replace every old one ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_connections' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_connections', r.policyname);
  END LOOP;
END $$;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- you only see connections you are part of (other people's totals / lists: functions below)
CREATE POLICY user_connections_select ON public.user_connections FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid() OR public.is_market_admin());
-- a request is created by its sender, and only as pending
CREATE POLICY user_connections_insert ON public.user_connections FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND status = 'pending');
-- only the receiver can accept
CREATE POLICY user_connections_update ON public.user_connections FOR UPDATE TO authenticated
  USING (following_id = auth.uid() AND status = 'pending')
  WITH CHECK (following_id = auth.uid() AND status = 'accepted');
-- either person can cancel / decline / remove
CREATE POLICY user_connections_delete ON public.user_connections FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

REVOKE ALL ON public.user_connections FROM anon;

-- ── 3. guard ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_user_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reverse public.user_connections%ROWTYPE;
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
      UPDATE public.user_connections SET status = 'accepted' WHERE id = v_reverse.id;
      PERFORM set_config('app.market_system', '', true);
      RETURN NULL;
    END IF;

    IF (SELECT count(*) FROM public.user_connections WHERE follower_id = NEW.follower_id AND status = 'pending') >= 100 THEN
      RAISE EXCEPTION 'You have 100 requests waiting. Withdraw some before sending more.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.user_connections WHERE follower_id = NEW.follower_id AND created_at > now() - interval '1 day') >= 40 THEN
      RAISE EXCEPTION 'You have sent a lot of requests today. Please try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the only allowed change is pending -> accepted, by the receiver
  IF OLD.status = 'pending' AND NEW.status = 'accepted' AND auth.uid() = OLD.following_id THEN
    NEW.follower_id := OLD.follower_id;
    NEW.following_id := OLD.following_id;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A connection cannot be edited' USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_user_connection ON public.user_connections;
CREATE TRIGGER trg_guard_user_connection BEFORE INSERT OR UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_connection();

-- ── 4. notifications: one per request, and the sender hears about acceptance ─────────────────────────────────────
-- (notify_on_connection_event already sends "wants to connect"; the second trigger sent a duplicate)
DROP TRIGGER IF EXISTS on_follower_notification ON public.user_connections;

CREATE OR REPLACE FUNCTION public.notify_connection_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = NEW.following_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (NEW.follower_id, NEW.following_id, 'connection_accepted', 'Connection accepted',
            v_name || ' accepted your connection request', '/profile/' || NEW.following_id::text, NEW.id, false);
    -- the request notification is no longer actionable
    UPDATE public.notifications SET is_read = true
     WHERE user_id = NEW.following_id AND type = 'new_follower' AND trigger_user_id = NEW.follower_id AND is_read = false;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_connection_accepted ON public.user_connections;
CREATE TRIGGER trg_notify_connection_accepted AFTER UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_connection_accepted();

-- ── 5. blocking removes the connection ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_connection_on_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.user_connections
   WHERE (follower_id = NEW.user_id AND following_id = NEW.blocked_user_id)
      OR (follower_id = NEW.blocked_user_id AND following_id = NEW.user_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_remove_connection_on_block ON public.blocked_users;
CREATE TRIGGER trg_remove_connection_on_block AFTER INSERT ON public.blocked_users
  FOR EACH ROW EXECUTE FUNCTION public.remove_connection_on_block();

-- ── 6. private graph: totals and a person's connection list ──────────────────────────────────────────────────────
-- Totals are public (like a follower count). "initiated" = connections this person started (used in "following").
CREATE OR REPLACE FUNCTION public.get_connection_counts(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'connections', COUNT(*),
    'initiated', COUNT(*) FILTER (WHERE follower_id = p_user))
  FROM public.user_connections
  WHERE status = 'accepted' AND (follower_id = p_user OR following_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.get_connection_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_connection_counts(uuid) TO anon, authenticated;

-- The list is visible to the person themself and to anyone allowed to see their profile details
CREATE OR REPLACE FUNCTION public.list_user_connections(
  p_user uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL
) RETURNS TABLE (id uuid, full_name text, username text, avatar_url text, craft text, is_verified boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_term text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user AND NOT public.can_view_profile_extras(p_user) THEN
    RETURN;
  END IF;
  IF v_term IS NOT NULL THEN
    v_term := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.username, p.avatar_url, p.craft, COALESCE(p.is_verified, false)
    FROM public.user_connections uc
    JOIN public.profiles p ON p.id = CASE WHEN uc.follower_id = p_user THEN uc.following_id ELSE uc.follower_id END
   WHERE uc.status = 'accepted' AND (uc.follower_id = p_user OR uc.following_id = p_user)
     AND COALESCE(p.is_banned, false) = false
     AND (v_term IS NULL OR p.full_name ILIKE v_term OR p.username ILIKE v_term OR p.craft ILIKE v_term)
   ORDER BY uc.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_user_connections(uuid, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_connections(uuid, integer, integer, text) TO anon, authenticated;

-- ── 7. people you may know: server-side, real mutual connections, ranking, paging, dismissals ────────────────────
CREATE TABLE IF NOT EXISTS public.network_dismissed (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dismissed_id),
  CHECK (user_id <> dismissed_id)
);
ALTER TABLE public.network_dismissed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS network_dismissed_own ON public.network_dismissed;
CREATE POLICY network_dismissed_own ON public.network_dismissed FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.network_dismissed FROM anon, PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.network_dismissed TO authenticated;

CREATE OR REPLACE FUNCTION public.suggest_people(
  p_search text DEFAULT NULL,
  p_craft text DEFAULT NULL,
  p_account_type text DEFAULT NULL,      -- fans only: 'creator' or 'fan'
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, cover_image_url text, bio text, location text,
  craft text, account_type text, is_verified boolean,
  connection_status text, connection_id uuid, mutual_count integer, suggestion_reason text
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
    -- people who are connected to somebody in my network
    SELECT x.cid, COUNT(DISTINCT x.via)::integer AS n FROM (
      SELECT uc.following_id AS cid, uc.follower_id AS via FROM public.user_connections uc JOIN my ON my.other = uc.follower_id WHERE uc.status = 'accepted'
      UNION ALL
      SELECT uc.follower_id, uc.following_id FROM public.user_connections uc JOIN my ON my.other = uc.following_id WHERE uc.status = 'accepted'
    ) x WHERE x.cid <> v_me GROUP BY x.cid
  ), cand AS (
    SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.cover_image_url, pr.bio, pr.location, pr.craft, pr.account_type,
           COALESCE(pr.is_verified, false) AS is_verified
      FROM public.profiles pr
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
  ), ranked AS (
    SELECT c.*, rel.cid AS connection_id,
           CASE WHEN rel.status = 'accepted' THEN 'connected'
                WHEN rel.status = 'pending' AND rel.follower_id = v_me THEN 'pending_sent'
                WHEN rel.status = 'pending' THEN 'pending_received'
                ELSE 'none' END AS connection_status,
           COALESCE(m.n, 0) AS mutual_count,
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
              WHEN r.same_craft THEN 'Same craft as you'
              WHEN r.same_loc THEN 'Near you'
              ELSE 'Suggested for you' END
    FROM ranked r
   ORDER BY CASE r.connection_status WHEN 'none' THEN 0 WHEN 'pending_received' THEN 1 WHEN 'pending_sent' THEN 2 ELSE 3 END,
            (r.mutual_count * 3 + (CASE WHEN r.same_craft THEN 4 ELSE 0 END) + (CASE WHEN r.same_loc THEN 2 ELSE 0 END)
             + (CASE WHEN r.is_verified THEN 1 ELSE 0 END)) DESC,
            md5(r.id::text || current_date::text)
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_people(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_people(text, text, text, integer, integer) TO authenticated;

COMMIT;
