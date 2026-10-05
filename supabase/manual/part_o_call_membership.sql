-- PART O: fixes 'You are not an authorized member…' on calls/spaces (project creators, project-linked rooms). Safe to run now.
BEGIN;
-- verify_call_room_membership was made strict (fail closed) earlier. That exposed gaps where a legitimate person was
-- refused with "You are not an authorized member of this project, discussion room, or direct conversation":
--   * project calls are keyed by the project SPACE id, and the project's creator is not necessarily a row in
--     project_space_members (auto-created spaces have no creator_id), so the creator was locked out of their own call;
--   * discussion rooms attached to a project were only open to explicit room members, not to that project's team;
--   * an approved applicant / space member of any space of the project was only matched by exact space id.
-- This version keeps the strict default but recognises all of those relationships.
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
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      IF v_uuid_val IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = v_uuid_val AND (c.user1_id = p_user_id OR c.user2_id = p_user_id)
          UNION
          SELECT 1 FROM profiles p
          WHERE p.id = v_uuid_val
          UNION
          SELECT 1 FROM direct_messages dm
          WHERE (dm.id = v_uuid_val OR dm.channel_id = p_room_id) AND (dm.sender_id = p_user_id OR dm.receiver_id = p_user_id)
        ) INTO v_is_member;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;

    IF NOT v_is_member AND p_room_id LIKE '%' || p_user_id::text || '%' THEN
      v_is_member := true;
    END IF;
  ELSE
    v_is_member := false;
  END IF;

  RETURN v_is_member;
END;
$$;

COMMIT;
