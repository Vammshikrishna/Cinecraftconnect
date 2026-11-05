-- PART CP - post counters, comment/like privacy, moderator profile edits (audit step 1d)
-- Run in the Supabase SQL editor AFTER part_cl. Based on the LIVE policies and function bodies read in the audit.
-- No app change is needed.
--
-- Fixes:
--   posts           - an author can no longer set like_count / comment_count / share_count (only the database's own
--                     like/comment triggers change them)
--   post_comments, post_likes - comments and likes follow the privacy of their post (private, connections-only and
--                     scheduled posts no longer leak their comments and likers to anyone who knows the post id)
--   profiles        - a moderator can no longer PATCH ban / verified / shadowban fields directly on any profile; they
--                     keep using the audited ban/mute/verify functions. Admins keep the existing admin policy.

-- ---------------------------------------------------------------------------
-- 1. Post counters are written only by the like/comment triggers.
--    (pg_trigger_depth() > 1 is the like/comment trigger updating the post; a client edit is depth 1.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cp_guard_post_counters()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 OR public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.like_count := 0;
    NEW.comment_count := 0;
    NEW.share_count := 0;
  ELSE
    NEW.like_count := OLD.like_count;
    NEW.comment_count := OLD.comment_count;
    NEW.share_count := OLD.share_count;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cp_guard_post_counters_insert ON public.posts;
CREATE TRIGGER trg_cp_guard_post_counters_insert
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.cp_guard_post_counters();

DROP TRIGGER IF EXISTS trg_cp_guard_post_counters_update ON public.posts;
CREATE TRIGGER trg_cp_guard_post_counters_update
  BEFORE UPDATE OF like_count, comment_count, share_count ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.cp_guard_post_counters();

-- ---------------------------------------------------------------------------
-- 2. Comments and likes are visible only when the post itself is visible to the viewer.
--    The posts policies (public / connections / private / scheduled) apply inside the sub-query.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Comments follow post visibility" ON public.post_comments;
CREATE POLICY "Comments follow post visibility" ON public.post_comments
  AS RESTRICTIVE FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id));

DROP POLICY IF EXISTS "Likes follow post visibility" ON public.post_likes;
CREATE POLICY "Likes follow post visibility" ON public.post_likes
  AS RESTRICTIVE FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id));

-- ---------------------------------------------------------------------------
-- 3. Moderators use the audited functions, not direct profile edits.
--    ("Admins can manage all profiles" still lets admins and super admins edit; the ban/mute/verify functions run
--    with owner rights and are unaffected.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
