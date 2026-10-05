-- PART M: safe to run now (lets people join a running group call after the first 45 seconds).
BEGIN;
-- A call is created with a 45s "ring" window (expires_at). expire_stale_calls() already leaves calls alone once two or
-- more people have joined, but answer_call() expired ANY call past that timestamp. So a third person joining a
-- running group call after the first 45 seconds got "Call timed out" and could not join. Only expire calls that
-- nobody (or just the caller) is actually in.
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CALL_INACTIVE',
      'status', v_call.status,
      'message', 'Call is no longer active (' || v_call.status || ')'
    );
  END IF;

  SELECT count(*) INTO v_joined FROM call_participants WHERE call_id = v_call.id AND status = 'joined';

  -- Only a call that never got going (caller alone) times out; a running call stays joinable.
  IF v_call.expires_at IS NOT NULL AND v_call.expires_at <= now() AND v_joined <= 1 THEN
    UPDATE calls SET status = 'expired', ended_at = now() WHERE id = v_call.id;
    RETURN jsonb_build_object('success', false, 'error', 'CALL_EXPIRED', 'status', 'expired', 'message', 'Call timed out');
  END IF;

  INSERT INTO call_participants (call_id, user_id, status, joined_at)
  VALUES (v_call.id, v_user_id, 'joined', now())
  ON CONFLICT (call_id, user_id) DO UPDATE SET status = 'joined', joined_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call.id,
    'status', v_call.status,
    'connection_id', v_call.daily_room_name,
    'room_type', v_call.room_type
  );
END;
$$;

COMMIT;
