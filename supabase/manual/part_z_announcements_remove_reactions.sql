-- PART Z: announcements — remove reactions and comments. Run AFTER part Y. Safe to re-run.
BEGIN;
-- Announcements: remove reactions and comments (they were not wanted). Run AFTER part Y, once. Safe to re-run.
-- The list function is replaced first so nothing depends on the tables when they are dropped.

DROP FUNCTION IF EXISTS public.list_announcements(integer, timestamptz, text, text, text);
DROP FUNCTION IF EXISTS public.list_announcements(integer, timestamptz, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.list_announcements(
  p_limit integer DEFAULT 20,
  p_before timestamptz DEFAULT NULL,
  p_filter text DEFAULT 'all',          -- all | following | mine | pages
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page_id uuid DEFAULT NULL           -- only this company page's announcements
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_seen timestamptz;
  v_term text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_like text;
  v_internal boolean := COALESCE(public.is_current_user_internal(), false);
  v_rows jsonb;
BEGIN
  PERFORM public.notify_due_announcements();
  IF v_uid IS NOT NULL THEN
    SELECT seen_at INTO v_seen FROM announcement_seen WHERE user_id = v_uid;
  END IF;
  IF v_term IS NOT NULL THEN
    v_like := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  SELECT COALESCE(jsonb_agg(row_json ORDER BY pinned_now DESC, posted_at DESC), '[]'::jsonb) INTO v_rows FROM (
    SELECT pinned_now, posted_at, row_json FROM (

      -- user and company announcements
      SELECT
        (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())) AS pinned_now,
        a.posted_at,
        jsonb_build_object(
          'id', a.id, 'title', a.title, 'content', a.content, 'posted_at', a.posted_at,
          'author_id', a.author_id, 'publisher_page_id', a.publisher_page_id,
          'category', a.category, 'image_url', a.image_url, 'audience', a.audience,
          'is_pinned', (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())),
          'expires_at', a.expires_at, 'edited_at', a.edited_at, 'view_count', a.view_count,
          'scheduled', a.posted_at > now(),
          'expired', (a.expires_at IS NOT NULL AND a.expires_at <= now()),
          'is_system', false,
          'can_manage', (v_uid IS NOT NULL AND (a.author_id = v_uid OR v_internal
                         OR (a.publisher_page_id IS NOT NULL AND public.is_page_manager(a.publisher_page_id, v_uid)))),
          'unread', (v_uid IS NOT NULL AND a.author_id IS DISTINCT FROM v_uid AND a.posted_at <= now()
                     AND a.posted_at > COALESCE(v_seen, now() - interval '14 days')),
          'profiles', CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name, 'username', pr.username, 'avatar_url', pr.avatar_url) END,
          'company_pages', CASE WHEN cp.id IS NOT NULL THEN jsonb_build_object('id', cp.id, 'name', cp.name, 'logo_url', cp.logo_url, 'slug', cp.slug, 'is_verified', cp.is_verified) END
        ) AS row_json
      FROM announcements a
      LEFT JOIN profiles pr ON pr.id = a.author_id
      LEFT JOIN company_pages cp ON cp.id = a.publisher_page_id
      WHERE (p_category IS NULL OR a.category = p_category)
        AND (p_page_id IS NULL OR a.publisher_page_id = p_page_id)
        AND (v_like IS NULL OR a.title ILIKE v_like OR a.content ILIKE v_like OR cp.name ILIKE v_like)
        AND (CASE p_filter
               WHEN 'following' THEN v_uid IS NOT NULL AND (
                    (a.publisher_page_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_page_followers f WHERE f.page_id = a.publisher_page_id AND f.user_id = v_uid))
                 OR (a.publisher_page_id IS NULL AND EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = v_uid AND uf.following_id = a.author_id)))
               WHEN 'mine' THEN v_uid IS NOT NULL AND (a.author_id = v_uid OR (a.publisher_page_id IS NOT NULL AND public.is_page_manager(a.publisher_page_id, v_uid)))
               WHEN 'pages' THEN a.publisher_page_id IS NOT NULL
               ELSE true END)
        AND (
          (p_before IS NULL AND (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())))
          OR (NOT (a.is_pinned AND (a.pinned_until IS NULL OR a.pinned_until > now())) AND (p_before IS NULL OR a.posted_at < p_before))
        )

      UNION ALL

      -- platform broadcasts (signed-in people only; shown in the main list, not in a company's or a filtered view)
      SELECT
        false AS pinned_now,
        s.created_at AS posted_at,
        jsonb_build_object(
          'id', s.id, 'title', s.title, 'content', s.body, 'posted_at', s.created_at,
          'author_id', s.created_by, 'publisher_page_id', NULL,
          'category', 'news', 'image_url', s.image_url, 'audience', 'everyone',
          'is_pinned', false, 'expires_at', NULL, 'edited_at', NULL, 'view_count', 0,
          'scheduled', false, 'expired', false, 'is_system', true, 'can_manage', false,
          'action_url', s.action_url,
          'unread', (v_uid IS NOT NULL AND s.created_at > COALESCE(v_seen, now() - interval '14 days')),
          'profiles', NULL, 'company_pages', NULL
        ) AS row_json
      FROM system_announcements s
      WHERE v_uid IS NOT NULL
        AND p_page_id IS NULL
        AND p_filter = 'all'
        AND (p_category IS NULL OR p_category = 'news')
        AND (v_like IS NULL OR s.title ILIKE v_like OR s.body ILIKE v_like)
        AND (p_before IS NULL OR s.created_at < p_before)

    ) u
    ORDER BY pinned_now DESC, posted_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  ) q;

  RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_announcements(integer, timestamptz, text, text, text, uuid) TO anon, authenticated;

-- the list (which runs as the caller) triggers due notifications, so the callers must be allowed to run this
GRANT EXECUTE ON FUNCTION public.notify_due_announcements() TO anon, authenticated;

-- reactions and comments: tables, the comment trigger and its function
DROP TABLE IF EXISTS public.announcement_reactions;
DROP TABLE IF EXISTS public.announcement_comments;          -- its trigger goes with it
DROP FUNCTION IF EXISTS public.announcement_comments_limit();

COMMIT;
