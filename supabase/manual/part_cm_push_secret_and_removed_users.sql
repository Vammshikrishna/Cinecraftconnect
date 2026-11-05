-- PART CM - push webhook secret + removed audio-space users (audit step 2a)
-- Run in the Supabase SQL editor AFTER part_cl, and ONLY after these two setup steps (in this order):
--
--   1. Pick a long random secret (for example 40+ random letters and digits). Do not reuse a password.
--   2. Store it in BOTH places:
--        a) Supabase dashboard > Edge Functions > Secrets (or CLI):  PUSH_WEBHOOK_SECRET = <the secret>
--        b) Run this one statement in the SQL editor (replace the text in quotes with the same secret):
--             INSERT INTO public.app_settings (key, value) VALUES ('push_webhook_secret', 'PASTE-THE-SECRET-HERE')
--             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--   3. Then run this part, then deploy the push-delivery function (it starts rejecting calls without the secret
--      as soon as PUSH_WEBHOOK_SECRET is set).
--
-- What this part does:
--   * the database trigger that calls push-delivery now sends the secret, so only your database can use the webhook path
--   * a person the host removed from an audio space can no longer rejoin it (answer_call refuses, and a direct
--     database update cannot flip the "removed" status back)

-- Safety checks: stop here, without changing anything, if the secret is missing or the trigger function is not the
-- one this part was written for.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'push_webhook_secret' AND length(value) >= 20) THEN
    RAISE EXCEPTION 'Add the push_webhook_secret to public.app_settings first (see the top of this file), at least 20 characters.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trigger_push_delivery' AND p.prosrc LIKE '%functions/v1/push-delivery%'
  ) THEN
    RAISE EXCEPTION 'trigger_push_delivery looks different from what this part expects. Send me its definition before running this part.';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 1. The webhook trigger sends the shared secret.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_push_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_url TEXT;
    v_key TEXT;
    v_secret TEXT;
BEGIN
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'supabase_url';
    SELECT value INTO v_key FROM public.app_settings WHERE key = 'supabase_anon_key';
    SELECT value INTO v_secret FROM public.app_settings WHERE key = 'push_webhook_secret';

    -- Fallback to local settings if table is empty (e.g. in local development)
    IF v_url IS NULL OR v_url = '' THEN
        v_url := current_setting('app.settings.supabase_url', true);
    END IF;
    IF v_key IS NULL OR v_key = '' THEN
        v_key := current_setting('app.settings.supabase_anon_key', true);
    END IF;

    IF v_url IS NOT NULL AND v_key IS NOT NULL AND v_url <> '' AND v_key <> '' THEN
        PERFORM net.http_post(
            url := v_url || '/functions/v1/push-delivery',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key,
                'x-webhook-secret', COALESCE(v_secret, '')
            ),
            body := jsonb_build_object(
                'type', TG_OP,
                'table', TG_TABLE_NAME,
                'schema', TG_TABLE_SCHEMA,
                'record', row_to_json(NEW)
            )
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors to prevent blocking the transaction
    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Removed users stay removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cm_guard_removed_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- The host's removal runs with the service key (no signed-in user). A signed-in person cannot undo it.
  IF OLD.status = 'removed' AND NEW.status IS DISTINCT FROM 'removed' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'You were removed from this space' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cm_guard_removed_participant ON public.call_participants;
CREATE TRIGGER trg_cm_guard_removed_participant
  BEFORE UPDATE ON public.call_participants
  FOR EACH ROW EXECUTE FUNCTION public.cm_guard_removed_participant();

CREATE OR REPLACE FUNCTION public.answer_call(p_call_id uuid DEFAULT NULL::uuid, p_room_type text DEFAULT NULL::text, p_room_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_call calls%ROWTYPE;
  v_room_uuid uuid;
  v_joined integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

  PERFORM public.expire_stale_calls();

  IF p_call_id IS NOT NULL THEN
    SELECT * INTO v_call FROM calls WHERE id = p_call_id FOR UPDATE;
  ELSE
    BEGIN
      v_room_uuid := regexp_replace(p_room_id, '^CineCraft_(project|discussion|direct)_', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_room_uuid := NULL;
    END;

    SELECT * INTO v_call FROM calls
    WHERE room_type = p_room_type
      AND (room_id = v_room_uuid OR daily_room_name = p_room_id)
      AND status IN ('active', 'ringing', 'initiating')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_call.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CALL_NOT_FOUND', 'message', 'Call does not exist or has expired');
  END IF;

  IF NOT public.cl_can_see_call(v_call.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You are not part of this call');
  END IF;

  IF EXISTS (SELECT 1 FROM call_participants WHERE call_id = v_call.id AND user_id = v_user_id AND status = 'removed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'REMOVED', 'message', 'The host removed you from this space');
  END IF;

  IF v_call.status NOT IN ('active', 'ringing', 'initiating') THEN
    RETURN jsonb_build_object('success', false, 'error', 'CALL_INACTIVE', 'status', v_call.status,
      'message', 'Call is no longer active (' || v_call.status || ')');
  END IF;

  SELECT count(*) INTO v_joined FROM call_participants WHERE call_id = v_call.id AND status = 'joined';

  IF v_call.expires_at IS NOT NULL AND v_call.expires_at <= now() AND v_joined <= 1 THEN
    UPDATE calls SET status = 'expired', ended_at = now() WHERE id = v_call.id;
    RETURN jsonb_build_object('success', false, 'error', 'CALL_EXPIRED', 'status', 'expired', 'message', 'Call timed out');
  END IF;

  -- In a space everybody who is not already on stage joins as a listener (never downgrade an existing role).
  INSERT INTO call_participants (call_id, user_id, status, joined_at, role)
  VALUES (v_call.id, v_user_id, 'joined', now(),
          CASE WHEN v_call.call_mode = 'audio_space' THEN
                 CASE WHEN v_call.started_by = v_user_id THEN 'host' ELSE 'listener' END
               ELSE 'speaker' END)
  ON CONFLICT (call_id, user_id) DO UPDATE SET status = 'joined', joined_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call.id,
    'status', v_call.status,
    'connection_id', v_call.daily_room_name,
    'room_type', v_call.room_type,
    'call_mode', v_call.call_mode,
    'speaking_mode', v_call.speaking_mode
  );
END;
$function$;
