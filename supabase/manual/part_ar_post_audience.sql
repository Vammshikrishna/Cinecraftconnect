-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AR – Post audience and "edited" label
--   * posts.audience: 'public' (default), 'connections' (only accepted connections) or 'private' (only the author)
--     Enforced by the database for every read of posts (a restrictive policy), by the home-feed function, and for
--     comments (you cannot comment on a post you cannot see). Staff/moderators can still see everything.
--   * posts.edited_at: set when the caption or media of a post is changed, so the apps can show "Edited"
--   * get_algorithmic_feed now also returns category, audience and edited_at
-- Run after part AQ, then deploy the new web + mobile builds. See docs/CREATE_POST.md.
-- Note: profile post counts and "last active" still count private posts (numbers only, no content).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_audience_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_audience_check CHECK (audience IN ('public', 'connections', 'private'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- who may see a non-public post
CREATE OR REPLACE FUNCTION public.can_view_post(p_author uuid, p_audience text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(p_audience, 'public') = 'public'
      OR p_author = auth.uid()
      OR COALESCE(public.is_current_user_internal(), false)
      OR (p_audience = 'connections' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_connections c
             WHERE c.status = 'accepted'
               AND ((c.follower_id = auth.uid() AND c.following_id = p_author)
                 OR (c.following_id = auth.uid() AND c.follower_id = p_author))));
$$;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, text) TO anon, authenticated, service_role;

-- restrictive: it is ANDed with the existing "anyone can view posts" policy, so nothing else has to change
DROP POLICY IF EXISTS posts_audience ON public.posts;
CREATE POLICY posts_audience ON public.posts AS RESTRICTIVE FOR SELECT
  USING (audience = 'public' OR public.can_view_post(author_id, audience));

CREATE INDEX IF NOT EXISTS idx_posts_audience ON public.posts (audience) WHERE audience <> 'public';

-- "Edited"
CREATE OR REPLACE FUNCTION public.mark_post_edited()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.media_items IS DISTINCT FROM OLD.media_items THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_post_edited ON public.posts;
CREATE TRIGGER trg_mark_post_edited BEFORE UPDATE OF content, media_items ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.mark_post_edited();

-- comments: the lock from part AQ, plus "you must be able to see the post"
CREATE OR REPLACE FUNCTION public.guard_post_comment_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_audience text;
  v_locked boolean;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  SELECT p.author_id, p.audience,
         COALESCE((CASE WHEN jsonb_typeof(p.media_items) = 'array' THEN (p.media_items -> 0 ->> 'comments_disabled') END)::boolean, false)
    INTO v_author, v_audience, v_locked
    FROM public.posts p WHERE p.id = NEW.post_id;
  IF NOT public.can_view_post(v_author, v_audience) THEN
    RAISE EXCEPTION 'You cannot comment on this post' USING ERRCODE = 'P0001';
  END IF;
  IF v_locked AND NEW.user_id IS DISTINCT FROM v_author THEN
    RAISE EXCEPTION 'Comments are turned off for this post' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- home feed: same ranking as before, plus the audience rule and three more columns
DROP FUNCTION IF EXISTS public.get_algorithmic_feed(uuid, integer, timestamp with time zone);
CREATE OR REPLACE FUNCTION public.get_algorithmic_feed(
  current_user_id UUID,
  limit_val INT,
  created_at_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL
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
  edited_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.content,
    p.created_at,
    p.updated_at,
    p.media_url,
    p.media_type,
    p.media_items::jsonb,
    p.page_id,
    COALESCE(p.like_count, 0)::int as like_count,
    COALESCE(p.comment_count, 0)::int as comment_count,
    COALESCE(p.share_count, 0)::int as share_count,
    p.tags,
    p.has_ai_generated,
    p.is_pinned,
    (
      10.0 +
      CASE
        WHEN current_user_id IS NOT NULL AND current_user_id = p.author_id THEN 100.0
        WHEN current_user_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_follows f
          WHERE f.follower_id = current_user_id AND f.following_id = p.author_id
        ) THEN 100.0
        WHEN current_user_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM user_connections c
          WHERE c.status = 'accepted' AND (
            (c.follower_id = current_user_id AND c.following_id = p.author_id) OR
            (c.following_id = current_user_id AND c.follower_id = p.author_id)
          )
        ) THEN 100.0
        ELSE 0.0
      END +
      (COALESCE(p.like_count, 0) * 3.0) +
      (COALESCE(p.comment_count, 0) * 6.0)
    ) / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 2.0, 1.2)::numeric as score,
    (
      SELECT row_to_json(pr_sub)
      FROM (
        SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.craft, pr.is_verified
        FROM profiles pr
        WHERE pr.id = p.author_id
      ) pr_sub
    ) as profiles,
    (
      SELECT row_to_json(cp_sub)
      FROM (
        SELECT cp.id, cp.name, cp.logo_url, cp.slug, cp.is_verified
        FROM company_pages cp
        WHERE cp.id = p.page_id
      ) cp_sub
    ) as company_pages,
    p.category,
    p.audience,
    p.edited_at
  FROM posts p
  WHERE
    (created_at_cursor IS NULL OR p.created_at < created_at_cursor)
    -- this function bypasses row-level security, so it applies the audience rule itself, for the signed-in person (auth.uid(), never the id passed in)
    AND (
      p.audience = 'public'
      OR (auth.uid() IS NOT NULL AND p.author_id = auth.uid())
      OR (p.audience = 'connections' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM user_connections c2
             WHERE c2.status = 'accepted' AND (
               (c2.follower_id = auth.uid() AND c2.following_id = p.author_id) OR
               (c2.following_id = auth.uid() AND c2.follower_id = p.author_id))))
    )
  ORDER BY score DESC, p.created_at DESC
  LIMIT limit_val;
END;
$$;

COMMIT;
