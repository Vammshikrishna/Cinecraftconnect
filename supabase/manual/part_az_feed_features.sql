-- PART AZ: Feed features: "not interested", mute an author, seen-post demotion (impressions), post insights.
-- Run after part AY, then deploy the new web + mobile builds. See docs/FEED.md.
BEGIN;

-- ── 1. posts I hid and authors I muted (private to me) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hidden_posts (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS public.muted_authors (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id),
  CHECK (user_id <> author_id)
);
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hidden_posts_own ON public.hidden_posts;
CREATE POLICY hidden_posts_own ON public.hidden_posts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS muted_authors_own ON public.muted_authors;
CREATE POLICY muted_authors_own ON public.muted_authors FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 2. impressions: which posts a person has been shown (written only through the function) ────────────────────
CREATE TABLE IF NOT EXISTS public.post_impressions (
  post_id       uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  view_count    integer NOT NULL DEFAULT 1,
  PRIMARY KEY (post_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS post_impressions_viewer_idx ON public.post_impressions (viewer_id, first_seen_at);
ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;
-- no policies: nobody reads or writes this table directly

CREATE OR REPLACE FUNCTION public.log_post_impressions(p_post_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_post_ids IS NULL THEN RETURN; END IF;
  INSERT INTO public.post_impressions (post_id, viewer_id)
  SELECT p.id, auth.uid()
    FROM public.posts p
   WHERE p.id = ANY (p_post_ids[1:50]) AND p.author_id IS DISTINCT FROM auth.uid()
  ON CONFLICT (post_id, viewer_id) DO UPDATE
    SET last_seen_at = now(), view_count = public.post_impressions.view_count + 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_post_impressions(uuid[]) TO authenticated;

-- numbers for the author of a post
CREATE OR REPLACE FUNCTION public.get_post_insights(p_post uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.posts%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR p.author_id IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'people_reached', (SELECT count(*) FROM public.post_impressions WHERE post_id = p_post),
    'views', COALESCE((SELECT sum(view_count) FROM public.post_impressions WHERE post_id = p_post), 0),
    'likes', COALESCE(p.like_count, 0),
    'comments', COALESCE(p.comment_count, 0),
    'shares', COALESCE(p.share_count, 0),
    'saves', (SELECT count(*) FROM public.post_bookmarks WHERE post_id = p_post)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_insights(uuid) TO authenticated;

-- ── 3. the feed again: hidden posts, muted authors, and posts you already saw rank lower ───────────────────────
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
  has_collabs BOOLEAN, link_preview JSONB, as_of TIMESTAMP WITH TIME ZONE
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
BEGIN
  IF v_craft IS NOT NULL THEN
    v_craft := '%' || replace(replace(replace(v_craft, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  IF v_following AND v_me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH rel AS (
    SELECT f.following_id AS aid FROM user_follows f WHERE f.follower_id = v_me
    UNION
    SELECT CASE WHEN c.follower_id = v_me THEN c.following_id ELSE c.follower_id END
      FROM user_connections c
     WHERE c.status = 'accepted' AND (c.follower_id = v_me OR c.following_id = v_me)
  ), pg AS (
    SELECT cf.page_id AS pid FROM company_page_followers cf WHERE cf.user_id = v_me
  ), cand AS (
    SELECT p.*,
           (v_me IS NOT NULL AND p.author_id = v_me) AS is_mine,
           (rel.aid IS NOT NULL OR pg.pid IS NOT NULL) AS is_close,
           -- seen before this feed session started (a fixed moment, so the order never changes between pages)
           EXISTS (SELECT 1 FROM post_impressions i WHERE i.post_id = p.id AND i.viewer_id = v_me AND i.first_seen_at < v_as_of) AS was_seen
      FROM posts p
      LEFT JOIN rel ON rel.aid = p.author_id
      LEFT JOIN pg ON pg.pid = p.page_id
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
       -- "not interested" and muted authors (your own posts are never muted)
       AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE v_me IS NOT NULL AND h.user_id = v_me AND h.post_id = p.id)
       AND (p.author_id = v_me OR NOT EXISTS (SELECT 1 FROM muted_authors m WHERE v_me IS NOT NULL AND m.user_id = v_me AND m.author_id = p.author_id))
       AND (NOT v_following OR p.author_id = v_me OR rel.aid IS NOT NULL OR pg.pid IS NOT NULL)
       AND (v_craft IS NULL OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.author_id AND pr.craft ILIKE v_craft))
  ), scored AS (
    SELECT c.*,
           (
             (
               10.0
               + CASE WHEN c.is_close THEN 100.0 WHEN c.is_mine THEN 40.0 ELSE 0.0 END
               + COALESCE(c.like_count, 0) * 3.0
               + COALESCE(c.comment_count, 0) * 6.0
             ) / POWER(GREATEST(EXTRACT(EPOCH FROM (v_as_of - c.created_at)) / 3600.0, 0) + 2.0, 1.2)::numeric
           ) * (CASE WHEN c.was_seen THEN 0.25 ELSE 1.0 END) AS base_score
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
    v.category, v.audience, v.edited_at, v.has_poll, v.scheduled_at, v.has_collabs, v.link_preview, v_as_of
  FROM varied v
  ORDER BY v.final_score DESC, v.created_at DESC, v.id
  LIMIT v_limit OFFSET v_off;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_algorithmic_feed(uuid, integer, timestamptz, integer, timestamptz, text, text) TO authenticated, anon;

COMMIT;
