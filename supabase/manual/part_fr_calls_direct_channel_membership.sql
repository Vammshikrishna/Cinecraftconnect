-- PART FR (calls) - a brand-new chat cannot start a call: "Failed to start call" / "You are not an authorized member ..." (HTTP 403 on livekit-token and push-delivery).
-- Safe to run more than once.
--
-- WHAT WENT WRONG: verify_call_room_membership (the check behind create_or_start_call, the livekit-token function and push-delivery) accepts a direct
-- chat only when a message already exists in it (or a conversation row), and its message check compared the channel id with the WHOLE room name
-- ("CineCraft_direct_<channel>_<suffix>", which is what livekit-token sends), so even chats WITH messages failed the token step (403 FORBIDDEN).
-- Two people who just connected and open the chat have no message at all, so their first call is refused earlier. (The app side is fixed separately:
-- it now tells the call helpers who the other person is.)
-- THE FIX: compare the channel id with the bare id too, and also accept the chat's channel id when it is exactly the mix of the caller's id and another real profile's id (that is how the app builds it).
-- Everything else in the function is unchanged from part CL.
--
-- PREFLIGHT (read only): select prosrc like '%A brand-new chat%' as already_fixed from pg_proc where proname = 'verify_call_room_membership';
-- POST-CHECK  (read only): same query now true; then two accounts that have never messaged can start a call from the chat's video button.

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
          WHERE dm.channel_id IN (p_room_id, v_clean_id) AND (dm.sender_id = p_user_id OR dm.receiver_id = p_user_id)
        ) INTO v_is_member;
      END IF;

      -- A brand-new chat has no message yet, so nothing above can link the two people. The chat's channel id is built from both
      -- ids (the first 18 characters of the smaller id, then the rest of the larger one: generateDirectRoomId in the app). Accept it
      -- when it is exactly that mix of the caller and another real profile.
      IF NOT v_is_member THEN
        SELECT EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id <> p_user_id
            AND (
              (p_user_id::text COLLATE "C" < pr.id::text COLLATE "C"
                 AND lower(v_clean_id) = substr(p_user_id::text, 1, 18) || substr(pr.id::text, 19))
              OR
              (pr.id::text COLLATE "C" < p_user_id::text COLLATE "C"
                 AND lower(v_clean_id) = substr(pr.id::text, 1, 18) || substr(p_user_id::text, 19))
            )
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
