-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AQ – Posts: limits, categories, mentions and comment lock
--   * posts.category (Casting, Equipment, ...): a topic that is separate from hashtags
--   * the database now enforces what the apps promise: caption up to 2200 characters, up to 10 photos/videos, tags
--     lower-cased + unique (max 30), and a posting rate limit (20 an hour, 100 a day)
--   * @mentions in a caption and people tagged on a post now get a "mentioned you" notification (max 10 per post,
--     never to someone who blocked the author)
--   * "Turn off commenting" is now enforced: only the post's author can comment on a post that has comments off
--   * tags that were saved with capitals are lower-cased so #Film is found by a search for #film
--   * index for tag searches
-- Run after part AP, then deploy the new web + mobile builds. See docs/CREATE_POST.md.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_category_check CHECK (category IS NULL OR char_length(category) <= 30);

-- ── tidy existing tags (before the guard exists) ─────────────────────────────────────────────────────────────────
UPDATE public.posts p
   SET tags = (
     SELECT COALESCE(array_agg(d.t ORDER BY d.o), ARRAY[]::text[])
       FROM (
         SELECT t, min(o) AS o
           FROM (SELECT lower(btrim(x)) AS t, o FROM unnest(p.tags) WITH ORDINALITY AS u(x, o)) s
          WHERE t <> '' AND char_length(t) <= 50
          GROUP BY t ORDER BY min(o) LIMIT 30
       ) d
   )
 WHERE p.tags IS NOT NULL
   AND EXISTS (SELECT 1 FROM unnest(p.tags) AS x WHERE x <> lower(btrim(x)) OR x = '');

CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON public.posts USING gin (tags);

-- ── limits ───────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tags text[];
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF NEW.content IS NOT NULL AND char_length(NEW.content) > 2200 THEN
    RAISE EXCEPTION 'Your caption is too long (the limit is 2200 characters)' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.media_items IS NOT NULL AND jsonb_typeof(NEW.media_items) = 'array' AND jsonb_array_length(NEW.media_items) > 10 THEN
    RAISE EXCEPTION 'You can add up to 10 photos or videos to a post' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.tags IS NOT NULL THEN
    SELECT COALESCE(array_agg(d.t ORDER BY d.o), ARRAY[]::text[]) INTO v_tags
      FROM (
        SELECT t, min(o) AS o
          FROM (SELECT lower(btrim(x)) AS t, o FROM unnest(NEW.tags) WITH ORDINALITY AS u(x, o)) s
         WHERE t <> '' AND char_length(t) <= 50
         GROUP BY t ORDER BY min(o) LIMIT 30
      ) d;
    NEW.tags := v_tags;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.posts WHERE author_id = NEW.author_id AND created_at > now() - interval '1 hour') >= 20 THEN
      RAISE EXCEPTION 'You are posting very quickly. Please wait a little and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.posts WHERE author_id = NEW.author_id AND created_at > now() - interval '1 day') >= 100 THEN
      RAISE EXCEPTION 'You have reached today''s posting limit. Please try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_post ON public.posts;
CREATE TRIGGER trg_guard_post BEFORE INSERT OR UPDATE OF content, tags, media_items, category ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post();

-- ── @mentions and tagged people ──────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ids uuid[];
  v_tagged jsonb;
BEGIN
  v_tagged := CASE
    WHEN jsonb_typeof(NEW.media_items) = 'array' AND jsonb_array_length(NEW.media_items) > 0
         AND jsonb_typeof(NEW.media_items -> 0 -> 'tagged_users') = 'array'
    THEN NEW.media_items -> 0 -> 'tagged_users'
    ELSE '[]'::jsonb
  END;

  SELECT array_agg(x.id) INTO v_ids FROM (
    SELECT DISTINCT a.id FROM (
      SELECT p.id FROM public.profiles p
       WHERE lower(p.username) IN (
         SELECT lower(m[1]) FROM regexp_matches(COALESCE(NEW.content, ''), '(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,20})', 'g') AS m
       )
      UNION
      SELECT (t ->> 'id')::uuid FROM jsonb_array_elements(v_tagged) t
       WHERE (t ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) a
    WHERE a.id <> NEW.author_id
      AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = a.id)
      AND NOT EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.user_id = a.id AND b.blocked_user_id = NEW.author_id)
    LIMIT 10
  ) x;

  IF v_ids IS NOT NULL THEN
    INSERT INTO public.mentions (mentioner_id, mentioned_id, related_id, related_type)
    SELECT NEW.author_id, i, NEW.id, 'post' FROM unnest(v_ids) AS i;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_post_mentions ON public.posts;
CREATE TRIGGER trg_notify_post_mentions AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

-- ── "turn off commenting" is enforced, not just hidden ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_post_comment_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_locked boolean;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  SELECT p.author_id,
         COALESCE((CASE WHEN jsonb_typeof(p.media_items) = 'array' THEN (p.media_items -> 0 ->> 'comments_disabled') END)::boolean, false)
    INTO v_author, v_locked
    FROM public.posts p WHERE p.id = NEW.post_id;
  IF v_locked AND NEW.user_id IS DISTINCT FROM v_author THEN
    RAISE EXCEPTION 'Comments are turned off for this post' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_post_comment_lock ON public.post_comments;
CREATE TRIGGER trg_guard_post_comment_lock BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_comment_lock();

COMMIT;
