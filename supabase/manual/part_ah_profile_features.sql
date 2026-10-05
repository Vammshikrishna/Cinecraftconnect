-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AH – Profile: missing features
--   * profile completeness (score + what to do next)
--   * highlights: pinned showreel, languages, gear, a downloadable CV, and which sections to hide
--   * awards, festival selections and press
--   * one availability: the headline status now follows the availability calendar (booked dates win)
-- Run after part AG, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. highlights ────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_highlights (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  showreel_url text,
  showreel_title text,
  languages text[] NOT NULL DEFAULT '{}',
  gear text[] NOT NULL DEFAULT '{}',
  cv_path text,                                   -- 'resumes:<user id>/<file>' (private bucket)
  cv_public boolean NOT NULL DEFAULT false,
  hidden_sections text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_highlights_select ON public.profile_highlights;
DROP POLICY IF EXISTS profile_highlights_insert ON public.profile_highlights;
DROP POLICY IF EXISTS profile_highlights_update ON public.profile_highlights;
DROP POLICY IF EXISTS profile_highlights_delete ON public.profile_highlights;
CREATE POLICY profile_highlights_select ON public.profile_highlights FOR SELECT USING (public.can_view_profile_extras(user_id));
CREATE POLICY profile_highlights_insert ON public.profile_highlights FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_highlights_update ON public.profile_highlights FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_highlights_delete ON public.profile_highlights FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.profile_highlights FROM PUBLIC;
GRANT SELECT ON public.profile_highlights TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_highlights TO authenticated;

CREATE OR REPLACE FUNCTION public.clean_text_list(p_in text[], p_max_items integer, p_max_len integer)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(t), '{}') FROM (
    SELECT DISTINCT left(btrim(x), p_max_len) AS t FROM unnest(COALESCE(p_in, '{}')) AS x WHERE btrim(x) <> '' LIMIT p_max_items) q;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_highlights()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF COALESCE((SELECT account_type FROM public.profiles WHERE id = NEW.user_id), 'fan') = 'fan' THEN
    RAISE EXCEPTION 'Highlights are for creators and studios' USING ERRCODE = 'P0001';
  END IF;
  NEW.showreel_url := NULLIF(left(btrim(COALESCE(NEW.showreel_url, '')), 300), '');
  IF NEW.showreel_url IS NOT NULL AND NEW.showreel_url !~* '^https://[^\s]+$' THEN
    RAISE EXCEPTION 'The showreel link must start with https://' USING ERRCODE = 'P0001';
  END IF;
  NEW.showreel_title := NULLIF(left(btrim(COALESCE(NEW.showreel_title, '')), 100), '');
  NEW.languages := public.clean_text_list(NEW.languages, 15, 40);
  NEW.gear := public.clean_text_list(NEW.gear, 25, 60);
  IF NEW.cv_path IS NOT NULL AND NEW.cv_path NOT LIKE 'resumes:' || NEW.user_id::text || '/%' THEN
    RAISE EXCEPTION 'Invalid CV file' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(array_agg(s), '{}') INTO NEW.hidden_sections
    FROM (SELECT DISTINCT x AS s FROM unnest(COALESCE(NEW.hidden_sections, '{}')) AS x
           WHERE x IN ('posts', 'portfolio', 'projects', 'announcements', 'credits', 'skills', 'experience', 'awards')) q;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_highlights ON public.profile_highlights;
CREATE TRIGGER trg_guard_profile_highlights BEFORE INSERT OR UPDATE ON public.profile_highlights
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_highlights();

-- the CV file: the owner always, other people only when the owner made it public and they may see the profile
DROP POLICY IF EXISTS "Resumes read public profile CV" ON storage.objects;
CREATE POLICY "Resumes read public profile CV" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND EXISTS (SELECT 1 FROM public.profile_highlights h
                 WHERE h.cv_path = 'resumes:' || name AND h.cv_public AND public.can_view_profile_extras(h.user_id))
  );

-- ── 2. awards, festivals and press ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('award', 'festival', 'press')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  org text CHECK (org IS NULL OR char_length(org) <= 120),
  year integer CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  url text CHECK (url IS NULL OR char_length(url) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_awards_user ON public.profile_awards (user_id, year DESC NULLS LAST);
ALTER TABLE public.profile_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_awards_select ON public.profile_awards;
DROP POLICY IF EXISTS profile_awards_insert ON public.profile_awards;
DROP POLICY IF EXISTS profile_awards_update ON public.profile_awards;
DROP POLICY IF EXISTS profile_awards_delete ON public.profile_awards;
CREATE POLICY profile_awards_select ON public.profile_awards FOR SELECT USING (public.can_view_profile_extras(user_id));
CREATE POLICY profile_awards_insert ON public.profile_awards FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_awards_update ON public.profile_awards FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profile_awards_delete ON public.profile_awards FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.profile_awards FROM PUBLIC;
GRANT SELECT ON public.profile_awards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_awards TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF COALESCE((SELECT account_type FROM public.profiles WHERE id = NEW.user_id), 'fan') = 'fan' THEN
    RAISE EXCEPTION 'Awards and press are for creators and studios' USING ERRCODE = 'P0001';
  END IF;
  NEW.title := btrim(NEW.title);
  NEW.org := NULLIF(left(btrim(COALESCE(NEW.org, '')), 120), '');
  NEW.url := NULLIF(left(btrim(COALESCE(NEW.url, '')), 300), '');
  IF NEW.url IS NOT NULL AND NEW.url !~* '^https://[^\s]+$' THEN
    RAISE EXCEPTION 'The link must start with https://' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    IF (SELECT count(*) FROM public.profile_awards WHERE user_id = NEW.user_id) >= 40 THEN
      RAISE EXCEPTION 'You can list up to 40 awards and press items' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_award ON public.profile_awards;
CREATE TRIGGER trg_guard_profile_award BEFORE INSERT OR UPDATE ON public.profile_awards
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_award();

-- ── 3. profile completeness ──────────────────────────────────────────────────────────────────────────────────────
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
      ('avatar',     'Add a profile photo',                      CASE WHEN v_fan THEN 40 ELSE 10 END, COALESCE(btrim(p.avatar_url), '') <> ''),
      ('bio',        'Write a bio (at least 40 characters)',     CASE WHEN v_fan THEN 30 ELSE 10 END, char_length(COALESCE(btrim(p.bio), '')) >= 40),
      ('location',   'Add your location',                        CASE WHEN v_fan THEN 30 ELSE 5 END,  COALESCE(btrim(p.location), '') <> '')
    ) v
    UNION ALL
    SELECT * FROM (VALUES
      ('cover',      'Add a cover photo',                        5,  COALESCE(btrim(p.cover_image_url), '') <> ''),
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

-- ── 4. one availability: booked days in the calendar (or on a project schedule) win over "Open to work" ───────────
CREATE OR REPLACE FUNCTION public.effective_availability_status(p_user uuid, p_status text, p_booked_until date)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN p_status = 'not_looking' THEN 'not_looking'
    WHEN EXISTS (SELECT 1 FROM public.global_user_availability_view g
                  WHERE g.user_id = p_user AND g.status = 'booked' AND current_date BETWEEN g.start_date AND g.end_date) THEN 'booked'
    WHEN p_status = 'booked' AND p_booked_until IS NOT NULL AND p_booked_until < current_date THEN 'open'
    ELSE p_status END;
$$;

-- one person's availability as the viewer may see it (null when it is hidden from them)
CREATE OR REPLACE FUNCTION public.get_profile_availability(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'status', public.effective_availability_status(av.user_id, av.status, av.booked_until),
    'booked_until', COALESCE(
        (SELECT max(g.end_date) FROM public.global_user_availability_view g
          WHERE g.user_id = av.user_id AND g.status = 'booked' AND current_date BETWEEN g.start_date AND g.end_date),
        av.booked_until),
    'rate_min', av.rate_min, 'rate_max', av.rate_max, 'rate_currency', av.rate_currency, 'cities', av.cities, 'note', av.note)
  FROM public.profile_availability av
  WHERE av.user_id = p_user AND public.can_see_availability(av.user_id, av.visibility);
$$;
REVOKE ALL ON FUNCTION public.get_profile_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_availability(uuid) TO anon, authenticated;

-- ── 5. network lists and Discover now use the effective availability (calendar-aware) ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.network_overview();
CREATE OR REPLACE FUNCTION public.network_overview()
RETURNS TABLE (
  id uuid, follower_id uuid, following_id uuid, status text, created_at timestamptz, note text, ignored_at timestamptz,
  other_id uuid, full_name text, username text, avatar_url text, cover_image_url text, bio text, location text,
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
    SELECT uc.id, uc.follower_id, uc.following_id, uc.status, uc.created_at, uc.note, uc.ignored_at,
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
         p.id, p.full_name, p.username, p.avatar_url, p.cover_image_url, p.bio, p.location, p.craft, p.account_type,
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

-- (suggest_people, same change) ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.suggest_people(text, text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.suggest_people(
  p_search text DEFAULT NULL,
  p_craft text DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_available_only boolean DEFAULT false
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
REVOKE ALL ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_people(text, text, text, integer, integer, boolean) TO authenticated;

COMMIT;
