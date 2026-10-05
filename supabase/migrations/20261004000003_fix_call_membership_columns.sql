-- Corrects verify_call_room_membership: project_applications uses user_id / 'approved' (the previous
-- version referenced non-existent applicant_id/'accepted', which errored and, when failing closed, would
-- deny every project call). Also drops non-existent projects.user_id / project_spaces.user_id references. Safe to run even if 20261004000001 was already applied.
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
        )
        UNION
        SELECT 1 FROM room_members rm
        WHERE rm.room_id = v_uuid_val AND rm.user_id = p_user_id
      ) INTO v_is_member;
    EXCEPTION WHEN OTHERS THEN
      v_is_member := false;
    END;

  ELSIF p_room_type = 'project' THEN
    BEGIN
      v_uuid_val := v_clean_id::uuid;
      SELECT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = v_uuid_val AND p.creator_id = p_user_id
        UNION
        SELECT 1 FROM project_spaces ps
        WHERE (ps.id = v_uuid_val OR ps.project_id = v_uuid_val) AND ps.creator_id = p_user_id
        UNION
        SELECT 1 FROM project_space_members psm
        WHERE (psm.project_space_id = v_uuid_val OR psm.project_space_id IN (SELECT id FROM project_spaces WHERE project_id = v_uuid_val)) AND psm.user_id = p_user_id
        UNION
        SELECT 1 FROM project_applications pa
        WHERE pa.project_id = v_uuid_val AND pa.user_id = p_user_id AND pa.status = 'approved'
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

    -- Composite room id that embeds the caller's own user id.
    IF NOT v_is_member AND p_room_id LIKE '%' || p_user_id::text || '%' THEN
      v_is_member := true;
    END IF;
    -- NOTE: the old "any authenticated user may join any direct room" fallback was removed.
  ELSE
    v_is_member := false;
  END IF;

  RETURN v_is_member;
END;
$$;
