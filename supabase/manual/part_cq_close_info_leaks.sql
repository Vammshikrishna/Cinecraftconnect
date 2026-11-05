-- PART CQ - stop "ask about any user" information leaks (audit step 1e)
-- Run in the Supabase SQL editor AFTER part_cp. Based on the LIVE function bodies read in audit_step3_preflight.sql.
-- No app change is needed: each function keeps its name, arguments and result shape.
--
-- Fixes:
--   announcement_visible, is_page_team   - could be asked about ANY user id (who follows a company page, who is on its team)
--   pitch_is_blocked                     - could be asked whether any two users have blocked each other
--   entitlement helpers (5)              - plan, override and private-room/project counts of any user; now internal-only
--   get_profile_counts / get_profile_activity - counted or timed private, connections-only and scheduled posts
--   introduction_options                 - listed mutual connections of a private-profile or blocking user
--   room_member_counts                   - member counts of private rooms
--   trending_community_titles + ratings  - one rater could choose the title/poster shown in the public trending list

-- Safety check: stop without changing anything if a policy depends on the entitlement helpers (they are about to be
-- locked to the database's own functions).
DO $do$
DECLARE v_hits text;
BEGIN
  SELECT string_agg(schemaname || '.' || tablename || ':' || policyname, ', ') INTO v_hits
  FROM pg_policies
  WHERE coalesce(qual, '') ~* '(has_entitlement|entitlement_limit|count_for_limit|resolve_entitlements|has_product_access)'
     OR coalesce(with_check, '') ~* '(has_entitlement|entitlement_limit|count_for_limit|resolve_entitlements|has_product_access)';
  IF v_hits IS NOT NULL THEN
    RAISE EXCEPTION 'These policies call the entitlement helpers, so they cannot be locked yet: %. Send me this message.', v_hits;
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 1. announcement_visible: always about the signed-in caller, whatever user id is passed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announcement_visible(p_audience text, p_author uuid, p_page uuid, p_posted timestamp with time zone, p_expires timestamp with time zone, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- The user id passed in is ignored: the answer is only ever about the person asking.
  p_uid := auth.uid();

  -- the publisher side and staff always see it (drafts-in-waiting, expired ones, team-only)
  IF p_uid IS NOT NULL AND (p_author = p_uid OR (p_page IS NOT NULL AND public.is_page_manager(p_page, p_uid)) OR public.is_current_user_internal()) THEN
    RETURN true;
  END IF;
  IF p_posted > now() OR (p_expires IS NOT NULL AND p_expires <= now()) THEN
    RETURN false;
  END IF;
  IF p_audience = 'everyone' THEN RETURN true; END IF;
  IF p_uid IS NULL THEN RETURN false; END IF;

  IF p_audience = 'team' THEN
    RETURN p_page IS NOT NULL AND public.is_page_team(p_page, p_uid);
  END IF;
  -- followers
  IF p_page IS NOT NULL THEN
    RETURN public.is_page_team(p_page, p_uid)
        OR EXISTS (SELECT 1 FROM company_page_followers f WHERE f.page_id = p_page AND f.user_id = p_uid);
  END IF;
  RETURN EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = p_uid AND uf.following_id = p_author);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. is_page_team: only about yourself (or staff / the database's own service key).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_page_team(p_page_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_page_id IS NOT NULL AND p_user_id IS NOT NULL
    AND (p_user_id = auth.uid() OR auth.role() = 'service_role' OR COALESCE(public.is_current_user_internal(), false))
    AND (
      EXISTS (SELECT 1 FROM company_pages WHERE id = p_page_id AND owner_id = p_user_id)
      OR EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = p_page_id AND user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM company_page_members WHERE page_id = p_page_id AND user_id = p_user_id)
    );
$function$;

-- ---------------------------------------------------------------------------
-- 3. pitch_is_blocked: only for pairs that include the caller (or staff / the service key).
--    (The pitch triggers that call it always pass the signed-in user as one side.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitch_is_blocked(p_a uuid, p_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (auth.uid() IN (p_a, p_b) OR auth.role() = 'service_role' OR COALESCE(public.is_current_user_internal(), false))
    AND EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.user_id = p_a AND b.blocked_user_id = p_b) OR (b.user_id = p_b AND b.blocked_user_id = p_a)
    );
$function$;

-- ---------------------------------------------------------------------------
-- 4. Entitlement helpers: internal only. Every caller is a database function that runs with owner rights
--    (enforce_plan_limit, billing_live_impact, my_entitlements, require_seller_product, billing_expire_products),
--    and no app calls them directly.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.resolve_entitlements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_entitlement(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.entitlement_limit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_for_limit(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_product_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_entitlements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.entitlement_limit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_for_limit(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_product_access(uuid, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. get_profile_counts: posts counted are the public, released ones; connection counts only where the profile's
--    visibility allows the viewer to see them (followers stay public, as on any social profile).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_counts(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'followers',   (SELECT count(*) FROM public.user_follows WHERE following_id = p_user),
    'following',   CASE WHEN public.can_view_profile_extras(p_user) THEN
                     (SELECT count(*) FROM public.user_follows WHERE follower_id = p_user)
                     + (SELECT count(*) FROM public.user_connections WHERE follower_id = p_user AND status = 'accepted')
                   ELSE 0 END,
    'connections', CASE WHEN public.can_view_profile_extras(p_user) THEN
                     (SELECT count(*) FROM public.user_connections WHERE status = 'accepted' AND (follower_id = p_user OR following_id = p_user))
                   ELSE 0 END,
    'posts',       (SELECT count(*) FROM public.posts
                     WHERE author_id = p_user AND COALESCE(audience, 'public') = 'public'
                       AND (scheduled_at IS NULL OR scheduled_at <= now())));
$function$;

-- ---------------------------------------------------------------------------
-- 6. get_profile_activity: only public, released posts count for "last post" and "active recently";
--    the last-post time is hidden when the person turned off their activity status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_activity(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_show boolean;
  v_can boolean := public.can_view_profile_extras(p_user);
  v_post timestamptz;
  v_comment timestamptz;
  c_role text; c_project text; c_at timestamptz;
  p_title text; p_at timestamptz;
  a_title text; a_kind text; a_at timestamptz;
  v_recent boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.blocked_users b
       WHERE (b.user_id = auth.uid() AND b.blocked_user_id = p_user) OR (b.user_id = p_user AND b.blocked_user_id = auth.uid())) THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(show_online_status, true) INTO v_show FROM public.user_settings WHERE user_id = p_user;
  v_show := COALESCE(v_show, true);

  SELECT max(created_at) INTO v_post FROM public.posts
   WHERE author_id = p_user AND page_id IS NULL AND COALESCE(audience, 'public') = 'public'
     AND (scheduled_at IS NULL OR scheduled_at <= now());
  SELECT max(c.created_at) INTO v_comment FROM public.post_comments c
   JOIN public.posts pp ON pp.id = c.post_id
   WHERE c.user_id = p_user AND COALESCE(pp.audience, 'public') = 'public';
  v_recent := GREATEST(COALESCE(v_post, 'epoch'), COALESCE(v_comment, 'epoch')) > now() - interval '7 days';

  IF v_can THEN
    SELECT role, project_title, created_at INTO c_role, c_project, c_at FROM public.project_credits
     WHERE user_id = p_user AND status = 'accepted' ORDER BY created_at DESC LIMIT 1;
    SELECT title, created_at INTO p_title, p_at FROM public.portfolio_items WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1;
    SELECT title, kind, created_at INTO a_title, a_kind, a_at FROM public.profile_awards WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'active_recently', CASE WHEN v_show THEN v_recent ELSE NULL END,
    'last_post_at', CASE WHEN v_show THEN v_post ELSE NULL END,
    'last_credit', CASE WHEN c_at IS NULL THEN NULL ELSE jsonb_build_object('role', c_role, 'project', c_project, 'at', c_at) END,
    'last_portfolio', CASE WHEN p_at IS NULL THEN NULL ELSE jsonb_build_object('title', p_title, 'at', p_at) END,
    'last_award', CASE WHEN a_at IS NULL THEN NULL ELSE jsonb_build_object('title', a_title, 'kind', a_kind, 'at', a_at) END);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. introduction_options: nothing for a person whose profile you cannot see or who has a block with you.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.introduction_options(p_target uuid)
 RETURNS TABLE(id uuid, full_name text, username text, avatar_url text, craft text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.full_name, p.username, p.avatar_url, p.craft
    FROM public.profiles p
   WHERE p.id <> auth.uid() AND p.id <> p_target
     AND public.can_view_profile_extras(p_target)
     AND NOT EXISTS (SELECT 1 FROM public.blocked_users bl
                      WHERE (bl.user_id = auth.uid() AND bl.blocked_user_id = p_target)
                         OR (bl.user_id = p_target AND bl.blocked_user_id = auth.uid()))
     AND EXISTS (SELECT 1 FROM public.user_connections a WHERE a.status = 'accepted'
                  AND ((a.follower_id = auth.uid() AND a.following_id = p.id) OR (a.following_id = auth.uid() AND a.follower_id = p.id)))
     AND EXISTS (SELECT 1 FROM public.user_connections b WHERE b.status = 'accepted'
                  AND ((b.follower_id = p_target AND b.following_id = p.id) OR (b.following_id = p_target AND b.follower_id = p.id)))
     AND COALESCE(p.is_banned, false) = false
   ORDER BY p.full_name
   LIMIT 20;
$function$;

-- ---------------------------------------------------------------------------
-- 8. room_member_counts: counts only for rooms you may see (public rooms, rooms you are in or made).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.room_member_counts(p_room_ids uuid[])
 RETURNS TABLE(room_id uuid, member_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ids.id AS room_id,
         CASE
           WHEN public.is_staff_user(auth.uid()) AND NOT public.has_active_staff_grant(auth.uid(), 'room', ids.id) THEN 0
           WHEN NOT (public.cj_room_is_public(ids.id) OR public.is_room_member(ids.id) OR public.is_room_creator(ids.id, auth.uid())) THEN 0
           ELSE (SELECT count(*)::int FROM public.room_members m WHERE m.room_id = ids.id)
         END AS member_count
    FROM unnest(p_room_ids) AS ids(id);
$function$;

-- ---------------------------------------------------------------------------
-- 9. Ratings: the title / poster / type a rater stores are cleaned, and the trending list shows the most common
--    title for a film instead of whichever rating happened to come first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cq_clean_rating_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.is_current_user_internal(), false) THEN
    RETURN NEW;
  END IF;
  IF NEW.title IS NOT NULL THEN
    NEW.title := left(btrim(NEW.title), 200);
    IF NEW.title = '' THEN NEW.title := NULL; END IF;
  END IF;
  IF NEW.poster_path IS NOT NULL AND NOT (
       (length(NEW.poster_path) <= 201 AND NEW.poster_path ~ '^/[A-Za-z0-9_.-]+$')
    OR (length(NEW.poster_path) <= 500 AND NEW.poster_path ~ '^https://[^[:space:]<>"'']+$')
  ) THEN  -- (a count above 255 inside a pattern is an error in PostgreSQL, see part FJ)
    NEW.poster_path := NULL;
  END IF;
  IF NEW.media_type IS NOT NULL AND NEW.media_type !~ '^[a-z_]{1,20}$' THEN
    NEW.media_type := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cq_clean_rating_meta ON public.user_film_ratings;
CREATE TRIGGER trg_cq_clean_rating_meta
  BEFORE INSERT OR UPDATE ON public.user_film_ratings
  FOR EACH ROW EXECUTE FUNCTION public.cq_clean_rating_meta();

CREATE OR REPLACE FUNCTION public.trending_community_titles(p_days integer DEFAULT 7, p_limit integer DEFAULT 12)
 RETURNS TABLE(tmdb_id integer, platform_cinema_id uuid, media_type text, title text, poster_path text, recent_count bigint, average_rating numeric, weighted_average numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH recent AS (
    SELECT ufr.tmdb_id, ufr.platform_cinema_id, COUNT(*) AS recent_count
      FROM public.user_film_ratings ufr
     WHERE ufr.updated_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 7), 1), 60))
     GROUP BY ufr.tmdb_id, ufr.platform_cinema_id
  ), allt AS (
    SELECT ufr.tmdb_id, ufr.platform_cinema_id, AVG(ufr.rating) AS avg_all, COUNT(*) AS cnt_all,
           mode() WITHIN GROUP (ORDER BY ufr.title) FILTER (WHERE ufr.title IS NOT NULL) AS title,
           mode() WITHIN GROUP (ORDER BY ufr.poster_path) FILTER (WHERE ufr.poster_path IS NOT NULL) AS poster_path,
           mode() WITHIN GROUP (ORDER BY ufr.media_type) FILTER (WHERE ufr.media_type IS NOT NULL) AS media_type
      FROM public.user_film_ratings ufr
      JOIN recent r ON r.tmdb_id IS NOT DISTINCT FROM ufr.tmdb_id AND r.platform_cinema_id IS NOT DISTINCT FROM ufr.platform_cinema_id
     GROUP BY ufr.tmdb_id, ufr.platform_cinema_id
  )
  SELECT a.tmdb_id, a.platform_cinema_id, a.media_type, a.title, a.poster_path, r.recent_count,
         ROUND(a.avg_all::numeric, 1), public.film_weighted_score(a.avg_all::numeric, a.cnt_all)
    FROM allt a
    JOIN recent r ON r.tmdb_id IS NOT DISTINCT FROM a.tmdb_id AND r.platform_cinema_id IS NOT DISTINCT FROM a.platform_cinema_id
   WHERE a.title IS NOT NULL
     AND (a.platform_cinema_id IS NULL OR EXISTS (SELECT 1 FROM public.platform_cinema c WHERE c.id = a.platform_cinema_id AND c.is_published))
   ORDER BY r.recent_count DESC, public.film_weighted_score(a.avg_all::numeric, a.cnt_all) DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
$function$;
