-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AN – Encrypted messages become opt-in
--   * profiles.e2ee_enabled says whether a person has turned on encrypted messaging. Other people's apps read it to
--     decide whether a direct message can be encrypted (both sides must have it on).
--   * everyone who already published an encryption key keeps encrypted messaging (no behaviour change for them).
--   * new accounts start with it OFF; they are offered it the first time they open Messages.
--   * turning it off keeps the keys and the PIN backup, so history stays readable and it can be turned on again.
--   * the flag can only be changed on your own row, and cannot be switched on without a published public key.
-- Run after part AM, then deploy the new web + mobile builds.
-- Design and rules: docs/E2EE_OPT_IN_DESIGN.md
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS e2ee_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS e2ee_enabled_at timestamptz;

-- people who already have a key were encrypted by default: keep it that way
UPDATE public.profiles
   SET e2ee_enabled = true, e2ee_enabled_at = COALESCE(e2ee_enabled_at, now())
 WHERE public_key IS NOT NULL AND public_key <> '' AND e2ee_enabled = false;

-- guard: only your own flag, and never on without a key
CREATE OR REPLACE FUNCTION public.guard_e2ee_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.e2ee_enabled IS NOT DISTINCT FROM OLD.e2ee_enabled THEN
    RETURN NEW;
  END IF;
  IF NEW.e2ee_enabled AND (NEW.public_key IS NULL OR NEW.public_key = '') THEN
    RAISE EXCEPTION 'Create your encryption key before turning on encrypted messages' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.e2ee_enabled AND (TG_OP = 'INSERT' OR OLD.e2ee_enabled = false) THEN
    NEW.e2ee_enabled_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_e2ee_flag ON public.profiles;
CREATE TRIGGER trg_guard_e2ee_flag BEFORE INSERT OR UPDATE OF e2ee_enabled, public_key ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_e2ee_flag();

-- turn it on / off for yourself (the app calls this after it has published the key)
CREATE OR REPLACE FUNCTION public.set_e2ee_enabled(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  UPDATE public.profiles SET e2ee_enabled = COALESCE(p_enabled, false) WHERE id = auth.uid();
  RETURN jsonb_build_object('success', true, 'enabled', COALESCE(p_enabled, false));
END;
$$;
REVOKE ALL ON FUNCTION public.set_e2ee_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_e2ee_enabled(boolean) TO authenticated;

COMMIT;
