-- PART BA: Feed personalisation: interests (craft, authors and topics you engage with), "why am I seeing this",
-- muted words, caught-up marker support, and real activity for the widgets. Run after part AZ, then deploy the new
-- web + mobile builds. See docs/FEED.md.
BEGIN;

-- ── 1. muted words (also a hashtag without the #) ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.muted_words (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word       text NOT NULL CHECK (length(btrim(word)) BETWEEN 2 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word)
);
ALTER TABLE public.muted_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS muted_words_own ON public.muted_words;
CREATE POLICY muted_words_own ON public.muted_words FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- words are stored lower case and trimmed, at most 50 per person
CREATE OR REPLACE FUNCTION public.muted_words_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.word := lower(btrim(NEW.word));
  IF length(NEW.word) < 2 THEN RAISE EXCEPTION 'Use at least 2 characters' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM public.muted_words WHERE user_id = NEW.user_id) >= 50 THEN
    RAISE EXCEPTION 'You can mute up to 50 words' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS muted_words_guard ON public.muted_words;
CREATE TRIGGER muted_words_guard BEFORE INSERT ON public.muted_words
  FOR EACH ROW EXECUTE FUNCTION public.muted_words_guard();

-- ── 2. activity for the widgets: ids only, ranked by what happened lately (row-level security still applies) ───
CREATE OR REPLACE FUNCTION public.get_trending_ids(p_kind text, p_limit integer DEFAULT 10)
RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 30);
  v_ids uuid[];
BEGIN
  IF p_kind = 'rooms' THEN
    -- messages in the last 7 days, and people who joined in the last 7 days
    SELECT array_agg(x.id ORDER BY x.score DESC, x.created_at DESC) INTO v_ids FROM (
      SELECT r.id, r.created_at,
             COALESCE(m.n, 0) + 3 * COALESCE(j.n, 0) AS score
        FROM discussion_rooms r
        LEFT JOIN (SELECT room_id, count(*) AS n FROM room_messages
                    WHERE created_at > now() - interval '7 days' AND COALESCE(is_deleted, false) = false GROUP BY room_id) m ON m.room_id = r.id
        LEFT JOIN (SELECT room_id, count(*) AS n FROM room_members
                    WHERE joined_at > now() - interval '7 days' GROUP BY room_id) j ON j.room_id = r.id
       ORDER BY 3 DESC, r.created_at DESC LIMIT v_limit) x;
  ELSIF p_kind = 'projects' THEN
    -- applications in the last 14 days, and chat in the project's space in the last 7 days
    SELECT array_agg(x.id ORDER BY x.score DESC, x.created_at DESC) INTO v_ids FROM (
      SELECT pr.id, pr.created_at,
             3 * COALESCE(a.n, 0) + COALESCE(s.n, 0) AS score
        FROM projects pr
        LEFT JOIN (SELECT project_id, count(*) AS n FROM project_applications
                    WHERE created_at > now() - interval '14 days' GROUP BY project_id) a ON a.project_id = pr.id
        LEFT JOIN (SELECT ps.project_id, count(*) AS n FROM project_spaces ps
                     JOIN project_space_messages pm ON pm.project_space_id = ps.id
                    WHERE pm.created_at > now() - interval '7 days' AND COALESCE(pm.is_deleted, false) = false
                      AND ps.project_id IS NOT NULL GROUP BY ps.project_id) s ON s.project_id = pr.id
       ORDER BY 3 DESC, pr.created_at DESC LIMIT v_limit) x;
  ELSIF p_kind = 'vendors' THEN
    -- reviews in the last 90 days, better ratings first, verified vendors a little ahead
    SELECT array_agg(x.id ORDER BY x.score DESC, x.created_at DESC) INTO v_ids FROM (
      SELECT v.id, v.created_at,
             COALESCE(r.n, 0) * 2 + COALESCE(r.avg_rating, 0) + (CASE WHEN COALESCE(v.is_verified, false) THEN 1 ELSE 0 END) AS score
        FROM vendors v
        LEFT JOIN (SELECT vendor_id, count(*) AS n, avg(rating) AS avg_rating FROM marketplace_reviews
                    WHERE vendor_id IS NOT NULL AND created_at > now() - interval '90 days' GROUP BY vendor_id) r ON r.vendor_id = v.id
       ORDER BY 3 DESC, v.created_at DESC LIMIT v_limit) x;
  ELSIF p_kind = 'marketplace' THEN
    -- saved to a wishlist in the last 14 days, booked in the last 30 days
    SELECT array_agg(x.id ORDER BY x.score DESC, x.created_at DESC) INTO v_ids FROM (
      SELECT l.id, l.created_at,
             COALESCE(w.n, 0) + 3 * COALESCE(b.n, 0) AS score
        FROM marketplace_listings l
        LEFT JOIN (SELECT listing_id, count(*) AS n FROM marketplace_wishlists
                    WHERE created_at > now() - interval '14 days' GROUP BY listing_id) w ON w.listing_id = l.id
        LEFT JOIN (SELECT listing_id, count(*) AS n FROM marketplace_bookings
                    WHERE created_at > now() - interval '30 days' GROUP BY listing_id) b ON b.listing_id = l.id
       ORDER BY 3 DESC, l.created_at DESC LIMIT v_limit) x;
  ELSE
    RAISE EXCEPTION 'Unknown kind' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(v_ids, '{}'::uuid[]);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_trending_ids(text, integer) TO authenticated;

-- ── 3. the feed once more: interests, a reason for every post, muted words, was_seen ────────────────────────────
DROP FUNCTION IF EXISTS public.get_algorithmic_feed(uuid, integer, timestamp with time zone, integer, timestamp with time zone, text, text);

CREATE OR REPLACE FUNCTION public.get_algorithmic_feed(
  current_user_id UUID,
  limit_val INT,
  created_at_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_offset INT DEFAULT 0,
  p_as_of TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_tab TEXT DEFAULT 'for_you',
  p_craft TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, author_id UUID, content TEXT, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE,
  media_url TEXT, media_type TEXT, media_items JSONB, page_id UUID, like_count INT, comment_count INT, share_count INT,
  tags TEXT[], has_ai_generated BOOLEAN, is_pinned BOOLEAN, score NUMERIC, profiles JSON, company_pages JSON,
  category TEXT, audience TEXT, edited_at TIMESTAMP WITH TIME ZONE, has_poll BOOLEAN, scheduled_at TIMESTAMP WITH TIME ZONE,
  has_collabs BOOLEAN, link_preview JSONB, as_of TIMESTAMP WITH TIME ZONE,
  reason TEXT, was_seen BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_as_of timestamptz := LEAST(COALESCE(p_as_of, now()), now());
  v_limit int := LEAST(GREATEST(COALESCE(limit_val, 10), 1), 50);
  v_off int := LEAST(GREATEST(COALESCE(p_offset, 0), 0), 2000);
  v_craft text := NULLIF(btrim(COALESCE(p_craft, '')), '');
  v_following boolean := COALESCE(p_tab, 'for_you') = 'following';
  v_my_craft text;
BEGIN
  IF v_craft IS NOT NULL THEN
    v_craft := '%' || replace(replace(replace(v_craft, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  IF v_following AND v_me IS NULL THEN
    RETURN;
  END IF;
  SELECT lower(NULLIF(btrim(pr.craft), '')) INTO v_my_craft FROM profiles pr WHERE pr.id = v_me;

  RETURN QUERY
  WITH fol AS (
    SELECT f.following_id AS aid FROM user_follows f WHERE f.follower_id = v_me
  ), con AS (
    SELECT DISTINCT CASE WHEN c.follower_id = v_me THEN c.following_id ELSE c.follower_id END AS aid
      FROM user_connections c
     WHERE c.status = 'accepted' AND (c.follower_id = v_me OR c.following_id = v_me)
  ), pg AS (
    SELECT cf.page_id AS pid FROM company_page_followers cf WHERE cf.user_id = v_me
  ), fav_authors AS (
    -- authors whose posts I liked in the last 30 days
    SELECT p2.author_id AS aid, count(*)::int AS n
      FROM post_likes l JOIN posts p2 ON p2.id = l.post_id
     WHERE v_me IS NOT NULL AND l.user_id = v_me AND l.created_at > v_as_of - interval '30 days'
     GROUP BY p2.author_id
  ), fav_tags AS (
    -- topics of the posts I liked in the last 30 days
    SELECT lower(t) AS tag, count(*)::int AS n
      FROM post_likes l JOIN posts p3 ON p3.id = l.post_id, LATERAL unnest(COALESCE(p3.tags, '{}'::text[])) AS t
     WHERE v_me IS NOT NULL AND l.user_id = v_me AND l.created_at > v_as_of - interval '30 days'
     GROUP BY lower(t)
     ORDER BY 2 DESC LIMIT 30
  ), cand AS (
    SELECT p.*,
           ap.full_name AS a_name,
           (v_me IS NOT NULL AND p.author_id = v_me) AS is_mine,
           (fol.aid IS NOT NULL) AS is_follow,
           (con.aid IS NOT NULL) AS is_conn,
           (pg.pid IS NOT NULL) AS is_page,
           (v_my_craft IS NOT NULL AND lower(NULLIF(btrim(ap.craft), '')) = v_my_craft) AS same_craft,
           COALESCE(fa.n, 0) AS fav_n,
           (SELECT count(*)::int FROM unnest(COALESCE(p.tags, '{}'::text[])) tg WHERE lower(tg) IN (SELECT ft.tag FROM fav_tags ft)) AS tag_hits,
           (SELECT ft2.tag FROM fav_tags ft2 WHERE ft2.tag IN (SELECT lower(tg2) FROM unnest(COALESCE(p.tags, '{}'::text[])) tg2) ORDER BY ft2.n DESC LIMIT 1) AS top_tag,
           EXISTS (SELECT 1 FROM post_impressions i WHERE i.post_id = p.id AND i.viewer_id = v_me AND i.first_seen_at < v_as_of) AS seen_before
      FROM posts p
      LEFT JOIN profiles ap ON ap.id = p.author_id
      LEFT JOIN fol ON fol.aid = p.author_id
      LEFT JOIN con ON con.aid = p.author_id
      LEFT JOIN pg ON pg.pid = p.page_id
      LEFT JOIN fav_authors fa ON fa.aid = p.author_id
     WHERE p.created_at <= v_as_of
       AND p.created_at > v_as_of - interval '120 days'
       AND (p_as_of IS NOT NULL OR created_at_cursor IS NULL OR p.created_at < created_at_cursor)
       AND (p.scheduled_at IS NULL OR p.scheduled_at <= now() OR p.author_id = v_me)
       AND (
         p.audience = 'public'
         OR p.author_id = v_me
         OR (p.audience = 'connections' AND v_me IS NOT NULL AND EXISTS (
               SELECT 1 FROM user_connections c2
                WHERE c2.status = 'accepted' AND (
                  (c2.follower_id = v_me AND c2.following_id = p.author_id) OR
                  (c2.following_id = v_me AND c2.follower_id = p.author_id))))
       )
       AND NOT EXISTS (
         SELECT 1 FROM blocked_users b
          WHERE v_me IS NOT NULL
            AND ((b.user_id = v_me AND b.blocked_user_id = p.author_id) OR (b.user_id = p.author_id AND b.blocked_user_id = v_me)))
       AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE v_me IS NOT NULL AND h.user_id = v_me AND h.post_id = p.id)
       AND (p.author_id = v_me OR NOT EXISTS (SELECT 1 FROM muted_authors m WHERE v_me IS NOT NULL AND m.user_id = v_me AND m.author_id = p.author_id))
       -- muted words: in the text, or the same as one of the post's tags
       AND (p.author_id = v_me OR NOT EXISTS (
             SELECT 1 FROM muted_words w
              WHERE v_me IS NOT NULL AND w.user_id = v_me
                AND (strpos(lower(COALESCE(p.content, '')), w.word) > 0
                     OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags, '{}'::text[])) tg3 WHERE lower(ltrim(tg3, '#')) = ltrim(w.word, '#')))))
       AND (NOT v_following OR p.author_id = v_me OR fol.aid IS NOT NULL OR con.aid IS NOT NULL OR pg.pid IS NOT NULL)
       AND (v_craft IS NULL OR ap.craft ILIKE v_craft)
  ), scored AS (
    SELECT c.*,
           (
             (
               10.0
               + CASE WHEN c.is_follow OR c.is_conn OR c.is_page THEN 100.0 WHEN c.is_mine THEN 40.0 ELSE 0.0 END
               + CASE WHEN c.same_craft AND NOT c.is_mine THEN 15.0 ELSE 0.0 END
               + LEAST(c.fav_n, 5) * 6.0
               + LEAST(c.tag_hits, 3) * 5.0
               + COALESCE(c.like_count, 0) * 3.0
               + COALESCE(c.comment_count, 0) * 6.0
             ) / POWER(GREATEST(EXTRACT(EPOCH FROM (v_as_of - c.created_at)) / 3600.0, 0) + 2.0, 1.2)::numeric
           ) * (CASE WHEN c.seen_before THEN 0.25 ELSE 1.0 END) AS base_score
      FROM cand c
  ), varied AS (
    SELECT s.*,
           s.base_score / (1.0 + 0.35 * (row_number() OVER (PARTITION BY s.author_id ORDER BY s.base_score DESC, s.created_at DESC, s.id) - 1)) AS final_score
      FROM scored s
  )
  SELECT
    v.id, v.author_id, v.content, v.created_at, v.updated_at, v.media_url, v.media_type, v.media_items::jsonb, v.page_id,
    (CASE WHEN COALESCE((CASE WHEN jsonb_typeof(v.media_items) = 'array' THEN (v.media_items -> 0 ->> 'hide_likes') END)::boolean, false)
               AND v.author_id IS DISTINCT FROM v_me THEN 0 ELSE COALESCE(v.like_count, 0) END)::int,
    COALESCE(v.comment_count, 0)::int, COALESCE(v.share_count, 0)::int,
    v.tags, v.has_ai_generated, v.is_pinned, v.final_score::numeric,
    (SELECT row_to_json(pr_sub) FROM (
        SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.craft, pr.is_verified, pr.account_type
          FROM profiles pr WHERE pr.id = v.author_id) pr_sub),
    (SELECT row_to_json(cp_sub) FROM (
        SELECT cp.id, cp.name, cp.logo_url, cp.slug, cp.is_verified
          FROM company_pages cp WHERE cp.id = v.page_id) cp_sub),
    v.category, v.audience, v.edited_at, v.has_poll, v.scheduled_at, v.has_collabs, v.link_preview, v_as_of,
    (CASE
       WHEN v.is_mine THEN 'Your post'
       WHEN v.is_follow THEN 'You follow ' || COALESCE(NULLIF(v.a_name, ''), 'this person')
       WHEN v.is_conn THEN COALESCE(NULLIF(v.a_name, ''), 'This person') || ' is in your network'
       WHEN v.is_page THEN 'You follow this page'
       WHEN v.tag_hits > 0 AND v.top_tag IS NOT NULL THEN 'Because you liked posts about #' || ltrim(v.top_tag, '#')
       WHEN v.fav_n > 0 THEN 'You often like posts from ' || COALESCE(NULLIF(v.a_name, ''), 'this person')
       WHEN v.same_craft THEN 'Same craft as you'
       WHEN COALESCE(v.like_count, 0) + COALESCE(v.comment_count, 0) * 2 >= 10 THEN 'Popular right now'
       ELSE 'Suggested for you'
     END)::text,
    v.seen_before
  FROM varied v
  ORDER BY v.final_score DESC, v.created_at DESC, v.id
  LIMIT v_limit OFFSET v_off;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_algorithmic_feed(uuid, integer, timestamptz, integer, timestamptz, text, text) TO authenticated, anon;

COMMIT;
