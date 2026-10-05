-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AJ – Public profile: bug fixes
--   * counts are real counts (the page used to download every follow row, which the API caps at 1,000)
--   * one function says what the viewer may see: ok / private / unavailable (banned, or they blocked me) /
--     blocked by me, so the page can show the right state instead of an empty-looking profile
--   * one function returns my relationship with a person (connection + follow) in a single call
--   * links on profiles must be http(s) links or plain domains (other schemes such as tel: or javascript: are refused)
-- Run after part AI, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. counts ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profile_counts(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'followers',   (SELECT count(*) FROM public.user_follows WHERE following_id = p_user),
    'following',   (SELECT count(*) FROM public.user_follows WHERE follower_id = p_user)
                 + (SELECT count(*) FROM public.user_connections WHERE follower_id = p_user AND status = 'accepted'),
    'connections', (SELECT count(*) FROM public.user_connections WHERE status = 'accepted' AND (follower_id = p_user OR following_id = p_user)),
    'posts',       (SELECT count(*) FROM public.posts WHERE author_id = p_user));
$$;
REVOKE ALL ON FUNCTION public.get_profile_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_counts(uuid) TO anon, authenticated;

-- ── 2. what may the viewer see? ──────────────────────────────────────────────────────────────────────────────────
-- state: ok | private (details hidden by the person's visibility setting) | unavailable (banned, or they blocked me)
--        | blocked_by_me | self | not_found
CREATE OR REPLACE FUNCTION public.get_profile_access(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_banned boolean;
  v_internal boolean;
  v_vis text;
  v_can boolean;
BEGIN
  SELECT COALESCE(is_banned, false), COALESCE(is_internal, false) INTO v_banned, v_internal FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  IF v_me IS NOT NULL AND v_me = p_user THEN
    RETURN jsonb_build_object('state', 'self', 'can_view_details', true);
  END IF;
  IF v_internal AND NOT public.is_current_user_internal() THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;
  IF v_banned AND NOT public.is_current_user_internal() THEN
    RETURN jsonb_build_object('state', 'unavailable');
  END IF;
  IF v_me IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = p_user AND blocked_user_id = v_me) THEN
      RETURN jsonb_build_object('state', 'unavailable');      -- do not reveal that they blocked me
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = v_me AND blocked_user_id = p_user) THEN
      RETURN jsonb_build_object('state', 'blocked_by_me');
    END IF;
  END IF;
  SELECT COALESCE(profile_visibility, 'public') INTO v_vis FROM public.user_settings WHERE user_id = p_user;
  v_vis := COALESCE(v_vis, 'public');
  v_can := public.can_view_profile_extras(p_user);
  RETURN jsonb_build_object('state', CASE WHEN v_can THEN 'ok' ELSE 'private' END, 'visibility', v_vis, 'can_view_details', v_can);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_access(uuid) TO anon, authenticated;

-- ── 3. my relationship with a person, in one call ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_relationship(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'connection_id', c.id,
    'connection_status', CASE WHEN c.id IS NULL THEN 'none'
                              WHEN c.status = 'accepted' THEN 'connected'
                              WHEN c.follower_id = auth.uid() THEN 'pending_sent'
                              ELSE 'pending_received' END,
    'follow_id', f.id,
    'following', f.id IS NOT NULL,
    'followed_by', EXISTS (SELECT 1 FROM public.user_follows x WHERE x.follower_id = p_user AND x.following_id = auth.uid()))
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT uc.id, uc.status, uc.follower_id FROM public.user_connections uc
     WHERE (uc.follower_id = auth.uid() AND uc.following_id = p_user) OR (uc.follower_id = p_user AND uc.following_id = auth.uid()) LIMIT 1) c ON true
  LEFT JOIN LATERAL (
    SELECT uf.id FROM public.user_follows uf WHERE uf.follower_id = auth.uid() AND uf.following_id = p_user LIMIT 1) f ON true
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_relationship(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_relationship(uuid) TO authenticated;

-- ── 4. links: http(s) or a plain domain, nothing else ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clean_public_url(p_in text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := btrim(COALESCE(p_in, ''));
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;
  IF char_length(v) > 300 THEN
    RAISE EXCEPTION 'A link is too long (max 300 characters)' USING ERRCODE = 'P0001';
  END IF;
  IF v ~* '^https?://[^[:space:]]+$' THEN
    RETURN v;
  END IF;
  IF v ~* '^[a-z][a-z0-9+.-]*:' THEN
    RAISE EXCEPTION 'Links must start with http:// or https://' USING ERRCODE = 'P0001';
  END IF;
  IF v ~* '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(/[^[:space:]]*)?$' THEN
    RETURN 'https://' || v;
  END IF;
  RAISE EXCEPTION 'Please enter a valid link' USING ERRCODE = 'P0001';
END;
$$;

-- existing rows with another scheme are blanked (they could never be opened safely)
UPDATE public.profiles SET website = NULL WHERE website IS NOT NULL AND btrim(website) ~* '^[a-z][a-z0-9+.-]*:' AND btrim(website) !~* '^https?://';
UPDATE public.profile_extras SET instagram_url = NULL WHERE instagram_url IS NOT NULL AND btrim(instagram_url) ~* '^[a-z][a-z0-9+.-]*:' AND btrim(instagram_url) !~* '^https?://';
UPDATE public.profile_extras SET youtube_url = NULL WHERE youtube_url IS NOT NULL AND btrim(youtube_url) ~* '^[a-z][a-z0-9+.-]*:' AND btrim(youtube_url) !~* '^https?://';

CREATE OR REPLACE FUNCTION public.guard_profile_website()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.website IS DISTINCT FROM OLD.website THEN
    NEW.website := public.clean_public_url(NEW.website);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_website ON public.profiles;
CREATE TRIGGER trg_guard_profile_website BEFORE INSERT OR UPDATE OF website ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_website();

CREATE OR REPLACE FUNCTION public.guard_profile_extras_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  k text;
  v jsonb;
  item jsonb;
  cleaned jsonb;
  out_links jsonb := '[]'::jsonb;
  is_update boolean := (TG_OP = 'UPDATE');
BEGIN
  -- only values that are being changed are checked, so old rows can still be updated for other reasons
  IF NOT is_update OR NEW.instagram_url IS DISTINCT FROM OLD.instagram_url THEN
    NEW.instagram_url := public.clean_public_url(NEW.instagram_url);
  END IF;
  IF NOT is_update OR NEW.youtube_url IS DISTINCT FROM OLD.youtube_url THEN
    NEW.youtube_url := public.clean_public_url(NEW.youtube_url);
  END IF;
  IF NEW.social_links IS NOT NULL AND jsonb_typeof(NEW.social_links) = 'object' THEN
    cleaned := NEW.social_links;
    FOR k, v IN SELECT * FROM jsonb_each(NEW.social_links) LOOP
      IF k IN ('instagram', 'linkedin', 'twitter', 'facebook', 'youtube', 'spotify') AND jsonb_typeof(v) = 'string'
         AND (NOT is_update OR (OLD.social_links -> k) IS DISTINCT FROM v) THEN
        cleaned := jsonb_set(cleaned, ARRAY[k], COALESCE(to_jsonb(public.clean_public_url(v #>> '{}')), 'null'::jsonb));
      END IF;
    END LOOP;
    IF jsonb_typeof(NEW.social_links -> 'custom_links') = 'array'
       AND (NOT is_update OR (OLD.social_links -> 'custom_links') IS DISTINCT FROM (NEW.social_links -> 'custom_links')) THEN
      FOR item IN SELECT * FROM jsonb_array_elements(NEW.social_links -> 'custom_links') LOOP
        out_links := out_links || jsonb_build_array(jsonb_build_object(
          'title', left(COALESCE(item ->> 'title', ''), 60),
          'url', public.clean_public_url(item ->> 'url')));
      END LOOP;
      cleaned := jsonb_set(cleaned, '{custom_links}', out_links);
    END IF;
    NEW.social_links := cleaned;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_extras_links ON public.profile_extras;
CREATE TRIGGER trg_guard_profile_extras_links BEFORE INSERT OR UPDATE ON public.profile_extras
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_extras_links();

COMMIT;
