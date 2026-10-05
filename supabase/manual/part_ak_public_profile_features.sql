-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AK – Public profile: missing features
--   * "How you're connected": mutual connections, shared project spaces, shared company pages
--   * a recent-activity strip (only dates and titles, never post text) and an "active this week" hint
--     (hidden when the person turned off "show online status")
--   * "can I message this person?" so a Message button can show for people you are not connected to
-- Run after part AJ, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. how am I connected to this person? ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_connection_context(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_mutuals jsonb;
  v_mutual_count integer;
  v_projects jsonb;
  v_pages jsonb;
BEGIN
  IF v_me IS NULL OR p_user IS NULL OR v_me = p_user THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id = p_user) OR (b.user_id = p_user AND b.blocked_user_id = v_me)) THEN
    RETURN NULL;
  END IF;

  WITH mine AS (
    SELECT CASE WHEN follower_id = v_me THEN following_id ELSE follower_id END AS other
      FROM public.user_connections WHERE status = 'accepted' AND (follower_id = v_me OR following_id = v_me)
  ), theirs AS (
    SELECT CASE WHEN follower_id = p_user THEN following_id ELSE follower_id END AS other
      FROM public.user_connections WHERE status = 'accepted' AND (follower_id = p_user OR following_id = p_user)
  ), both_ AS (
    SELECT m.other FROM mine m JOIN theirs t ON t.other = m.other
  )
  SELECT (SELECT count(*) FROM both_)::integer,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', COALESCE(p.full_name, p.username), 'avatar_url', p.avatar_url))
                     FROM (SELECT p.* FROM both_ b JOIN public.profiles p ON p.id = b.other
                            WHERE COALESCE(p.is_banned, false) = false ORDER BY p.full_name LIMIT 5) p), '[]'::jsonb)
    INTO v_mutual_count, v_mutuals;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ps.id, 'name', ps.name)), '[]'::jsonb) INTO v_projects
    FROM (SELECT DISTINCT s.id, s.name FROM public.project_spaces s
           WHERE (s.creator_id = v_me OR EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = s.id AND m.user_id = v_me))
             AND (s.creator_id = p_user OR EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = s.id AND m.user_id = p_user))
           LIMIT 5) ps;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', cp.id, 'name', cp.name, 'slug', cp.slug)), '[]'::jsonb) INTO v_pages
    FROM (SELECT DISTINCT c.id, c.name, c.slug FROM public.company_pages c
           WHERE EXISTS (SELECT 1 FROM public.company_page_members m WHERE m.page_id = c.id AND m.user_id = v_me)
             AND EXISTS (SELECT 1 FROM public.company_page_members m WHERE m.page_id = c.id AND m.user_id = p_user)
           LIMIT 5) cp;

  RETURN jsonb_build_object('mutual_count', v_mutual_count, 'mutuals', v_mutuals, 'shared_projects', v_projects, 'shared_pages', v_pages);
END;
$$;
REVOKE ALL ON FUNCTION public.get_connection_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_connection_context(uuid) TO authenticated;

-- ── 2. recent activity ───────────────────────────────────────────────────────────────────────────────────────────
-- dates and titles only. "active_recently" is hidden (null) when the person turned off "show online status".
CREATE OR REPLACE FUNCTION public.get_profile_activity(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

  SELECT max(created_at) INTO v_post FROM public.posts WHERE author_id = p_user AND page_id IS NULL;
  SELECT max(created_at) INTO v_comment FROM public.post_comments WHERE user_id = p_user;
  v_recent := GREATEST(COALESCE(v_post, 'epoch'), COALESCE(v_comment, 'epoch')) > now() - interval '7 days';

  IF v_can THEN
    SELECT role, project_title, created_at INTO c_role, c_project, c_at FROM public.project_credits
     WHERE user_id = p_user AND status = 'accepted' ORDER BY created_at DESC LIMIT 1;
    SELECT title, created_at INTO p_title, p_at FROM public.portfolio_items WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1;
    SELECT title, kind, created_at INTO a_title, a_kind, a_at FROM public.profile_awards WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'active_recently', CASE WHEN v_show THEN v_recent ELSE NULL END,
    'last_post_at', v_post,
    'last_credit', CASE WHEN c_at IS NULL THEN NULL ELSE jsonb_build_object('role', c_role, 'project', c_project, 'at', c_at) END,
    'last_portfolio', CASE WHEN p_at IS NULL THEN NULL ELSE jsonb_build_object('title', p_title, 'at', p_at) END,
    'last_award', CASE WHEN a_at IS NULL THEN NULL ELSE jsonb_build_object('title', a_title, 'kind', a_kind, 'at', a_at) END);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_activity(uuid) TO anon, authenticated;

-- ── 3. can I message this person? (the same rules the database enforces on send) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_message_user(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pref text;
BEGIN
  IF v_me IS NULL OR p_user IS NULL OR v_me = p_user THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id = p_user) OR (b.user_id = p_user AND b.blocked_user_id = v_me)) THEN
    RETURN false;
  END IF;
  SELECT allow_messages_from INTO v_pref FROM public.user_settings WHERE user_id = p_user;
  IF v_pref IS NULL OR v_pref = 'everyone' THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.direct_messages WHERE sender_id = p_user AND receiver_id = v_me) THEN
    RETURN true;
  END IF;
  IF v_pref = 'connections' THEN
    RETURN EXISTS (SELECT 1 FROM public.user_connections WHERE status = 'accepted'
                    AND ((follower_id = v_me AND following_id = p_user) OR (follower_id = p_user AND following_id = v_me)));
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.can_message_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message_user(uuid) TO authenticated;

COMMIT;
