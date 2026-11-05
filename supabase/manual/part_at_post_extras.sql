-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AT – Scheduled posts, link previews, collaborator flag, hidden like counts in the feed
--   * posts.scheduled_at: a post can be written now and published later. Until its time only the author (and staff)
--     can see it; at its time it appears everywhere, sorted by its publish time. Notifications (followers, mentions,
--     page followers) are sent when it becomes visible, not when it was written.
--   * release_due_posts(): called by the apps whenever the feed loads (and by a schedule, if you add one); idempotent.
--   * reschedule_post(post, when): change the time, or publish now (when = null).
--   * posts.link_preview: title/description/image of the first link in a post (checked: the link must be in the caption).
--   * posts.has_collabs: lets the feed know which posts to ask the collaborator function about (part AU).
--   * private posts no longer send "New Post" notifications to connections.
--   * the home feed hides the like count of posts whose author chose "Hide like counts" (for everyone but the author)
--   * get_algorithmic_feed is recreated again (final version: audience, polls, schedule, collaborators, link preview)
-- Run after part AS, then deploy the new web + mobile builds. See docs/POST_EXTRAS.md.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS has_collabs boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS link_preview jsonb;
CREATE INDEX IF NOT EXISTS idx_posts_due ON public.posts (scheduled_at) WHERE scheduled_at IS NOT NULL AND released_at IS NULL;

-- ── rules for the new columns ────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_post_extras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_lp jsonb;
  v_url text;
  v_img text;
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;

  -- schedule
  IF TG_OP = 'INSERT' THEN
    IF NEW.scheduled_at IS NOT NULL THEN
      IF NEW.scheduled_at > now() + interval '90 days' THEN
        RAISE EXCEPTION 'You can schedule a post up to 90 days ahead' USING ERRCODE = 'P0001';
      END IF;
      IF NEW.scheduled_at <= now() + interval '1 minute' THEN
        NEW.scheduled_at := NULL;                -- too soon to matter: publish now
      ELSE
        NEW.created_at := NEW.scheduled_at;      -- it sorts by the time it goes live
      END IF;
    END IF;
    NEW.released_at := NULL;
    NEW.has_collabs := false;                    -- only the collaborator function may set this
  ELSE
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.released_at IS DISTINCT FROM OLD.released_at THEN
      RAISE EXCEPTION 'Use "Publish now" or "Reschedule" to change when a post goes live' USING ERRCODE = 'P0001';
    END IF;
    NEW.has_collabs := OLD.has_collabs;
  END IF;

  -- link preview: only an object, only short plain fields, and its link must be in the caption (so a preview cannot lie about where it goes)
  IF NEW.link_preview IS NOT NULL THEN
    IF jsonb_typeof(NEW.link_preview) <> 'object' THEN
      NEW.link_preview := NULL;
    ELSE
      v_url := left(btrim(COALESCE(NEW.link_preview ->> 'url', '')), 2048);
      v_img := left(btrim(COALESCE(NEW.link_preview ->> 'image', '')), 2048);
      IF v_url !~* '^https?://' OR position(lower(v_url) IN lower(COALESCE(NEW.content, ''))) = 0 THEN
        NEW.link_preview := NULL;
      ELSE
        v_lp := jsonb_build_object(
          'url', v_url,
          'title', left(btrim(COALESCE(NEW.link_preview ->> 'title', '')), 200),
          'description', left(btrim(COALESCE(NEW.link_preview ->> 'description', '')), 300),
          'site', left(btrim(COALESCE(NEW.link_preview ->> 'site', '')), 100),
          'image', CASE WHEN v_img ~* '^https://' THEN v_img ELSE NULL END
        );
        NEW.link_preview := v_lp;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_post_extras ON public.posts;
CREATE TRIGGER trg_guard_post_extras BEFORE INSERT OR UPDATE OF scheduled_at, released_at, has_collabs, link_preview, content ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_extras();

-- ── a scheduled post is invisible to others until its time ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS posts_scheduled ON public.posts;
CREATE POLICY posts_scheduled ON public.posts AS RESTRICTIVE FOR SELECT
  USING (scheduled_at IS NULL OR scheduled_at <= now() OR author_id = auth.uid() OR COALESCE(public.is_current_user_internal(), false));

-- ── notifications wait for the publish time ──────────────────────────────────────────────────────────────────────
-- mentions and tags (part AQ)
DROP TRIGGER IF EXISTS trg_notify_post_mentions ON public.posts;
DROP TRIGGER IF EXISTS trg_notify_post_mentions_released ON public.posts;
CREATE TRIGGER trg_notify_post_mentions AFTER INSERT ON public.posts
  FOR EACH ROW WHEN (NEW.scheduled_at IS NULL) EXECUTE FUNCTION public.notify_post_mentions();
CREATE TRIGGER trg_notify_post_mentions_released AFTER UPDATE OF released_at ON public.posts
  FOR EACH ROW WHEN (OLD.released_at IS NULL AND NEW.released_at IS NOT NULL) EXECUTE FUNCTION public.notify_post_mentions();

-- "new post" to connections: not for private posts, and not before a scheduled post is live
DROP TRIGGER IF EXISTS on_post_notification ON public.posts;
DROP TRIGGER IF EXISTS on_post_notification_released ON public.posts;
CREATE TRIGGER on_post_notification AFTER INSERT ON public.posts
  FOR EACH ROW WHEN (NEW.scheduled_at IS NULL AND NEW.audience <> 'private') EXECUTE FUNCTION public.handle_new_post_notification();
CREATE TRIGGER on_post_notification_released AFTER UPDATE OF released_at ON public.posts
  FOR EACH ROW WHEN (OLD.released_at IS NULL AND NEW.released_at IS NOT NULL AND NEW.audience <> 'private') EXECUTE FUNCTION public.handle_new_post_notification();

-- followers of a company page (part U)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'notify_followers_of_page_post') THEN
    DROP TRIGGER IF EXISTS trg_notify_followers_of_page_post ON public.posts;
    DROP TRIGGER IF EXISTS trg_notify_followers_of_page_post_released ON public.posts;
    CREATE TRIGGER trg_notify_followers_of_page_post AFTER INSERT ON public.posts
      FOR EACH ROW WHEN (NEW.page_id IS NOT NULL AND NEW.scheduled_at IS NULL AND NEW.audience = 'public') EXECUTE FUNCTION public.notify_followers_of_page_post();
    CREATE TRIGGER trg_notify_followers_of_page_post_released AFTER UPDATE OF released_at ON public.posts
      FOR EACH ROW WHEN (NEW.page_id IS NOT NULL AND OLD.released_at IS NULL AND NEW.released_at IS NOT NULL AND NEW.audience = 'public') EXECUTE FUNCTION public.notify_followers_of_page_post();
  END IF;
END $$;

-- ── publish what is due; change or cancel a schedule ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_due_posts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.posts SET released_at = now()
   WHERE scheduled_at IS NOT NULL AND scheduled_at <= now() AND released_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_post(p_post uuid, p_when timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_sched timestamptz;
  v_released timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT author_id, scheduled_at, released_at INTO v_author, v_sched, v_released FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR v_author IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only change your own scheduled posts' USING ERRCODE = 'P0001';
  END IF;
  IF v_sched IS NULL OR v_released IS NOT NULL OR v_sched <= now() THEN
    RAISE EXCEPTION 'This post is already published' USING ERRCODE = 'P0001';
  END IF;
  IF p_when IS NOT NULL AND p_when > now() + interval '90 days' THEN
    RAISE EXCEPTION 'You can schedule a post up to 90 days ahead' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.market_system', '1', true);
  IF p_when IS NULL OR p_when <= now() + interval '1 minute' THEN
    -- publish now: it goes live and the notifications are sent
    UPDATE public.posts SET scheduled_at = NULL, created_at = now(), released_at = now() WHERE id = p_post;
  ELSE
    UPDATE public.posts SET scheduled_at = p_when, created_at = p_when WHERE id = p_post;
  END IF;
  PERFORM set_config('app.market_system', '', true);
  RETURN jsonb_build_object('success', true, 'published', p_when IS NULL OR p_when <= now() + interval '1 minute');
END;
$$;

REVOKE ALL ON FUNCTION public.release_due_posts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_post(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_due_posts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_post(uuid, timestamptz) TO authenticated;

-- home feed, final version: audience (AR), polls (AS), schedule, collaborators, link preview and hidden like counts
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
  has_poll BOOLEAN,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  has_collabs BOOLEAN,
  link_preview JSONB
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
    -- "Hide like counts": everyone but the author gets 0 here (the apps hide it too)
    (CASE WHEN COALESCE((CASE WHEN jsonb_typeof(p.media_items) = 'array' THEN (p.media_items -> 0 ->> 'hide_likes') END)::boolean, false)
               AND p.author_id IS DISTINCT FROM auth.uid() THEN 0 ELSE COALESCE(p.like_count, 0) END)::int as like_count,
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
    ) / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 0) + 2.0, 1.2)::numeric as score,
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
    p.has_poll,
    p.scheduled_at,
    p.has_collabs,
    p.link_preview
  FROM posts p
  WHERE
    (created_at_cursor IS NULL OR p.created_at < created_at_cursor)
    -- a scheduled post is only for its author until it goes live
    AND (p.scheduled_at IS NULL OR p.scheduled_at <= now() OR (auth.uid() IS NOT NULL AND p.author_id = auth.uid()))
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
