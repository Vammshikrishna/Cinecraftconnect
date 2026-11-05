-- PART BG: comment features.
--   * like a comment (comment_likes + a like_count kept by a trigger)
--   * edit your comment (edited_at is set by the database)
--   * pin one comment on your own post, hide a comment on your own post (only the author of the comment, the author of
--     the post and staff can still see a hidden one)
--   * replies: a reply to a reply is stored under the top-level comment (they used to disappear) and remembers who it
--     was addressed to (reply_to_user_id)
--   * notifications for people who are @mentioned in a comment, and for the person whose comment was replied to
-- Run after part BF. Safe to run twice.
BEGIN;

-- ── columns ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS reply_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_top ON public.post_comments (post_id, is_pinned DESC, like_count DESC, created_at DESC) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments (parent_id, created_at);

-- ── likes ────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes (user_id);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comment_likes_read ON public.comment_likes;
CREATE POLICY comment_likes_read ON public.comment_likes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS comment_likes_add ON public.comment_likes;
CREATE POLICY comment_likes_add ON public.comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS comment_likes_remove ON public.comment_likes;
CREATE POLICY comment_likes_remove ON public.comment_likes FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.comment_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSE
    UPDATE public.post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trg_comment_likes_count AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.comment_likes_count();

-- ── replies: keep one level, remember who was addressed ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comment_reply_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_root uuid;
  v_author uuid;
  v_post uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.reply_to_user_id := NULL;
    RETURN NEW;
  END IF;
  SELECT parent_id, user_id, post_id INTO v_root, v_author, v_post FROM public.post_comments WHERE id = NEW.parent_id;
  IF NOT FOUND OR v_post IS DISTINCT FROM NEW.post_id THEN
    RAISE EXCEPTION 'The comment you are replying to is no longer there' USING ERRCODE = 'P0001';
  END IF;
  NEW.reply_to_user_id := v_author;
  IF v_root IS NOT NULL THEN
    NEW.parent_id := v_root;   -- a reply to a reply sits under the same top-level comment
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_comment_reply_target ON public.post_comments;
CREATE TRIGGER trg_comment_reply_target BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.comment_reply_target();

-- ── who may change what on a comment ─────────────────────────────────────────────────────────────
-- The comment's author edits the text. The post's author (or staff) pins and hides. Nobody sets counts by hand.
CREATE OR REPLACE FUNCTION public.guard_post_comment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_post_author uuid;
  v_me uuid := auth.uid();
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;
  END IF;
  IF NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.reply_to_user_id IS DISTINCT FROM OLD.reply_to_user_id
     OR NEW.like_count IS DISTINCT FROM OLD.like_count OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'That part of a comment cannot be changed' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.content IS DISTINCT FROM OLD.content THEN
    IF OLD.user_id IS DISTINCT FROM v_me AND NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Only the author can edit a comment' USING ERRCODE = 'P0001';
    END IF;
    IF length(btrim(coalesce(NEW.content, ''))) = 0 THEN
      RAISE EXCEPTION 'A comment cannot be empty' USING ERRCODE = 'P0001';
    END IF;
    NEW.edited_at := now();
  END IF;

  IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned OR NEW.is_hidden IS DISTINCT FROM OLD.is_hidden THEN
    SELECT author_id INTO v_post_author FROM public.posts WHERE id = OLD.post_id;
    IF v_post_author IS DISTINCT FROM v_me AND NOT public.is_current_user_internal() THEN
      RAISE EXCEPTION 'Only the author of the post can pin or hide comments' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.is_pinned AND OLD.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a top-level comment can be pinned' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_post_comment_update ON public.post_comments;
CREATE TRIGGER trg_guard_post_comment_update BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_comment_update();

-- only one pinned comment per post
CREATE OR REPLACE FUNCTION public.comment_single_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.is_pinned AND NOT OLD.is_pinned THEN
    PERFORM set_config('app.market_system', '1', true);
    UPDATE public.post_comments SET is_pinned = false WHERE post_id = NEW.post_id AND id <> NEW.id AND is_pinned;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_comment_single_pin ON public.post_comments;
CREATE TRIGGER trg_comment_single_pin AFTER UPDATE OF is_pinned ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.comment_single_pin();

-- the post's author may update comments on their post (the trigger above limits that to pin and hide)
DROP POLICY IF EXISTS post_author_moderate_comments ON public.post_comments;
CREATE POLICY post_author_moderate_comments ON public.post_comments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.author_id = auth.uid()));

-- a hidden comment is only visible to its author, the author of the post and staff
DROP POLICY IF EXISTS hidden_comments_restricted ON public.post_comments;
CREATE POLICY hidden_comments_restricted ON public.post_comments AS RESTRICTIVE FOR SELECT
  USING (
    NOT is_hidden
    OR user_id = auth.uid()
    OR public.is_current_user_internal()
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.author_id = auth.uid())
  );

-- ── notifications: @mentions and replies ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text;
  v_post_author uuid;
  v_target uuid;
  v_notified uuid[] := ARRAY[]::uuid[];
  v_name text;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  SELECT COALESCE(NULLIF(btrim(full_name), ''), username, 'Someone') INTO v_actor FROM public.profiles WHERE id = NEW.user_id;
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = NEW.post_id;

  -- people named with @username (the post's author already gets "New Comment")
  FOR v_name IN SELECT DISTINCT lower((regexp_matches(NEW.content, '@([A-Za-z0-9_.]{2,30})', 'g'))[1]) LOOP
    SELECT id INTO v_target FROM public.profiles WHERE lower(username) = v_name LIMIT 1;
    IF v_target IS NULL OR v_target = NEW.user_id OR v_target = v_post_author OR v_target = ANY(v_notified) THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocked_users b
                WHERE (b.user_id = v_target AND b.blocked_user_id = NEW.user_id)
                   OR (b.user_id = NEW.user_id AND b.blocked_user_id = v_target)) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (v_target, NEW.user_id, 'mention', 'You were mentioned',
            v_actor || ' mentioned you in a comment: ' || left(NEW.content, 120),
            '/post/' || NEW.post_id, NEW.post_id);
    v_notified := v_notified || v_target;
  END LOOP;

  -- the person whose comment was replied to (unless already told above, or it is the post's author)
  IF NEW.reply_to_user_id IS NOT NULL AND NEW.reply_to_user_id <> NEW.user_id
     AND NEW.reply_to_user_id <> v_post_author AND NOT (NEW.reply_to_user_id = ANY(v_notified))
     AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                      WHERE (b.user_id = NEW.reply_to_user_id AND b.blocked_user_id = NEW.user_id)
                         OR (b.user_id = NEW.user_id AND b.blocked_user_id = NEW.reply_to_user_id)) THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (NEW.reply_to_user_id, NEW.user_id, 'comment_reply', 'New reply',
            v_actor || ' replied to your comment: ' || left(NEW.content, 120),
            '/post/' || NEW.post_id, NEW.post_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_comment_mentions ON public.post_comments;
CREATE TRIGGER trg_notify_comment_mentions AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mentions();

-- ── tidy up comments that already exist ─────────────────────────────────────────────────────────
SELECT set_config('app.market_system', '1', true);
-- replies to replies were stored under the reply and never shown: move them under the top-level comment
UPDATE public.post_comments c
   SET reply_to_user_id = p.user_id, parent_id = p.parent_id
  FROM public.post_comments p
 WHERE c.parent_id = p.id AND p.parent_id IS NOT NULL;
-- remember who ordinary replies were addressed to
UPDATE public.post_comments c
   SET reply_to_user_id = p.user_id
  FROM public.post_comments p
 WHERE c.parent_id = p.id AND p.parent_id IS NULL AND c.reply_to_user_id IS NULL;
-- like counts for any likes that exist already (none yet, but safe to repeat)
UPDATE public.post_comments c SET like_count = x.n FROM (SELECT comment_id, count(*)::int AS n FROM public.comment_likes GROUP BY comment_id) x WHERE x.comment_id = c.id;

COMMIT;
