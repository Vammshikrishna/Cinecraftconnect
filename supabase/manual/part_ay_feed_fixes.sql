-- PART AY: Feed fixes. One ranking function for web and mobile with stable paging, block list, a time window,
-- author variety and server-side Following / craft tabs. Run after part AX, then deploy the new web + mobile builds.
-- See docs/FEED.md.
BEGIN;

-- the old signature goes (it paged by created_at while sorting by score, so pages skipped posts)
DROP FUNCTION IF EXISTS public.get_algorithmic_feed(uuid, integer, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_algorithmic_feed(uuid, integer, timestamp with time zone, integer, timestamp with time zone, text, text);

CREATE OR REPLACE FUNCTION public.get_algorithmic_feed(
  current_user_id UUID,                                  -- kept for older builds; the signed-in person is always auth.uid()
  limit_val INT,
  created_at_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,   -- older builds only
  p_offset INT DEFAULT 0,                                -- page n = n * limit_val
  p_as_of TIMESTAMP WITH TIME ZONE DEFAULT NULL,         -- the moment the first page was ranked; send it back for every later page
  p_tab TEXT DEFAULT 'for_you',                          -- 'for_you' | 'following'
  p_craft TEXT DEFAULT NULL                              -- only authors whose craft contains this word
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  media_url TEXT,
  media_type TEXT,
  media_items JSONB,
  page_id UUID,
  like_count INT,
  comment_count INT,
  share_count INT,
  tags TEXT[],
  has_ai_generated BOOLEAN,
  is_pinned BOOLEAN,
  score NUMERIC,
  profiles JSON,
  company_pages JSON,
  category TEXT,
  audience TEXT,
  edited_at TIMESTAMP WITH TIME ZONE,
  has_poll BOOLEAN,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  has_collabs BOOLEAN,
  link_preview JSONB,
  as_of TIMESTAMP WITH TIME ZONE
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
           (rel.aid IS NOT NULL OR pg.pid IS NOT NULL) AS is_close
      FROM posts p
      LEFT JOIN rel ON rel.aid = p.author_id
      LEFT JOIN pg ON pg.pid = p.page_id
     WHERE p.created_at <= v_as_of
       -- only recent posts are ranked, so the work stays small as the table grows
       AND p.created_at > v_as_of - interval '120 days'
       AND (p_as_of IS NOT NULL OR created_at_cursor IS NULL OR p.created_at < created_at_cursor)
       -- a scheduled post is only for its author until it goes live
       AND (p.scheduled_at IS NULL OR p.scheduled_at <= now() OR p.author_id = v_me)
       -- this function bypasses row-level security, so it applies the audience rule itself
       AND (
         p.audience = 'public'
         OR p.author_id = v_me
         OR (p.audience = 'connections' AND v_me IS NOT NULL AND EXISTS (
               SELECT 1 FROM user_connections c2
                WHERE c2.status = 'accepted' AND (
                  (c2.follower_id = v_me AND c2.following_id = p.author_id) OR
                  (c2.following_id = v_me AND c2.follower_id = p.author_id))))
       )
       -- people you blocked, and people who blocked you, never show up
       AND NOT EXISTS (
         SELECT 1 FROM blocked_users b
          WHERE v_me IS NOT NULL
            AND ((b.user_id = v_me AND b.blocked_user_id = p.author_id) OR (b.user_id = p.author_id AND b.blocked_user_id = v_me)))
       AND (NOT v_following OR p.author_id = v_me OR rel.aid IS NOT NULL OR pg.pid IS NOT NULL)
       AND (v_craft IS NULL OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = p.author_id AND pr.craft ILIKE v_craft))
  ), scored AS (
    SELECT c.*,
           (
             10.0
             + CASE WHEN c.is_close THEN 100.0 WHEN c.is_mine THEN 40.0 ELSE 0.0 END
             + COALESCE(c.like_count, 0) * 3.0
             + COALESCE(c.comment_count, 0) * 6.0
           ) / POWER(GREATEST(EXTRACT(EPOCH FROM (v_as_of - c.created_at)) / 3600.0, 0) + 2.0, 1.2)::numeric AS base_score
      FROM cand c
  ), varied AS (
    -- one author's 2nd, 3rd... post is worth a bit less, so nobody floods the feed
    SELECT s.*,
           s.base_score / (1.0 + 0.35 * (row_number() OVER (PARTITION BY s.author_id ORDER BY s.base_score DESC, s.created_at DESC, s.id) - 1)) AS final_score
      FROM scored s
  )
  SELECT
    v.id,
    v.author_id,
    v.content,
    v.created_at,
    v.updated_at,
    v.media_url,
    v.media_type,
    v.media_items::jsonb,
    v.page_id,
    -- "Hide like counts": everyone but the author gets 0 here (the apps hide it too)
    (CASE WHEN COALESCE((CASE WHEN jsonb_typeof(v.media_items) = 'array' THEN (v.media_items -> 0 ->> 'hide_likes') END)::boolean, false)
               AND v.author_id IS DISTINCT FROM v_me THEN 0 ELSE COALESCE(v.like_count, 0) END)::int,
    COALESCE(v.comment_count, 0)::int,
    COALESCE(v.share_count, 0)::int,
    v.tags,
    v.has_ai_generated,
    v.is_pinned,
    v.final_score::numeric,
    (SELECT row_to_json(pr_sub) FROM (
        SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.craft, pr.is_verified, pr.account_type
          FROM profiles pr WHERE pr.id = v.author_id) pr_sub),
    (SELECT row_to_json(cp_sub) FROM (
        SELECT cp.id, cp.name, cp.logo_url, cp.slug, cp.is_verified
          FROM company_pages cp WHERE cp.id = v.page_id) cp_sub),
    v.category,
    v.audience,
    v.edited_at,
    v.has_poll,
    v.scheduled_at,
    v.has_collabs,
    v.link_preview,
    v_as_of
  FROM varied v
  ORDER BY v.final_score DESC, v.created_at DESC, v.id
  LIMIT v_limit OFFSET v_off;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_algorithmic_feed(uuid, integer, timestamptz, integer, timestamptz, text, text) TO authenticated, anon;

-- likes and bookmarks of a person for a list of posts (the apps used to load every like, and stopped at 1000 / 100)
CREATE OR REPLACE FUNCTION public.get_my_post_flags(p_post_ids uuid[])
RETURNS TABLE (post_id uuid, liked boolean, bookmarked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT x.pid,
         EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = x.pid AND l.user_id = auth.uid()),
         EXISTS (SELECT 1 FROM post_bookmarks b WHERE b.post_id = x.pid AND b.user_id = auth.uid())
    FROM unnest(COALESCE(p_post_ids, '{}'::uuid[])) AS x(pid)
   WHERE auth.uid() IS NOT NULL
   LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_post_flags(uuid[]) TO authenticated;

COMMIT;
