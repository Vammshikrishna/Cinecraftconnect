-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AI – Profile: new features
--   * skill endorsements from connections
--   * Discover filters: skill, gear, language, city
--   * a profile hint based on real numbers (showreel vs profile views)
-- (the one-page crew sheet is built on data that already exists and needs no SQL)
-- Run after part AH, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. skill endorsements ────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id bigint NOT NULL REFERENCES public.user_skills(id) ON DELETE CASCADE,
  endorsed_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endorser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, endorser_id),
  CHECK (endorsed_id <> endorser_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_endorsed ON public.skill_endorsements (endorsed_id);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_endorser ON public.skill_endorsements (endorser_id, created_at DESC);

ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS skill_endorsements_select ON public.skill_endorsements;
CREATE POLICY skill_endorsements_select ON public.skill_endorsements FOR SELECT
  USING (endorser_id = auth.uid() OR public.can_view_profile_extras(endorsed_id));
REVOKE ALL ON public.skill_endorsements FROM PUBLIC;
GRANT SELECT ON public.skill_endorsements TO anon, authenticated;
-- writes only through toggle_skill_endorsement()

-- endorse or take back an endorsement (connections only)
CREATE OR REPLACE FUNCTION public.toggle_skill_endorsement(p_skill_id bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_owner uuid;
  v_skill text;
  v_name text;
  v_deleted integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT user_id, skill_name INTO v_owner, v_skill FROM public.user_skills WHERE id = p_skill_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Skill not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_owner = v_me THEN
    RAISE EXCEPTION 'You cannot endorse your own skills' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.skill_endorsements WHERE skill_id = p_skill_id AND endorser_id = v_me;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_connections WHERE status = 'accepted'
                    AND ((follower_id = v_me AND following_id = v_owner) OR (follower_id = v_owner AND following_id = v_me))) THEN
      RAISE EXCEPTION 'Only connections can endorse a skill' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.skill_endorsements WHERE endorser_id = v_me AND created_at > now() - interval '1 day') >= 40 THEN
      RAISE EXCEPTION 'You have endorsed a lot today. Please try again tomorrow.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.skill_endorsements (skill_id, endorsed_id, endorser_id) VALUES (p_skill_id, v_owner, v_me);

    SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
    IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = v_owner AND trigger_user_id = v_me AND type = 'skill_endorsement'
                    AND message = v_name || ' endorsed you for ' || v_skill AND created_at > now() - interval '7 days') THEN
      INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
      VALUES (v_owner, v_me, 'skill_endorsement', 'New endorsement', v_name || ' endorsed you for ' || v_skill, '/profile?tab=skills', NULL, false);
    END IF;
  END IF;

  RETURN jsonb_build_object('endorsed', v_deleted = 0,
                            'count', (SELECT count(*) FROM public.skill_endorsements WHERE skill_id = p_skill_id));
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_skill_endorsement(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_skill_endorsement(bigint) TO authenticated;

-- counts per skill for one profile, whether I endorsed, and a few endorser names
CREATE OR REPLACE FUNCTION public.skill_endorsement_summary(p_user uuid)
RETURNS TABLE (skill_id bigint, endorsements integer, endorsed_by_me boolean, sample_names text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT e.skill_id, COUNT(*)::integer, bool_or(e.endorser_id = auth.uid()),
         (array_agg(COALESCE(p.full_name, p.username) ORDER BY e.created_at DESC))[1:3]
    FROM public.skill_endorsements e
    JOIN public.profiles p ON p.id = e.endorser_id
   WHERE e.endorsed_id = p_user AND public.can_view_profile_extras(p_user)
   GROUP BY e.skill_id;
$$;
REVOKE ALL ON FUNCTION public.skill_endorsement_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skill_endorsement_summary(uuid) TO anon, authenticated;

-- ── 2. a profile hint from real numbers ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profile_hint()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_has_reel boolean;
  v_with numeric; v_without numeric; v_n_with integer; v_n_without integer;
BEGIN
  IF v_me IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.profile_highlights WHERE user_id = v_me AND showreel_url IS NOT NULL) INTO v_has_reel;
  IF v_has_reel THEN
    RETURN NULL;
  END IF;
  WITH v AS (
    SELECT profile_id, count(*) AS n FROM public.profile_views WHERE created_at > now() - interval '30 days' GROUP BY profile_id
  ), g AS (
    SELECT (h.showreel_url IS NOT NULL) AS has_reel, COALESCE(v.n, 0) AS n
      FROM public.profiles p
      LEFT JOIN public.profile_highlights h ON h.user_id = p.id
      LEFT JOIN v ON v.profile_id = p.id
     WHERE COALESCE(p.account_type, 'fan') <> 'fan' AND COALESCE(p.is_internal, false) = false
  )
  SELECT avg(n) FILTER (WHERE has_reel), avg(n) FILTER (WHERE NOT has_reel),
         count(*) FILTER (WHERE has_reel)::integer, count(*) FILTER (WHERE NOT has_reel)::integer
    INTO v_with, v_without, v_n_with, v_n_without FROM g;
  IF v_n_with >= 20 AND v_n_without >= 20 AND v_without > 0 AND v_with / v_without >= 1.3 THEN
    RETURN 'Profiles with a pinned showreel got ' || round(v_with / v_without, 1)::text || 'x more profile views in the last 30 days.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.profile_hint() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_hint() TO authenticated;

-- ── 3. Discover filters (skill, gear, language, city) ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.suggest_people(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.suggest_people(text, text, text, integer, integer, boolean);
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
  id uuid, username text, full_name text, avatar_url text, cover_image_url text, bio text, location text,
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
    SELECT pr.id, pr.username, pr.full_name, pr.avatar_url, pr.cover_image_url, pr.bio, pr.location, pr.craft, pr.account_type,
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
            OR EXISTS (SELECT 1 FROM public.user_skills s WHERE s.user_id = pr.id AND s.skill_name ILIKE v_term))
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
  SELECT r.id, r.username, r.full_name, r.avatar_url, r.cover_image_url, r.bio, r.location, r.craft, r.account_type, r.is_verified,
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

COMMIT;
