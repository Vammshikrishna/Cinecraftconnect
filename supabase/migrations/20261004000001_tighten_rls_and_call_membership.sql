-- 1. verify_call_room_membership: fail closed.
--    Previously any error while checking discussion / project membership returned TRUE, and every
--    authenticated user was authorised for 'direct' rooms by an unconditional fallback.
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

-- 2. group_keys UPDATE: WITH CHECK (true) let any member rewrite any row (incl. changing user_id /
--    target_id). Require the new row to satisfy the same membership test as the old row.
DROP POLICY IF EXISTS "Users can update group keys" ON "public"."group_keys";
CREATE POLICY "Users can update group keys"
ON "public"."group_keys"
FOR UPDATE
TO authenticated
USING (
  "user_id" = auth.uid()
  OR EXISTS (SELECT 1 FROM "public"."room_members" rm WHERE rm."room_id" = "group_keys"."target_id" AND rm."user_id" = auth.uid())
  OR EXISTS (SELECT 1 FROM "public"."project_space_members" pm WHERE pm."project_space_id" = "group_keys"."target_id" AND pm."user_id" = auth.uid())
)
WITH CHECK (
  "user_id" = auth.uid()
  OR EXISTS (SELECT 1 FROM "public"."room_members" rm WHERE rm."room_id" = "group_keys"."target_id" AND rm."user_id" = auth.uid())
  OR EXISTS (SELECT 1 FROM "public"."project_space_members" pm WHERE pm."project_space_id" = "group_keys"."target_id" AND pm."user_id" = auth.uid())
);

DROP POLICY IF EXISTS "Staff with active grants can update group keys" ON "public"."group_keys";
CREATE POLICY "Staff with active grants can update group keys"
ON "public"."group_keys"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" g
    WHERE g."user_id" = auth.uid()
      AND g."target_id" = "group_keys"."target_id"::text
      AND g."expires_at" > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."space_access_grants" g
    WHERE g."user_id" = auth.uid()
      AND g."target_id" = "group_keys"."target_id"::text
      AND g."expires_at" > now()
  )
);

-- 3. notifications INSERT: WITH CHECK (true) let any user forge notifications "from" anyone.
--    The sender recorded on a notification must be the caller (or empty).
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON "public"."notifications";
CREATE POLICY "Authenticated users can create notifications"
ON "public"."notifications"
FOR INSERT
TO authenticated
WITH CHECK (
  "trigger_user_id" IS NULL OR "trigger_user_id" = auth.uid()
);
