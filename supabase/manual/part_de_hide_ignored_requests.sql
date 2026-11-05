-- PART DE - a connection request that was "quietly ignored" no longer shows that to the sender (audit step 15, finding 65).
-- The network screens read connections through network_overview(); it used to return ignored_at for BOTH sides. It now returns
-- it only to the person who received the request. (Based on the latest definition in part_ah.)
-- Not closed: someone who reads the table directly with their own session (not through the app) can still see the timestamp
-- on their own sent requests. Hiding one column from one side needs a data move that is not worth the risk for a note like this.
-- Safe to run more than once.

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
           CASE WHEN uc.follower_id = v_me THEN NULL ELSE uc.ignored_at END AS ignored_at,   -- the sender never learns a request was ignored
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
