-- PART CS - key vault for the encrypted-chat PIN backup (audit step 2d)
-- Run in the Supabase SQL editor BEFORE deploying the key-vault Edge Function and the new web/mobile builds.
--
-- What it is: the 6-digit PIN backup is now also locked with a secret that only the server holds (KEY_VAULT_SECRET, an
-- Edge Function secret that is NOT in the database). This table keeps, per person, a check value for their PIN and a
-- counter of wrong tries (10 wrong tries = locked for 1 hour). A copy of the database, on its own, can no longer be
-- used to guess PINs offline.
--
-- Nobody can read or write this table from the app: only the key-vault Edge Function (service key) can.

CREATE TABLE IF NOT EXISTS public.key_vault (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  verifier        text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.key_vault ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: no app user can touch this table
REVOKE ALL ON public.key_vault FROM PUBLIC, anon, authenticated;

-- Store (or replace) the check value when a person creates or changes their PIN backup.
CREATE OR REPLACE FUNCTION public.key_vault_setup(p_user uuid, p_verifier text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.key_vault (user_id, verifier, failed_attempts, locked_until, updated_at)
  VALUES (p_user, p_verifier, 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE
    SET verifier = EXCLUDED.verifier, failed_attempts = 0, locked_until = NULL, updated_at = now();
END;
$function$;

-- Check one PIN try. Atomic: the row is locked while it is checked, so many parallel tries cannot skip the counter.
-- Returns {"status": "ok" | "wrong" | "locked" | "none", "attempts_left": n, "retry_after": seconds}.
CREATE OR REPLACE FUNCTION public.key_vault_try(p_user uuid, p_verifier text, p_max_fails integer DEFAULT 10, p_lock_seconds integer DEFAULT 3600)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.key_vault%ROWTYPE;
  v_fails integer;
BEGIN
  SELECT * INTO v FROM public.key_vault WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  IF v.locked_until IS NOT NULL AND v.locked_until > now() THEN
    RETURN jsonb_build_object('status', 'locked', 'retry_after', GREATEST(1, ceil(extract(epoch FROM (v.locked_until - now())))::int));
  END IF;

  IF v.verifier = p_verifier THEN
    UPDATE public.key_vault SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE user_id = p_user;
    RETURN jsonb_build_object('status', 'ok');
  END IF;

  v_fails := v.failed_attempts + 1;
  IF v_fails >= p_max_fails THEN
    UPDATE public.key_vault
       SET failed_attempts = 0, locked_until = now() + make_interval(secs => p_lock_seconds), updated_at = now()
     WHERE user_id = p_user;
    RETURN jsonb_build_object('status', 'wrong', 'attempts_left', 0, 'retry_after', p_lock_seconds);
  END IF;

  UPDATE public.key_vault SET failed_attempts = v_fails, updated_at = now() WHERE user_id = p_user;
  RETURN jsonb_build_object('status', 'wrong', 'attempts_left', p_max_fails - v_fails);
END;
$function$;

REVOKE ALL ON FUNCTION public.key_vault_setup(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.key_vault_try(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.key_vault_setup(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.key_vault_try(uuid, text, integer, integer) TO service_role;
