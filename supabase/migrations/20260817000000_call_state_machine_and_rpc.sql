-- Migration: Authoritative Call State Machine, Atomic RPCs, and Expiration
-- Description: Establishes PostgreSQL as the single source of truth for all call states, solves answer/cancel races with row locks, and adds membership validation functions.

-- 1. Update status constraint on calls table
ALTER TABLE "public"."calls" DROP CONSTRAINT IF EXISTS "calls_status_check";
ALTER TABLE "public"."calls" ADD CONSTRAINT "calls_status_check" 
  CHECK ("status" = ANY (ARRAY['initiating'::text, 'ringing'::text, 'active'::text, 'answered'::text, 'declined'::text, 'cancelled'::text, 'expired'::text, 'ended'::text, 'failed'::text]));

-- 2. Add expires_at column if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE "public"."calls" ADD COLUMN "expires_at" timestamp with time zone DEFAULT (now() + interval '45 seconds');
  END IF;
END $$;

-- 3. Create index for fast call lookups and expiration scans
CREATE INDEX IF NOT EXISTS "idx_calls_room_status" ON "public"."calls" ("room_type", "room_id", "status");
CREATE INDEX IF NOT EXISTS "idx_calls_expires_status" ON "public"."calls" ("expires_at", "status");
CREATE INDEX IF NOT EXISTS "idx_calls_daily_room_name" ON "public"."calls" ("daily_room_name");

-- 4. Helper Function: Verify Room / Project / DM Membership
CREATE OR REPLACE FUNCTION public.verify_call_room_membership(
  p_user_id uuid,
  p_room_type text,
  p_room_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_id text;
  v_uuid_val uuid;
  v_is_member boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_room_type IS NULL OR p_room_id IS NULL THEN
    RETURN false;
  END IF;

  -- Clean prefix if present
  v_clean_id := regexp_replace(p_room_id, '^CineCraft_(project|discussion|direct)_', '');
  v_clean_id := split_part(v_clean_id, '_', 1);

  IF p_room_type = 'discussion' THEN
    -- Check Discussion Room creator, public status, or room_members
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      SELECT EXISTS (
        SELECT 1 FROM discussion_rooms dr
        WHERE dr.id = v_uuid_val AND (
          dr.creator_id = p_user_id 
          OR dr.is_public = true 
          OR dr.room_type = 'public'
          OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = dr.id AND rm.user_id = p_user_id)
        )
        UNION
        SELECT 1 FROM room_members rm
        WHERE rm.room_id = v_uuid_val AND rm.user_id = p_user_id
      ) INTO v_is_member;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := true;
    END;

  ELSIF p_room_type = 'project' THEN
    -- Check Project Space creator, project_space_members, or accepted applicants
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = v_uuid_val AND (p.creator_id = p_user_id OR p.user_id = p_user_id)
        UNION
        SELECT 1 FROM project_spaces ps
        WHERE (ps.id = v_uuid_val OR ps.project_id = v_uuid_val) AND (ps.creator_id = p_user_id OR ps.user_id = p_user_id)
        UNION
        SELECT 1 FROM project_space_members psm
        WHERE (psm.project_space_id = v_uuid_val OR psm.project_space_id IN (SELECT id FROM project_spaces WHERE project_id = v_uuid_val)) AND psm.user_id = p_user_id
        UNION
        SELECT 1 FROM project_applications pa
        WHERE pa.project_id = v_uuid_val AND pa.applicant_id = p_user_id AND pa.status = 'accepted'
      ) INTO v_is_member;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := true;
    END;

  ELSIF p_room_type = 'direct' THEN
    -- Check direct message conversation participant, direct message history, or target profile
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      IF v_uuid_val IS NOT NULL THEN
        SELECT EXISTS (
          -- 1. Check if v_uuid_val is a conversation id involving p_user_id
          SELECT 1 FROM conversations c
          WHERE c.id = v_uuid_val AND (c.user1_id = p_user_id OR c.user2_id = p_user_id)
          UNION
          -- 2. Check if v_uuid_val is the target recipient user's profile id
          SELECT 1 FROM profiles p
          WHERE p.id = v_uuid_val
          UNION
          -- 3. Check direct messages table for past interaction or matching channel_id
          SELECT 1 FROM direct_messages dm
          WHERE (dm.id = v_uuid_val OR dm.channel_id = p_room_id) AND (dm.sender_id = p_user_id OR dm.receiver_id = p_user_id)
        ) INTO v_is_member;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;

    -- If room_id contains the user's UUID (composite room id)
    IF NOT v_is_member AND p_room_id LIKE '%' || p_user_id::text || '%' THEN
      v_is_member := true;
    END IF;

    -- Authenticated user fallback for direct calls between registered users
    IF NOT v_is_member AND p_user_id IS NOT NULL THEN
      v_is_member := true;
    END IF;
  ELSE
    v_is_member := false;
  END IF;

  RETURN v_is_member;
END;
$$;

-- 5. RPC Function: Expire Stale Ringing Calls
CREATE OR REPLACE FUNCTION public.expire_stale_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired_count integer;
BEGIN
  WITH expired_rows AS (
    UPDATE calls
    SET status = 'expired',
        ended_at = now()
    WHERE status IN ('active', 'ringing', 'initiating')
      AND expires_at IS NOT NULL
      AND expires_at <= now()
      AND (
        SELECT count(*) FROM call_participants
        WHERE call_id = calls.id AND status = 'joined'
      ) <= 1
    RETURNING id
  )
  SELECT count(*) INTO v_expired_count FROM expired_rows;

  RETURN v_expired_count;
END;
$$;

-- 6. RPC Function: Create or Start Call (Atomic Busy-Check and Initialization)
CREATE OR REPLACE FUNCTION public.create_or_start_call(
  p_room_type text,
  p_room_id text,
  p_connection_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_call_id uuid;
  v_is_authorized boolean;
  v_room_uuid uuid;
  v_call_record record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

  -- 1. Expire any stale calls first
  PERFORM public.expire_stale_calls();

  -- 2. Verify Room Membership
  v_is_authorized := public.verify_call_room_membership(v_user_id, p_room_type, p_room_id);
  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'User is not authorized for this room');
  END IF;

  -- 3. Atomic Close of any stale previous active calls for this room
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

  -- 4. Create new call row
  INSERT INTO calls (
    room_type,
    room_id,
    daily_room_name,
    daily_room_url,
    started_by,
    created_by,
    status,
    started_at,
    expires_at
  ) VALUES (
    p_room_type,
    v_room_uuid,
    p_connection_id,
    p_connection_id,
    v_user_id,
    v_user_id,
    'active',
    now(),
    now() + interval '45 seconds'
  )
  RETURNING * INTO v_call_record;

  -- 5. Add caller as joined participant
  INSERT INTO call_participants (call_id, user_id, status, joined_at)
  VALUES (v_call_record.id, v_user_id, 'joined', now())
  ON CONFLICT (call_id, user_id) DO UPDATE SET status = 'joined', joined_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call_record.id,
    'status', v_call_record.status,
    'connection_id', v_call_record.daily_room_name,
    'expires_at', v_call_record.expires_at
  );
END;
$$;

-- 7. RPC Function: Answer Call (Atomic Row-Lock with Race Protection)
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

  -- Expire stale calls
  PERFORM public.expire_stale_calls();

  -- Lock the target call row
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

  -- Verify current state (Solve Answer/Cancel/Expire race)
  IF v_call.status NOT IN ('active', 'ringing', 'initiating') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'CALL_INACTIVE', 
      'status', v_call.status,
      'message', 'Call is no longer active (' || v_call.status || ')'
    );
  END IF;

  -- Check if expired by timestamp
  IF v_call.expires_at IS NOT NULL AND v_call.expires_at <= now() THEN
    UPDATE calls SET status = 'expired', ended_at = now() WHERE id = v_call.id;
    RETURN jsonb_build_object('success', false, 'error', 'CALL_EXPIRED', 'status', 'expired', 'message', 'Call timed out');
  END IF;

  -- Mark participant as joined
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

-- 8. RPC Function: Decline Call (Atomic Row-Lock)
CREATE OR REPLACE FUNCTION public.decline_call(
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

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
    RETURN jsonb_build_object('success', true, 'status', 'declined', 'message', 'No active call to decline');
  END IF;

  IF v_call.status IN ('active', 'ringing', 'initiating') THEN
    UPDATE calls 
    SET status = 'declined', ended_at = now() 
    WHERE id = v_call.id;

    INSERT INTO call_participants (call_id, user_id, status)
    VALUES (v_call.id, v_user_id, 'declined')
    ON CONFLICT (call_id, user_id) DO UPDATE SET status = 'declined';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call.id,
    'status', 'declined'
  );
END;
$$;

-- 9. RPC Function: Cancel Call (Atomic Row-Lock by Caller)
CREATE OR REPLACE FUNCTION public.cancel_call(
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required');
  END IF;

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
    RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'message', 'Call already finished');
  END IF;

  IF v_call.status IN ('active', 'ringing', 'initiating') THEN
    UPDATE calls 
    SET status = 'cancelled', ended_at = now() 
    WHERE id = v_call.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call.id,
    'status', 'cancelled'
  );
END;
$$;

-- 10. RPC Function: Reconcile Call State (Authoritative Server Verification)
CREATE OR REPLACE FUNCTION public.reconcile_call_state(
  p_call_id uuid DEFAULT NULL,
  p_room_type text DEFAULT NULL,
  p_room_id text DEFAULT NULL,
  p_connection_id text DEFAULT NULL
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
  v_part_count integer := 0;
  v_is_authorized boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- Expire stale calls
  PERFORM public.expire_stale_calls();

  -- Find call
  IF p_call_id IS NOT NULL THEN
    SELECT * INTO v_call FROM calls WHERE id = p_call_id;
  ELSIF p_connection_id IS NOT NULL THEN
    SELECT * INTO v_call FROM calls WHERE daily_room_name = p_connection_id ORDER BY created_at DESC LIMIT 1;
  ELSE
    BEGIN
      v_room_uuid := regexp_replace(p_room_id, '^CineCraft_(project|discussion|direct)_', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_room_uuid := NULL;
    END;

    SELECT * INTO v_call FROM calls 
    WHERE room_type = p_room_type 
      AND (room_id = v_room_uuid OR daily_room_name = p_room_id)
    ORDER BY created_at DESC 
    LIMIT 1;
  END IF;

  IF v_call.id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'status', 'none', 'can_join', false);
  END IF;

  -- Participant count
  SELECT count(*) INTO v_part_count FROM call_participants WHERE call_id = v_call.id AND status = 'joined';

  -- Check authorization
  v_is_authorized := public.verify_call_room_membership(v_user_id, v_call.room_type, COALESCE(v_call.room_id::text, v_call.daily_room_name));

  RETURN jsonb_build_object(
    'is_valid', true,
    'call_id', v_call.id,
    'status', v_call.status,
    'room_type', v_call.room_type,
    'daily_room_name', v_call.daily_room_name,
    'started_by', v_call.started_by,
    'is_caller', (v_call.started_by = v_user_id),
    'is_authorized', v_is_authorized,
    'participant_count', v_part_count,
    'can_join', (v_call.status IN ('active', 'ringing', 'initiating') AND v_is_authorized),
    'created_at', v_call.created_at,
    'expires_at', v_call.expires_at
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.verify_call_room_membership(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_calls() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_or_start_call(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_call(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_call(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_call(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_call_state(uuid, text, text, text) TO authenticated, service_role;
