-- profile_visibility ('public' | 'connections' | 'private') was only a stored preference.
-- Sensitive/contact-style profile fields now live in profile_extras, whose RLS honours that setting.
-- Name, avatar, bio, location, craft, website and verification stay in `profiles` (public identity).
--
-- PHASE 1 (this file): create + backfill. The old columns on public.profiles are NOT dropped here.
-- PHASE 2 (20261004000009_drop_moved_profile_columns.sql): run only after the new apps are deployed.

CREATE TABLE IF NOT EXISTS public.profile_extras (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  instagram_url    text,
  youtube_url      text,
  social_links     jsonb NOT NULL DEFAULT '{}'::jsonb,
  union_membership text[] DEFAULT '{}'::text[],
  day_rate_min     numeric,
  day_rate_max     numeric,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Directly-readable public flag (it used to be hidden inside social_links JSON).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accept_direct_pitches boolean NOT NULL DEFAULT true;
UPDATE public.profiles
   SET accept_direct_pitches = COALESCE((social_links->>'accept_direct_pitches')::boolean, true)
 WHERE social_links ? 'accept_direct_pitches';

CREATE OR REPLACE FUNCTION public.can_view_profile_extras(p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility text;
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NOT NULL AND (v_me = p_target OR public.is_current_user_internal()) THEN
    RETURN true;
  END IF;

  SELECT COALESCE(profile_visibility, 'public') INTO v_visibility
  FROM public.user_settings WHERE user_id = p_target;
  v_visibility := COALESCE(v_visibility, 'public');

  IF v_visibility = 'public' THEN
    RETURN true;
  END IF;
  IF v_me IS NULL OR v_visibility = 'private' THEN
    RETURN false;
  END IF;
  -- 'connections'
  RETURN EXISTS (
    SELECT 1 FROM public.user_connections
    WHERE status = 'accepted'
      AND ((follower_id = v_me AND following_id = p_target)
        OR (follower_id = p_target AND following_id = v_me))
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.can_view_profile_extras(uuid) TO anon, authenticated;

ALTER TABLE public.profile_extras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View extras per visibility" ON public.profile_extras;
CREATE POLICY "View extras per visibility" ON public.profile_extras
  FOR SELECT USING (public.can_view_profile_extras(user_id));
DROP POLICY IF EXISTS "Owner inserts extras" ON public.profile_extras;
CREATE POLICY "Owner inserts extras" ON public.profile_extras
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner updates extras" ON public.profile_extras;
CREATE POLICY "Owner updates extras" ON public.profile_extras
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.profile_extras FROM PUBLIC;
GRANT SELECT ON public.profile_extras TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profile_extras TO authenticated;
GRANT ALL ON public.profile_extras TO service_role;

-- Backfill (without the flag that moved to profiles.accept_direct_pitches).
INSERT INTO public.profile_extras (user_id, instagram_url, youtube_url, social_links, union_membership, day_rate_min, day_rate_max)
SELECT id, instagram_url, youtube_url,
       COALESCE(social_links, '{}'::jsonb) - 'accept_direct_pitches',
       COALESCE(union_membership, '{}'::text[]), day_rate_min, day_rate_max
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
