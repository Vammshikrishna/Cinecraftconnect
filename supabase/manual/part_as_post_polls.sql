-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AS – Polls on posts
--   A post can carry a poll: an optional question and 2 to 4 options, optionally closing in 1, 3 or 7 days.
--   * everyone who can see the post can vote once (and change their vote until the poll closes)
--   * results are shown to a person after they vote, to the author at any time, and to everyone once the poll closes
--   * nobody can read or write the poll tables directly: everything goes through the functions below, which check
--     who is asking (including the post audience from part AR)
--   * posts.has_poll lets the feed know which posts to ask about (get_algorithmic_feed is recreated to return it)
-- Run after part AR, then deploy the new web + mobile builds. See docs/POLLS.md.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS has_poll boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.post_polls (
  post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '' CHECK (char_length(question) <= 140),
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.post_polls(post_id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  UNIQUE (post_id, position)
);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  post_id uuid NOT NULL REFERENCES public.post_polls(post_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_poll_votes_option ON public.post_poll_votes (option_id);

-- no direct access: row-level security on, no policies, no grants
ALTER TABLE public.post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_polls, public.post_poll_options, public.post_poll_votes FROM anon, authenticated, PUBLIC;

-- ── add a poll to a post you just created ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_post_poll(
  p_post uuid, p_question text, p_options text[], p_closes_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_created timestamptz;
  v_opts text[];
  v_i int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT author_id, created_at INTO v_author, v_created FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR v_author IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only add a poll to your own post' USING ERRCODE = 'P0001';
  END IF;
  IF v_created < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'A poll has to be added when the post is created' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.post_polls WHERE post_id = p_post) THEN
    RAISE EXCEPTION 'This post already has a poll' USING ERRCODE = 'P0001';
  END IF;

  -- clean options: trimmed, not empty, no repeats (ignoring capitals)
  SELECT COALESCE(array_agg(t ORDER BY o), ARRAY[]::text[]) INTO v_opts FROM (
    SELECT DISTINCT ON (lower(t)) t, o FROM (
      SELECT btrim(x) AS t, o FROM unnest(COALESCE(p_options, ARRAY[]::text[])) WITH ORDINALITY AS u(x, o)
    ) s WHERE t <> '' ORDER BY lower(t), o
  ) d;
  IF array_length(v_opts, 1) IS NULL OR array_length(v_opts, 1) < 2 THEN
    RAISE EXCEPTION 'A poll needs at least 2 different options' USING ERRCODE = 'P0001';
  END IF;
  IF array_length(v_opts, 1) > 4 THEN
    RAISE EXCEPTION 'A poll can have up to 4 options' USING ERRCODE = 'P0001';
  END IF;
  FOR v_i IN 1 .. array_length(v_opts, 1) LOOP
    IF char_length(v_opts[v_i]) > 60 THEN
      RAISE EXCEPTION 'Poll options can be up to 60 characters' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  IF char_length(COALESCE(p_question, '')) > 140 THEN
    RAISE EXCEPTION 'The poll question can be up to 140 characters' USING ERRCODE = 'P0001';
  END IF;
  IF p_closes_at IS NOT NULL AND (p_closes_at <= now() OR p_closes_at > now() + interval '31 days') THEN
    RAISE EXCEPTION 'Choose a closing time within the next 30 days' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.post_polls (post_id, question, closes_at) VALUES (p_post, btrim(COALESCE(p_question, '')), p_closes_at);
  FOR v_i IN 1 .. array_length(v_opts, 1) LOOP
    INSERT INTO public.post_poll_options (post_id, position, label) VALUES (p_post, v_i, v_opts[v_i]);
  END LOOP;
  UPDATE public.posts SET has_poll = true WHERE id = p_post;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── read polls (many posts at once, so a feed makes one request) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_polls(p_posts uuid[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(x.obj), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'post_id', pp.post_id,
      'question', pp.question,
      'closes_at', pp.closes_at,
      'closed', (pp.closes_at IS NOT NULL AND pp.closes_at <= now()),
      'is_author', (po.author_id = auth.uid()),
      'my_option', mv.option_id,
      'total', (SELECT count(*) FROM public.post_poll_votes v WHERE v.post_id = pp.post_id),
      'options', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', o.id, 'label', o.label, 'position', o.position,
          -- counts are hidden until you have voted, you are the author, or the poll has closed
          'votes', CASE WHEN mv.option_id IS NOT NULL OR po.author_id = auth.uid() OR (pp.closes_at IS NOT NULL AND pp.closes_at <= now())
                        THEN (SELECT count(*) FROM public.post_poll_votes v2 WHERE v2.option_id = o.id) ELSE NULL END
        ) ORDER BY o.position)
          FROM public.post_poll_options o WHERE o.post_id = pp.post_id)
    ) AS obj
      FROM public.post_polls pp
      JOIN public.posts po ON po.id = pp.post_id
      LEFT JOIN public.post_poll_votes mv ON mv.post_id = pp.post_id AND mv.user_id = auth.uid()
     WHERE pp.post_id = ANY (p_posts)
       AND public.can_view_post(po.author_id, po.audience)   -- this function bypasses row-level security, so it checks the audience itself
     LIMIT 50
  ) x;
$$;

-- ── vote (or change your vote) ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vote_in_poll(p_option uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_post uuid;
  v_closes timestamptz;
  v_author uuid;
  v_aud text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT o.post_id, pp.closes_at, po.author_id, po.audience INTO v_post, v_closes, v_author, v_aud
    FROM public.post_poll_options o
    JOIN public.post_polls pp ON pp.post_id = o.post_id
    JOIN public.posts po ON po.id = o.post_id
   WHERE o.id = p_option;
  IF NOT FOUND OR NOT public.can_view_post(v_author, v_aud) THEN
    RAISE EXCEPTION 'This poll is not available' USING ERRCODE = 'P0001';
  END IF;
  IF v_closes IS NOT NULL AND v_closes <= now() THEN
    RAISE EXCEPTION 'This poll has closed' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.post_poll_votes (post_id, user_id, option_id) VALUES (v_post, auth.uid(), p_option)
  ON CONFLICT (post_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = now();
  RETURN public.get_polls(ARRAY[v_post]) -> 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_poll_vote(p_post uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_closes timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT closes_at INTO v_closes FROM public.post_polls WHERE post_id = p_post;
  IF v_closes IS NOT NULL AND v_closes <= now() THEN
    RAISE EXCEPTION 'This poll has closed' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.post_poll_votes WHERE post_id = p_post AND user_id = auth.uid();
  RETURN public.get_polls(ARRAY[p_post]) -> 0;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_post_poll(uuid, text, text[], timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_polls(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vote_in_poll(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_poll_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_post_poll(uuid, text, text[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_polls(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_in_poll(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_poll_vote(uuid) TO authenticated;

-- home feed: the same function as part AR, plus has_poll
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
  edited_at TIMESTAMP WITH TIME ZONE,
  has_poll BOOLEAN
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
    p.edited_at,
    p.has_poll
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
