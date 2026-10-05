-- Audio spaces (Twitter/X Spaces style): a call can run in 'audio_space' mode with a host, optional co-hosts,
-- speakers and listeners. The host chooses how people get on stage:
--   'request' = listeners raise a hand and the host / co-hosts approve them
--   'open'    = anyone may unmute (open mic)
-- Roles live in call_participants.role; the livekit-token / space-control edge functions enforce them.

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_mode text NOT NULL DEFAULT 'call';
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_call_mode_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_call_mode_check CHECK (call_mode IN ('call', 'audio_space'));

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS speaking_mode text NOT NULL DEFAULT 'request';
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_speaking_mode_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_speaking_mode_check CHECK (speaking_mode IN ('open', 'request'));

ALTER TABLE public.call_participants ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'listener';
ALTER TABLE public.call_participants DROP CONSTRAINT IF EXISTS call_participants_role_check;
ALTER TABLE public.call_participants ADD CONSTRAINT call_participants_role_check CHECK (role IN ('host', 'cohost', 'speaker', 'listener'));

-- Replace the 3-argument version with one that can start an audio space. Existing callers (web + mobile) pass three
-- named arguments and keep working through the defaults.
DROP FUNCTION IF EXISTS public.create_or_start_call(text, text, text);

CREATE OR REPLACE FUNCTION public.create_or_start_call(
  p_room_type text,
  p_room_id text,
  p_connection_id text,
  p_call_mode text DEFAULT 'call',
  p_speaking_mode text DEFAULT 'request'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean;
  v_room_uuid uuid;
  v_call_record record;
  v_mode text := CASE WHEN p_call_mode = 'audio_space' THEN 'audio_space' ELSE 'call' END;
  v_speaking text := CASE WHEN p_speaking_mode = 'open' THEN 'open' ELSE 'request' END;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

  PERFORM public.expire_stale_calls();

  v_is_authorized := public.verify_call_room_membership(v_user_id, p_room_type, p_room_id);
  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'User is not authorized for this room');
  END IF;

  BEGIN
    v_room_uuid := regexp_replace(p_room_id, '^CineCraft_(project|discussion|direct)_', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_room_uuid := NULL;
  END;

  UPDATE calls
  SET status = 'ended', ended_at = now()
  WHERE room_type = p_room_type
    AND (room_id = v_room_uuid OR daily_room_name = p_connection_id)
    AND status IN ('active', 'ringing', 'initiating');

  INSERT INTO calls (
    room_type, room_id, daily_room_name, daily_room_url, started_by, created_by, status, started_at, expires_at,
    call_mode, speaking_mode
  ) VALUES (
    p_room_type, v_room_uuid, p_connection_id, p_connection_id, v_user_id, v_user_id, 'active', now(),
    -- A space can sit with only the host for a while; do not time it out like an unanswered ring.
    CASE WHEN v_mode = 'audio_space' THEN now() + interval '24 hours' ELSE now() + interval '45 seconds' END,
    v_mode, v_speaking
  )
  RETURNING * INTO v_call_record;

  INSERT INTO call_participants (call_id, user_id, status, joined_at, role)
  VALUES (v_call_record.id, v_user_id, 'joined', now(), CASE WHEN v_mode = 'audio_space' THEN 'host' ELSE 'speaker' END)
  ON CONFLICT (call_id, user_id) DO UPDATE SET status = 'joined', joined_at = now(),
    role = CASE WHEN v_mode = 'audio_space' THEN 'host' ELSE call_participants.role END;

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call_record.id,
    'status', v_call_record.status,
    'connection_id', v_call_record.daily_room_name,
    'expires_at', v_call_record.expires_at,
    'call_mode', v_call_record.call_mode,
    'speaking_mode', v_call_record.speaking_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_start_call(text, text, text, text, text) TO authenticated, service_role;

-- answer_call now also tells the client what kind of call it is joining, so the right screen opens straight away.
CREATE OR REPLACE FUNCTION public.answer_call(
  p_call_id uuid DEFAULT NULL,
  p_room_type text DEFAULT NULL,
  p_room_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;
