-- Prevent end users from editing privileged / moderation columns on their own profile.
--
-- The "Users can update own profile" policy has no column restriction, so any signed-in
-- user could PATCH /profiles?id=eq.<self> and set is_verified, is_banned, is_internal,
-- trust_score, restriction_flags, etc. This trigger silently keeps the old value for those
-- columns unless the caller is an internal staff member (admin / moderator / super_admin)
-- or there is no end-user context (service role, SECURITY DEFINER admin RPCs run by
-- postgres, cron jobs, auth triggers).

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No end-user JWT (service_role key, background jobs, auth triggers, migrations): allow.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Staff may change moderation fields (they have their own audited RPCs as well).
  IF public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified          := false;
    NEW.is_banned            := false;
    NEW.is_internal          := false;
    NEW.is_official_team     := false;
    NEW.trust_score          := 100;
    NEW.restriction_flags    := '{}'::text[];
    NEW.shadow_banned_at     := NULL;
    NEW.is_shadowbanned      := false;
    NEW.force_password_reset := false;
    NEW.sessions_revoked_at  := NULL;
    NEW.last_muted_at        := NULL;
    NEW.mute_expires_at      := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: keep the stored value for every privileged column.
  NEW.is_verified          := OLD.is_verified;
  NEW.is_banned            := OLD.is_banned;
  NEW.is_internal          := OLD.is_internal;
  NEW.is_official_team     := OLD.is_official_team;
  NEW.trust_score          := OLD.trust_score;
  NEW.restriction_flags    := OLD.restriction_flags;
  NEW.shadow_banned_at     := OLD.shadow_banned_at;
  NEW.is_shadowbanned      := OLD.is_shadowbanned;
  NEW.force_password_reset := OLD.force_password_reset;
  NEW.sessions_revoked_at  := OLD.sessions_revoked_at;
  NEW.last_muted_at        := OLD.last_muted_at;
  NEW.mute_expires_at      := OLD.mute_expires_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();
