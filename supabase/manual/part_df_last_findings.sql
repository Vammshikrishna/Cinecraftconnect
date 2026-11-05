-- PART DF - the last small audit findings (48, 59, 68, plus the staff-grant key follow-up). Safe to run more than once.
--
-- 1. (68) People search matched the free text against the skills of members whose profile hides them. It now only looks at
--    a member's skills when you are allowed to see that member's extras (the rule the dedicated skill filter already used).
-- 2. (48) A first, mild automatic match opened a case; editing the content into something worse was thrown away because a case
--    was already open, so the worse content stayed visible until staff got to the old case. A worse match (higher priority, or
--    a newly required hide) now opens a fresh case; only equal-or-milder repeats are skipped.
-- 3. (59) A seller could delete a listing or a vendor profile and the cascade wiped out bookings and quotes the other side was
--    relying on. Deleting is now refused while a booking is pending / confirmed and not over, or a quote is requested / quoted /
--    accepted. (Account deletion and staff actions are not blocked.)
-- 4. (staff grants) When a staff access grant ends (expires, is deleted or is purged), the chat is flagged for a new key so the
--    staff member's copy no longer opens new messages; the next member to open the chat does the rotation (parts CV / CX).
--    If pg_cron is installed, the purge also runs every 10 minutes.

-- ---------------------------------------------------------------------------
-- 1. suggest_people (live signature, from part_ai) with the visibility check in the free-text branch
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. _auto_case: a worse match is not discarded because a milder case is already open
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._auto_case(p_type text, p_target text, p_reason text, p_severity text, p_hide boolean, p_source text, p_rule text, p_details text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open_rank integer;
  v_open_hide boolean;
BEGIN
  SELECT max(public.report_priority_rank(priority)), COALESCE(bool_or('hide' = ANY (COALESCE(auto_actions, ARRAY[]::text[]))), false)
    INTO v_open_rank, v_open_hide
    FROM public.content_reports
   WHERE target_type = p_type AND target_id = p_target AND source <> 'user' AND status IN ('pending', 'reviewing');

  IF v_open_rank IS NOT NULL
     AND public.report_priority_rank(COALESCE(p_severity, 'medium')) <= v_open_rank
     AND (NOT COALESCE(p_hide, false) OR v_open_hide) THEN
    RETURN;  -- an equal or more serious case is already open
  END IF;

  INSERT INTO public.content_reports (reported_by, target_type, target_id, reason, details, priority, status, source, auto_rule, auto_actions)
  VALUES (NULL, p_type, p_target, p_reason, left(p_details, 500), COALESCE(p_severity, 'medium'), 'pending', p_source, left(p_rule, 300),
          CASE WHEN p_hide THEN ARRAY['hide']::text[] ELSE ARRAY[]::text[] END);
END;
$$;
REVOKE ALL ON FUNCTION public._auto_case(text, text, text, text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. no deleting a listing / vendor profile out from under a live booking or quote
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.df_guard_listing_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_current_user_internal() THEN
    RETURN OLD;  -- account deletion and staff actions are not blocked
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_bookings b
              WHERE b.listing_id = OLD.id AND b.status IN ('pending', 'confirmed') AND b.end_date >= current_date) THEN
    RAISE EXCEPTION 'This listing has open bookings. Cancel or complete them before deleting it.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS a_df_guard_listing_delete ON public.marketplace_listings;
CREATE TRIGGER a_df_guard_listing_delete BEFORE DELETE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.df_guard_listing_delete();

CREATE OR REPLACE FUNCTION public.df_guard_vendor_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_current_user_internal() THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendor_quotes q
              WHERE q.vendor_id = OLD.id AND q.status IN ('requested', 'quoted', 'accepted')) THEN
    RAISE EXCEPTION 'This vendor profile has open quote requests or accepted quotes. Close them before deleting it.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS a_df_guard_vendor_delete ON public.vendors;
CREATE TRIGGER a_df_guard_vendor_delete BEFORE DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.df_guard_vendor_delete();

-- ---------------------------------------------------------------------------
-- 4. an ended staff access grant flags the chat for a new key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.df_flag_key_rotation_on_grant_end()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF OLD.target_type NOT IN ('room', 'project_space') OR OLD.target_id !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN OLD;
  END IF;
  v_id := OLD.target_id::uuid;
  IF EXISTS (SELECT 1 FROM public.group_keys WHERE target_type = OLD.target_type AND target_id = v_id) THEN
    INSERT INTO public.group_key_state (target_type, target_id, epoch, needs_rotation, updated_at)
    VALUES (OLD.target_type, v_id, 1, true, now())
    ON CONFLICT (target_type, target_id) DO UPDATE SET needs_rotation = true, updated_at = now();
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS df_grant_end_rotation ON public.space_access_grants;
CREATE TRIGGER df_grant_end_rotation AFTER DELETE ON public.space_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.df_flag_key_rotation_on_grant_end();

-- run the purge every 10 minutes when pg_cron is available (otherwise the chat key is still renewed lazily, as before)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-expired-staff-access', '*/10 * * * *', 'SELECT public.purge_expired_staff_access()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule the purge job: %', SQLERRM;
END $$;
