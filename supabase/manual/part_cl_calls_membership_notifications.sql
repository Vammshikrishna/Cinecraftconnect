-- PART CL - calls, project membership and notifications (audit step 1c)
-- Run in the Supabase SQL editor AFTER part_cj and part_ck. Based on the LIVE functions and policies read in the audit.
--
-- Fixes:
--   verify_call_room_membership  - a "direct" room is no longer valid just because the id is any profile id
--   answer_call / decline_call / cancel_call - the caller must belong to the call
--   calls, call_participants     - the blanket "any signed-in user can do anything" policies are replaced;
--                                  nobody can set their own host role or edit call room names
--   project_space_members        - only the project owner can add members; a person can join only with an approved request
--   notifications                - a notification for another user must be attributed to the sender
--
-- Web and mobile keep working: they start and join calls through create_or_start_call / answer_call (this part keeps
-- those), and the direct table writes they use as a fallback are still allowed for the caller's own rows.

-- ---------------------------------------------------------------------------
-- 1. verify_call_room_membership: tighten the "direct" branch (discussion and project branches are unchanged).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_call_room_membership(p_user_id uuid, p_room_type text, p_room_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_clean_id text;
  v_uuid_val uuid;
  v_is_member boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_room_type IS NULL OR p_room_id IS NULL THEN
    RETURN false;
  END IF;

  v_clean_id := regexp_replace(p_room_id, '^CineCraft_(project|discussion|direct)_', '');
  v_clean_id := split_part(v_clean_id, '_', 1);

  IF p_room_type = 'discussion' THEN
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      SELECT EXISTS (
        SELECT 1 FROM discussion_rooms dr
        WHERE dr.id = v_uuid_val AND (
          dr.creator_id = p_user_id
          OR dr.is_public = true
          OR dr.room_type = 'public'
          OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = dr.id AND rm.user_id = p_user_id)
          -- a room attached to a project is open to that project's team
          OR (dr.project_id IS NOT NULL AND (
                EXISTS (SELECT 1 FROM projects p WHERE p.id = dr.project_id AND p.creator_id = p_user_id)
                OR EXISTS (
                  SELECT 1 FROM project_space_members psm
                  JOIN project_spaces ps ON ps.id = psm.project_space_id
                  WHERE ps.project_id = dr.project_id AND psm.user_id = p_user_id
                )
             ))
        )
      ) INTO v_is_member;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;

  ELSIF p_room_type = 'project' THEN
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      SELECT EXISTS (
        -- id is the project itself
        SELECT 1 FROM projects p WHERE p.id = v_uuid_val AND p.creator_id = p_user_id
        UNION
        -- id is a project space (what the call UI passes): creator of the space OR of the project it belongs to
        SELECT 1 FROM project_spaces ps
        LEFT JOIN projects p ON p.id = ps.project_id
        WHERE (ps.id = v_uuid_val OR ps.project_id = v_uuid_val)
          AND (ps.creator_id = p_user_id OR p.creator_id = p_user_id)
        UNION
        -- member of that space, or of any space of that project
        SELECT 1 FROM project_space_members psm
        WHERE psm.user_id = p_user_id
          AND (psm.project_space_id = v_uuid_val
               OR psm.project_space_id IN (SELECT id FROM project_spaces WHERE project_id = v_uuid_val))
        UNION
        -- approved applicant of the project the space belongs to
        SELECT 1 FROM project_applications pa
        WHERE pa.user_id = p_user_id AND pa.status = 'approved'
          AND (pa.project_id = v_uuid_val
               OR pa.project_id IN (SELECT project_id FROM project_spaces WHERE id = v_uuid_val))
      ) INTO v_is_member;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;

  ELSIF p_room_type = 'direct' THEN
    -- A direct room name carries the ids of the two people (or a conversation / message id). The caller must be one of
    -- them: either a conversation or message thread links them to the other person, or the room name contains the
    -- caller's own id next to another real user. A name that does not contain the caller's id no longer qualifies.
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM regexp_matches(p_room_id, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', 'g') AS m(a)
        CROSS JOIN LATERAL (SELECT m.a[1]::uuid AS u) x
        WHERE EXISTS (SELECT 1 FROM conversations c WHERE c.id = x.u AND (c.user1_id = p_user_id OR c.user2_id = p_user_id))
           OR EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = x.u AND (dm.sender_id = p_user_id OR dm.receiver_id = p_user_id))
           OR (x.u <> p_user_id AND (
                EXISTS (SELECT 1 FROM conversations c
                        WHERE (c.user1_id = p_user_id AND c.user2_id = x.u) OR (c.user2_id = p_user_id AND c.user1_id = x.u))
                OR EXISTS (SELECT 1 FROM direct_messages dm
                           WHERE (dm.sender_id = p_user_id AND dm.receiver_id = x.u) OR (dm.receiver_id = p_user_id AND dm.sender_id = x.u))
                OR (lower(p_room_id) LIKE '%' || lower(p_user_id::text) || '%'
                    AND EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = x.u))
              ))
      ) INTO v_is_member;

      IF NOT v_is_member THEN
        SELECT EXISTS (
          SELECT 1 FROM direct_messages dm
          WHERE dm.channel_id = p_room_id AND (dm.sender_id = p_user_id OR dm.receiver_id = p_user_id)
        ) INTO v_is_member;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;
  ELSE
    v_is_member := false;
  END IF;

  RETURN v_is_member;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Helpers for the call policies (they bypass row-level security on purpose, to avoid policy recursion;
--    each returns only a yes/no about the signed-in caller).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cl_can_see_call(p_call uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = p_call
      AND (
        c.started_by = auth.uid()
        OR c.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = c.id AND cp.user_id = auth.uid())
        OR public.verify_call_room_membership(auth.uid(), c.room_type, c.daily_room_name)
        OR (c.room_id IS NOT NULL AND public.verify_call_room_membership(auth.uid(), c.room_type, c.room_id::text))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.cl_can_start_call(p_room_type text, p_room_id uuid, p_room_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.verify_call_room_membership(auth.uid(), p_room_type, p_room_name)
    OR (p_room_id IS NOT NULL AND public.verify_call_room_membership(auth.uid(), p_room_type, p_room_id::text))
  );
$function$;

CREATE OR REPLACE FUNCTION public.cl_i_manage_space(p_space uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.cj_can_manage_space(p_space, auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.cl_can_see_call(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cl_can_see_call(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cl_can_start_call(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cl_can_start_call(text, uuid, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cl_i_manage_space(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cl_i_manage_space(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. answer_call / decline_call / cancel_call: the caller must belong to the call.
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.cancel_call(p_call_id uuid DEFAULT NULL::uuid, p_room_type text DEFAULT NULL::text, p_room_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF NOT public.cl_can_see_call(v_call.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You are not part of this call');
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
$function$;

CREATE OR REPLACE FUNCTION public.decline_call(p_call_id uuid DEFAULT NULL::uuid, p_room_type text DEFAULT NULL::text, p_room_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF NOT public.cl_can_see_call(v_call.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'You are not part of this call');
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
$function$;

-- ---------------------------------------------------------------------------
-- 4. calls and call_participants: replace the "any signed-in user can do anything" policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to select calls" ON public.calls;
DROP POLICY IF EXISTS "Allow authenticated users to insert calls" ON public.calls;
DROP POLICY IF EXISTS "Allow authenticated users to update calls" ON public.calls;
DROP POLICY IF EXISTS "Allow authenticated users to delete calls" ON public.calls;

CREATE POLICY "Members can view their calls" ON public.calls
  FOR SELECT USING (public.cl_can_see_call(id));

CREATE POLICY "Members can start calls in their rooms" ON public.calls
  FOR INSERT WITH CHECK (
    started_by = auth.uid()
    AND public.cl_can_start_call(room_type, room_id, daily_room_name)
  );

CREATE POLICY "Members can end their calls" ON public.calls
  FOR UPDATE USING (public.cl_can_see_call(id)) WITH CHECK (public.cl_can_see_call(id));

DROP POLICY IF EXISTS "Allow authenticated users to select call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Allow authenticated users to insert call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Allow authenticated users to update call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Allow authenticated users to delete call participants" ON public.call_participants;

CREATE POLICY "Members can view participants of their calls" ON public.call_participants
  FOR SELECT USING (public.cl_can_see_call(call_id));

CREATE POLICY "Members can add themselves to their calls" ON public.call_participants
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.cl_can_see_call(call_id));

CREATE POLICY "Members can update their own call row" ON public.call_participants
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.cl_can_see_call(call_id));

-- Column rules: clients can no longer write host/cohost roles, call modes, or call room names after creation.
-- (create_or_start_call, answer_call and the space-control / livekit-token functions run with owner or service rights and are unaffected.)
REVOKE INSERT, UPDATE, DELETE ON public.calls FROM anon, authenticated;
GRANT INSERT (room_type, room_id, daily_room_name, daily_room_url, started_by, created_by, status, started_at, type)
  ON public.calls TO authenticated;
GRANT UPDATE (status, ended_at) ON public.calls TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.call_participants FROM anon, authenticated;
GRANT INSERT (call_id, user_id, status, joined_at, left_at, is_audio_enabled, is_video_enabled)
  ON public.call_participants TO authenticated;
GRANT UPDATE (call_id, user_id, status, joined_at, left_at, is_audio_enabled, is_video_enabled)
  ON public.call_participants TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. project_space_members: the project owner adds members; other people join with an approved join request.
--    (approve_join_request and the invite functions run with owner rights and are unaffected.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert themselves into project members" ON public.project_space_members;
CREATE POLICY "Owners add members; approved requesters join" ON public.project_space_members
  FOR INSERT
  WITH CHECK (
    public.cl_i_manage_space(project_space_id)
    OR (
      user_id = auth.uid()
      AND (role IS NULL OR lower(role) IN ('member', 'crew'))
      AND EXISTS (
        SELECT 1 FROM public.project_space_join_requests r
        WHERE r.project_space_id = project_space_members.project_space_id
          AND r.user_id = auth.uid()
          AND r.status = 'approved'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. notifications: writing a notification for someone else must carry your own id as the sender.
--    Two database trigger functions insert notifications for other users without owner rights;
--    they get owner rights first so this change does not stop "like" and "wishlist available" notifications.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_notification_for_like() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_wishlist_availability() SECURITY DEFINER SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can notify with their own name" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (trigger_user_id = auth.uid());
-- (Notifications addressed to yourself are still allowed by "Users can manage own notifications".)
