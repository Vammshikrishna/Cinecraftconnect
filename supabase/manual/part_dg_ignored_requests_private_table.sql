-- PART DG - "quietly ignored" connection requests are kept in a private table (audit step 15, finding 65, full fix).
-- Part DE hid the timestamp inside the network screens. This part removes it from the readable table altogether: the ignore flag now
-- lives in connection_ignores, which nobody can read or write from the app (only the database functions can). The sender can no
-- longer see it even by reading user_connections directly. Nothing else changes for the apps: they already use the functions
-- ignore_connection_request() and network_overview(), and the realtime updates on user_connections keep working because that
-- table is untouched. Run part DE first or not at all; this part includes its version of network_overview(). Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.connection_ignores (
  connection_id uuid PRIMARY KEY REFERENCES public.user_connections(id) ON DELETE CASCADE,
  ignored_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connection_ignores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connection_ignores FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.connection_ignores TO service_role;
-- no policies on purpose: only the functions below (they run with the owner's rights) touch this table

-- move what is already there
INSERT INTO public.connection_ignores (connection_id, ignored_at)
SELECT uc.id, uc.ignored_at FROM public.user_connections uc WHERE uc.ignored_at IS NOT NULL
ON CONFLICT (connection_id) DO NOTHING;

DO $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);   -- lets this one-time clean-up past the "a connection cannot be edited" guard
  UPDATE public.user_connections SET ignored_at = NULL WHERE ignored_at IS NOT NULL;
  PERFORM set_config('app.market_system', '', true);
END $$;

-- ignore / bring back a request (the sender sees nothing change)
CREATE OR REPLACE FUNCTION public.ignore_connection_request(p_id uuid, p_ignore boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_connections uc WHERE uc.id = p_id AND uc.following_id = auth.uid() AND uc.status = 'pending')
    INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_ignore, true) THEN
    INSERT INTO public.connection_ignores (connection_id) VALUES (p_id) ON CONFLICT (connection_id) DO UPDATE SET ignored_at = now();
  ELSE
    DELETE FROM public.connection_ignores WHERE connection_id = p_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.ignore_connection_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ignore_connection_request(uuid, boolean) TO authenticated;

-- the network list: ignored_at comes from the private table, and only for the person who received the request
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
    SELECT uc.id, uc.follower_id, uc.following_id, uc.status, uc.created_at, uc.note,
           (SELECT ci.ignored_at FROM public.connection_ignores ci WHERE ci.connection_id = uc.id AND uc.following_id = v_me) AS ignored_at,   -- kept in a private table; only the person who received the request sees it
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
         CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility) THEN public.effective_availability_status(av.user_id, av.status, av.booked_until) ELSE NULL END
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


-- the pending-requests counter in the network summary
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
    'pending_received', (SELECT count(*) FROM mine WHERE status = 'pending' AND following_id = v_me AND NOT EXISTS (SELECT 1 FROM public.connection_ignores ci WHERE ci.connection_id = mine.id)),
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
