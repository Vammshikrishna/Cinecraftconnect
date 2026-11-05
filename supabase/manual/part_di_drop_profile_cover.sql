-- PART DI - remove the profile cover photo from the database. Run once in the Supabase SQL editor. Safe to run more than once.
--
-- The cover photo was taken out of the web and mobile apps, so nothing reads profiles.cover_image_url any more. This:
--   1. refuses to run if some other function still reads the column (it names it, so nothing breaks half way),
--   2. re-creates the three functions that mention it without the column:
--        suggest_people, network_overview (the extra cover_image_url result column is gone) and
--        my_profile_completeness (no "Add a cover photo" step; its 5 points go to the profile photo, so the total stays 100),
--   3. drops the column. Company page covers (company_pages.cover_image_url) are a different feature and are not touched.
-- Deploy the web and mobile builds from this change first (they no longer ask for the column).

DO $$
DECLARE v_names text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_names
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname NOT IN ('suggest_people', 'network_overview', 'my_profile_completeness')
     AND p.prosrc ILIKE '%cover_image_url%' AND p.prosrc ILIKE '%profiles%' AND p.prosrc NOT ILIKE '%company_pages%';
  IF v_names IS NOT NULL THEN
    RAISE EXCEPTION 'These functions still read profiles.cover_image_url, tell Claude before dropping it: %', v_names;
  END IF;
END $$;

-- 2a. suggest_people (result no longer has cover_image_url)
DROP FUNCTION IF EXISTS public.suggest_people(text, text, text, integer, integer, boolean, text, text, text, text);
CREATE OR REPLACE FUNCTION public.suggest_people(
  p_search text DEFAULT NULL,
  p_craft text DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_available_only boolean DEFAULT false,
  p_skill text DEFAULT NULL,
  p_gear text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_city text DEFAULT NULL
) RETURNS TABLE (
  id uuid, username text, full_name text, avatar_url text, bio text, location text,
  craft text, account_type text, is_verified boolean,
  connection_status text, connection_id uuid, mutual_count integer, suggestion_reason text, availability text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_craft text;
  v_loc text;
  v_viewer_type text;
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_term text;
  v_craft_term text := NULLIF(btrim(COALESCE(p_craft, '')), '');
  v_skill text := NULLIF(btrim(COALESCE(p_skill, '')), '');
  v_gear text := NULLIF(btrim(COALESCE(p_gear, '')), '');
  v_lang text := NULLIF(btrim(COALESCE(p_language, '')), '');
  v_city text := NULLIF(btrim(COALESCE(p_city, '')), '');
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT pr.craft, pr.location, COALESCE(pr.account_type, 'talent') INTO v_craft, v_loc, v_viewer_type FROM public.profiles pr WHERE pr.id = v_me;
  IF v_search IS NOT NULL THEN
    v_term := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;
  IF v_craft_term IS NOT NULL AND lower(v_craft_term) <> 'all' THEN
    v_craft_term := '%' || replace(replace(replace(v_craft_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  ELSE
    v_craft_term := NULL;
  END IF;

  -- escape LIKE wildcards in the four filters
  IF v_skill IS NOT NULL THEN v_skill := '%' || replace(replace(replace(v_skill, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_gear  IS NOT NULL THEN v_gear  := '%' || replace(replace(replace(v_gear,  '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_lang  IS NOT NULL THEN v_lang  := '%' || replace(replace(replace(v_lang,  '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_city  IS NOT NULL THEN v_city  := '%' || replace(replace(replace(v_city,  '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;

  RETURN QUERY
  WITH my AS (
    SELECT CASE WHEN uc.follower_id = v_me THEN uc.following_id ELSE uc.follower_id END AS other
      FROM public.user_connections uc
     WHERE uc.status = 'accepted' AND (uc.follower_id = v_me OR uc.following_id = v_me)
  ), mut AS (
    SELECT x.cid, COUNT(DISTINCT x.via)::integer AS n FROM (
      SELECT uc.following_id AS cid, uc.follower_id AS via FROM public.user_connections uc JOIN my ON my.other = uc.follower_id WHERE uc.status = 'accepted'
      UNION ALL
      SELECT uc.follower_id, uc.following_id FROM public.user_connections uc JOIN my ON my.other = uc.following_id WHERE uc.status = 'accepted'
    ) x WHERE x.cid <> v_me GROUP BY x.cid
  ), my_sp AS (
    SELECT psm.project_space_id AS sid FROM public.project_space_members psm WHERE psm.user_id = v_me
    UNION SELECT ps.id FROM public.project_spaces ps WHERE ps.creator_id = v_me
  ), shared_space AS (
    SELECT psm.user_id AS uid FROM public.project_space_members psm JOIN my_sp ON my_sp.sid = psm.project_space_id WHERE psm.user_id <> v_me
    UNION SELECT ps.creator_id FROM public.project_spaces ps JOIN my_sp ON my_sp.sid = ps.id WHERE ps.creator_id IS NOT NULL AND ps.creator_id <> v_me
  ), shared_page AS (
    SELECT DISTINCT o.user_id AS uid FROM public.company_page_members m JOIN public.company_page_members o ON o.page_id = m.page_id WHERE m.user_id = v_me AND o.user_id <> v_me
  ), cand AS (
    SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.bio, pr.location, pr.craft, pr.account_type,
           COALESCE(pr.is_verified, false) AS is_verified,
           CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility) THEN public.effective_availability_status(av.user_id, av.status, av.booked_until) ELSE NULL END AS availability
      FROM public.profiles pr
      LEFT JOIN public.profile_availability av ON av.user_id = pr.id
     WHERE pr.id <> v_me
       AND COALESCE(pr.is_internal, false) = false
       AND COALESCE(pr.is_banned, false) = false
       AND COALESCE(pr.is_shadowbanned, false) = false
       AND (CASE WHEN v_viewer_type <> 'fan' THEN pr.account_type IS DISTINCT FROM 'fan'
                 ELSE (p_account_type IS NULL OR pr.account_type = p_account_type) END)
       AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                        WHERE (b.user_id = v_me AND b.blocked_user_id = pr.id) OR (b.user_id = pr.id AND b.blocked_user_id = v_me))
       AND NOT EXISTS (SELECT 1 FROM public.network_dismissed d WHERE d.user_id = v_me AND d.dismissed_id = pr.id)
       AND (v_term IS NULL OR pr.full_name ILIKE v_term OR pr.username ILIKE v_term OR pr.craft ILIKE v_term
            OR (public.can_view_profile_extras(pr.id)
                AND EXISTS (SELECT 1 FROM public.user_skills s WHERE s.user_id = pr.id AND s.skill_name ILIKE v_term)))
       AND (v_craft_term IS NULL OR pr.craft ILIKE v_craft_term)
       AND (v_skill IS NULL OR (public.can_view_profile_extras(pr.id)
            AND EXISTS (SELECT 1 FROM public.user_skills s WHERE s.user_id = pr.id AND s.skill_name ILIKE v_skill)))
       AND (v_gear IS NULL OR (public.can_view_profile_extras(pr.id)
            AND EXISTS (SELECT 1 FROM public.profile_highlights h WHERE h.user_id = pr.id AND EXISTS (SELECT 1 FROM unnest(h.gear) g WHERE g ILIKE v_gear))))
       AND (v_lang IS NULL OR (public.can_view_profile_extras(pr.id)
            AND EXISTS (SELECT 1 FROM public.profile_highlights h WHERE h.user_id = pr.id AND EXISTS (SELECT 1 FROM unnest(h.languages) l WHERE l ILIKE v_lang))))
       AND (v_city IS NULL OR pr.location ILIKE v_city
            OR EXISTS (SELECT 1 FROM public.profile_availability a WHERE a.user_id = pr.id AND public.can_see_availability(a.user_id, a.visibility)
                        AND EXISTS (SELECT 1 FROM unnest(a.cities) c WHERE c ILIKE v_city)))
       AND (NOT COALESCE(p_available_only, false)
            OR (av.user_id IS NOT NULL AND public.effective_availability_status(av.user_id, av.status, av.booked_until) = 'open' AND public.can_see_availability(av.user_id, av.visibility)))
  ), ranked AS (
    SELECT c.*, rel.cid AS connection_id,
           CASE WHEN rel.status = 'accepted' THEN 'connected'
                WHEN rel.status = 'pending' AND rel.follower_id = v_me THEN 'pending_sent'
                WHEN rel.status = 'pending' THEN 'pending_received'
                ELSE 'none' END AS connection_status,
           COALESCE(m.n, 0) AS mutual_count,
           EXISTS (SELECT 1 FROM shared_space s WHERE s.uid = c.id) AS same_project,
           EXISTS (SELECT 1 FROM shared_page s WHERE s.uid = c.id) AS same_page,
           (v_craft IS NOT NULL AND c.craft IS NOT NULL AND lower(c.craft) = lower(v_craft)) AS same_craft,
           (v_loc IS NOT NULL AND c.location IS NOT NULL AND lower(c.location) = lower(v_loc)) AS same_loc
      FROM cand c
      LEFT JOIN mut m ON m.cid = c.id
      LEFT JOIN LATERAL (
        SELECT uc.id AS cid, uc.status, uc.follower_id FROM public.user_connections uc
         WHERE (uc.follower_id = v_me AND uc.following_id = c.id) OR (uc.follower_id = c.id AND uc.following_id = v_me)
         LIMIT 1) rel ON true
  )
  SELECT r.id, r.username, r.full_name, r.avatar_url, r.bio, r.location, r.craft, r.account_type, r.is_verified,
         r.connection_status, r.connection_id, r.mutual_count,
         CASE WHEN r.connection_status = 'connected' THEN 'Connected'
              WHEN r.connection_status IN ('pending_sent', 'pending_received') THEN 'Pending connection'
              WHEN r.mutual_count > 0 THEN r.mutual_count::text || (CASE WHEN r.mutual_count = 1 THEN ' mutual connection' ELSE ' mutual connections' END)
              WHEN r.same_project THEN 'Shared a project with you'
              WHEN r.same_page THEN 'On the same company page'
              WHEN r.same_craft THEN 'Same craft as you'
              WHEN r.same_loc THEN 'Near you'
              ELSE 'Suggested for you' END,
         r.availability
    FROM ranked r
   ORDER BY CASE r.connection_status WHEN 'none' THEN 0 WHEN 'pending_received' THEN 1 WHEN 'pending_sent' THEN 2 ELSE 3 END,
            (r.mutual_count * 3 + (CASE WHEN r.same_project THEN 6 ELSE 0 END) + (CASE WHEN r.same_page THEN 3 ELSE 0 END)
             + (CASE WHEN r.same_craft THEN 4 ELSE 0 END) + (CASE WHEN r.same_loc THEN 2 ELSE 0 END)
             + (CASE WHEN r.is_verified THEN 1 ELSE 0 END) + (CASE WHEN r.availability = 'open' THEN 1 ELSE 0 END)) DESC,
            md5(r.id::text || current_date::text)
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean, text, text, text, text) TO authenticated;

-- 2b. network_overview
DROP FUNCTION IF EXISTS public.network_overview();
CREATE OR REPLACE FUNCTION public.network_overview()
RETURNS TABLE (
  id uuid, follower_id uuid, following_id uuid, status text, created_at timestamptz, note text, ignored_at timestamptz,
  other_id uuid, full_name text, username text, avatar_url text, bio text, location text,
  craft text, account_type text, is_verified boolean, mutual_count integer,
  my_note text, my_tags text[], availability text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  RETURN QUERY
  WITH mine AS (
    SELECT uc.id, uc.follower_id, uc.following_id, uc.status, uc.created_at, uc.note,
           (SELECT ci.ignored_at FROM public.connection_ignores ci WHERE ci.connection_id = uc.id AND uc.following_id = v_me) AS ignored_at,   -- kept in a private table; only the person who received the request sees it
           CASE WHEN uc.follower_id = v_me THEN uc.following_id ELSE uc.follower_id END AS other
      FROM public.user_connections uc
     WHERE uc.follower_id = v_me OR uc.following_id = v_me
  ), my_conn AS (
    SELECT m.other FROM mine m WHERE m.status = 'accepted'
  ), mut AS (
    SELECT x.cid, COUNT(DISTINCT x.via)::integer AS n FROM (
      SELECT uc.following_id AS cid, uc.follower_id AS via FROM public.user_connections uc JOIN my_conn ON my_conn.other = uc.follower_id WHERE uc.status = 'accepted'
      UNION ALL
      SELECT uc.follower_id, uc.following_id FROM public.user_connections uc JOIN my_conn ON my_conn.other = uc.following_id WHERE uc.status = 'accepted'
    ) x WHERE x.cid <> v_me GROUP BY x.cid
  )
  SELECT m.id, m.follower_id, m.following_id, m.status, m.created_at, m.note, m.ignored_at,
         p.id, p.full_name, p.username, p.avatar_url, p.bio, p.location, p.craft, p.account_type,
         COALESCE(p.is_verified, false), COALESCE(mu.n, 0),
         cn.note, COALESCE(cn.tags, '{}'),
         CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility) THEN public.effective_availability_status(av.user_id, av.status, av.booked_until) ELSE NULL END
    FROM mine m
    JOIN public.profiles p ON p.id = m.other
    LEFT JOIN mut mu ON mu.cid = m.other
    LEFT JOIN public.connection_notes cn ON cn.owner_id = v_me AND cn.other_id = m.other
    LEFT JOIN public.profile_availability av ON av.user_id = m.other
   WHERE COALESCE(p.is_banned, false) = false
   ORDER BY m.created_at DESC
   LIMIT 1000;
END;
$$;
REVOKE ALL ON FUNCTION public.network_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_overview() TO authenticated;

-- 2c. profile completeness
CREATE OR REPLACE FUNCTION public.my_profile_completeness()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  p public.profiles%ROWTYPE;
  v_fan boolean;
  v_items jsonb := '[]'::jsonb;
  v_score integer := 0;
  v_has_link boolean;

BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO p FROM public.profiles WHERE id = v_me;
  v_fan := COALESCE(p.account_type, 'fan') = 'fan';
  SELECT (COALESCE(btrim(p.website), '') <> '')
      OR EXISTS (SELECT 1 FROM public.profile_extras e WHERE e.user_id = v_me
                  AND (COALESCE(btrim(e.instagram_url), '') <> '' OR COALESCE(btrim(e.youtube_url), '') <> '' OR e.social_links <> '{}'::jsonb))
    INTO v_has_link;

  -- each check: key, label, points, done
  WITH checks(key, label, points, done) AS (
    SELECT * FROM (VALUES
      ('avatar',     'Add a profile photo',                      CASE WHEN v_fan THEN 40 ELSE 15 END, COALESCE(btrim(p.avatar_url), '') <> ''),
      ('bio',        'Write a bio (at least 40 characters)',     CASE WHEN v_fan THEN 30 ELSE 10 END, char_length(COALESCE(btrim(p.bio), '')) >= 40),
      ('location',   'Add your location',                        CASE WHEN v_fan THEN 30 ELSE 5 END,  COALESCE(btrim(p.location), '') <> '')
    ) v
    UNION ALL
    SELECT * FROM (VALUES
      ('craft',      'Tell people your craft',                   10, COALESCE(btrim(p.craft), '') <> ''),
      ('skills',     'Add at least 3 skills',                    10, (SELECT count(*) FROM public.user_skills s WHERE s.user_id = v_me) >= 3),
      ('experience', 'Add your experience',                      10, EXISTS (SELECT 1 FROM public.user_experience x WHERE x.user_id = v_me)),
      ('portfolio',  'Upload a portfolio piece',                 10, EXISTS (SELECT 1 FROM public.portfolio_items i WHERE i.user_id = v_me)),
      ('credits',    'Get a confirmed credit',                   10, EXISTS (SELECT 1 FROM public.project_credits c WHERE c.user_id = v_me AND c.status = 'accepted')),
      ('showreel',   'Pin a showreel',                           10, EXISTS (SELECT 1 FROM public.profile_highlights h WHERE h.user_id = v_me AND h.showreel_url IS NOT NULL)),
      ('link',       'Add a website or social link',             5,  v_has_link),
      ('availability','Set your availability',                   5,  EXISTS (SELECT 1 FROM public.profile_availability a WHERE a.user_id = v_me))
    ) w WHERE NOT v_fan
  )
  SELECT COALESCE(sum(points) FILTER (WHERE done), 0)::integer,
         COALESCE(jsonb_agg(jsonb_build_object('key', key, 'label', label, 'points', points) ORDER BY points DESC) FILTER (WHERE NOT done), '[]'::jsonb)
    INTO v_score, v_items
    FROM checks;

  RETURN jsonb_build_object('score', LEAST(v_score, 100), 'missing', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.my_profile_completeness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_completeness() TO authenticated;

-- 3. the column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cover_image_url;
