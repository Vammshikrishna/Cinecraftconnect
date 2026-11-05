-- PART CJ - close open legacy functions (audit step 1a)
-- Run in the Supabase SQL editor AFTER audit_step1_preflight.sql has been checked.
-- It only replaces function bodies and changes who may run them. No tables, rows or policies change.
-- Based on the LIVE function bodies read in audit step 0b.
--
-- Fixes:
--   clear_project_space_messages        - anyone (even signed out) could delete any project's chat history
--   get_messages_for_channel_paginated  - anyone could read any DM thread if they knew the channel id
--   mark_message_as_seen(uuid, uuid)    - could mark another user's messages as read
--   create_discussion_room_with_creator - creator id was taken from the caller
--   approve_join_request / reject_join_request - no check that the caller owns the project space
--   remove_staff_memberships            - anyone could remove any user from every room and project space
--   send_governance_notification, _create_refund - callable by anyone with the public key
--   claim_admin_access                  - no longer callable when signed out
-- Not in this part (needs app changes, comes in the next step): calls, project_space_members,
-- project_space_messages policies, notifications insert, space_access_grants insert.

-- ---------------------------------------------------------------------------
-- Helper: may this user manage this project space? (creator of the space, or creator of its project)
-- Internal only: not callable by API clients.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cj_can_manage_space(p_space uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_uid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.project_spaces ps
    LEFT JOIN public.projects pr ON pr.id = ps.project_id
    WHERE ps.id = p_space
      AND (ps.creator_id = p_uid OR pr.creator_id = p_uid)
  );
$function$;

REVOKE ALL ON FUNCTION public.cj_can_manage_space(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. clear_project_space_messages: only the owner/admin of the space (or the owner of the project) may clear it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_project_space_messages(_space_id uuid DEFAULT NULL::uuid, _project_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    target_space_ids uuid[];
    v_found integer;
    v_not_owned integer;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    -- Collect all possible IDs (space IDs, project IDs, and space_message space_ids)
    SELECT array_agg(DISTINCT space_id_val) INTO target_space_ids
    FROM (
        SELECT id AS space_id_val FROM public.project_spaces
        WHERE (_space_id IS NOT NULL AND (id = _space_id OR project_id = _space_id))
           OR (_project_id IS NOT NULL AND (id = _project_id OR project_id = _project_id))
        UNION
        SELECT project_space_id AS space_id_val FROM public.project_space_messages
        WHERE (_space_id IS NOT NULL AND project_space_id = _space_id)
           OR (_project_id IS NOT NULL AND project_space_id = _project_id)
        UNION
        SELECT _space_id AS space_id_val WHERE _space_id IS NOT NULL
        UNION
        SELECT _project_id AS space_id_val WHERE _project_id IS NOT NULL
    ) sub;

    IF target_space_ids IS NULL OR array_length(target_space_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- The caller must own every space / project that would be cleared, and at least one must exist.
    SELECT count(*), count(*) FILTER (WHERE NOT owned)
      INTO v_found, v_not_owned
    FROM (
        SELECT (COALESCE(ps.creator_id = v_uid, false) OR COALESCE(pr.creator_id = v_uid, false)) AS owned
        FROM public.project_spaces ps
        LEFT JOIN public.projects pr ON pr.id = ps.project_id
        WHERE ps.id = ANY(target_space_ids) OR ps.project_id = ANY(target_space_ids)
        UNION ALL
        SELECT COALESCE(pr2.creator_id = v_uid, false)
        FROM public.projects pr2
        WHERE pr2.id = ANY(target_space_ids)
    ) o;

    IF v_found = 0 OR v_not_owned > 0 THEN
        RAISE EXCEPTION 'Only the project owner can clear this chat';
    END IF;

    -- 1. Unpin messages in project_spaces
    UPDATE public.project_spaces
    SET pinned_message_id = NULL
    WHERE id = ANY(target_space_ids) OR project_id = ANY(target_space_ids);

    -- 2. Break reply_to_id self-referencing foreign keys in project_space_messages
    UPDATE public.project_space_messages
    SET reply_to_id = NULL
    WHERE project_space_id = ANY(target_space_ids);

    -- 3. Delete reactions associated with these messages
    DELETE FROM public.project_space_message_reactions
    WHERE message_id IN (
        SELECT id FROM public.project_space_messages
        WHERE project_space_id = ANY(target_space_ids)
    );

    -- 4. Delete all messages from project_space_messages
    DELETE FROM public.project_space_messages
    WHERE project_space_id = ANY(target_space_ids);

    -- 5. Delete messages from legacy project_messages table
    UPDATE public.project_messages
    SET reply_to_id = NULL
    WHERE project_id = ANY(target_space_ids);

    DELETE FROM public.project_messages
    WHERE project_id = ANY(target_space_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.clear_project_space_messages(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_project_space_messages(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_messages_for_channel_paginated: only messages the caller sent or received.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_messages_for_channel_paginated(p_channel_id text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb, reply_to_id uuid, is_deleted boolean, deleted_for_users uuid[], is_read boolean, replied_to_message jsonb, attachment_url text, attachment_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    RETURN QUERY
    SELECT
        dm.id,
        dm.content,
        dm.created_at,
        dm.sender_id,
        jsonb_build_object(
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
        ) AS sender_profile,
        dm.reply_to_id,
        dm.is_deleted,
        dm.deleted_for_users,
        dm.is_read,
        (
            SELECT jsonb_build_object(
                'id', rd.id,
                'content', rd.content,
                'is_deleted', rd.is_deleted,
                'sender_profile', jsonb_build_object(
                    'full_name', rp.full_name,
                    'avatar_url', rp.avatar_url
                )
            )
            FROM direct_messages rd
            JOIN profiles rp ON rd.sender_id = rp.id
            WHERE rd.id = dm.reply_to_id
              AND (rd.sender_id = auth.uid() OR rd.receiver_id = auth.uid())
        ) AS replied_to_message,
        dm.attachment_url,
        dm.attachment_type
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
      AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
    ORDER BY dm.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_messages_for_channel_paginated(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_messages_for_channel_paginated(text, integer, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. mark_message_as_seen(uuid, uuid): the user can only be the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_message_as_seen(p_message_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_channel_id text;
    v_created_at timestamptz;
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;
    IF p_user_id IS NOT NULL AND p_user_id <> v_user THEN
        RAISE EXCEPTION 'You can only mark your own messages as read';
    END IF;

    SELECT channel_id, created_at INTO v_channel_id, v_created_at
    FROM direct_messages
    WHERE id = p_message_id;

    -- Update THIS message and ALL EARLIER messages in this thread, only the caller's received ones.
    UPDATE direct_messages
    SET is_read = true
    WHERE channel_id = v_channel_id
    AND receiver_id = v_user
    AND created_at <= v_created_at
    AND (is_read = false OR is_read IS NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_message_as_seen(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_as_seen(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_message_as_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_as_seen(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. create_discussion_room_with_creator: the creator is always the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(c_id uuid, cat_id uuid, room_title text, room_description text, type text, room_tags text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_room_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;
    IF c_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'You can only create a room as yourself';
    END IF;

    INSERT INTO public.discussion_rooms (
        creator_id,
        category_id,
        title,
        description,
        room_type,
        is_public,
        tags,
        member_count
    )
    VALUES (
        auth.uid(),
        cat_id,
        room_title,
        room_description,
        type,
        type = 'public',
        room_tags,
        1
    )
    RETURNING id INTO new_room_id;

    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (new_room_id, auth.uid(), 'admin');

    RETURN new_room_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_discussion_room_with_creator(uuid, uuid, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_discussion_room_with_creator(uuid, uuid, text, text, text, text[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. approve_join_request / reject_join_request: only the owner/admin of that project space.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_project_space_id uuid;
    v_user_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    SELECT project_space_id, user_id INTO v_project_space_id, v_user_id
    FROM project_space_join_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Join request not found';
    END IF;

    IF NOT public.cj_can_manage_space(v_project_space_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the project owner can decide join requests';
    END IF;

    UPDATE project_space_join_requests
    SET status = 'approved'
    WHERE id = _request_id;

    INSERT INTO project_space_members (project_space_id, user_id, role)
    VALUES (v_project_space_id, v_user_id, 'member')
    ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_project_space_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    SELECT project_space_id INTO v_project_space_id
    FROM project_space_join_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Join request not found';
    END IF;

    IF NOT public.cj_can_manage_space(v_project_space_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the project owner can decide join requests';
    END IF;

    UPDATE project_space_join_requests
    SET status = 'rejected'
    WHERE id = _request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_join_request(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_join_request(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. remove_staff_memberships: it only ever applies to staff accounts. Not callable when signed out.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_staff_memberships(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rooms integer;
  v_spaces integer;
BEGIN
  -- Normal members are never touched: this exists only to keep staff accounts out of rooms and spaces.
  IF p_user IS NULL OR NOT public.is_staff_user(p_user) THEN
    RETURN 0;
  END IF;

  DELETE FROM public.room_members WHERE user_id = p_user;
  GET DIAGNOSTICS v_rooms = ROW_COUNT;
  DELETE FROM public.project_space_members WHERE user_id = p_user;
  GET DIAGNOSTICS v_spaces = ROW_COUNT;
  DELETE FROM public.room_join_requests WHERE user_id = p_user;
  DELETE FROM public.project_space_join_requests WHERE user_id = p_user;

  IF v_rooms + v_spaces > 0 THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'staff.memberships_removed', auth.uid(), p_user::text, 'user',
      'Staff accounts cannot be members of rooms or project spaces',
      jsonb_build_object('rooms', v_rooms, 'project_spaces', v_spaces)
    );
  END IF;
  RETURN v_rooms + v_spaces;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_staff_memberships(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_staff_memberships(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Internal-only functions: no app code calls them; only database functions do.
--    (Check audit_step1_preflight.sql section 1 first: every caller listed there should be definer=true.)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.send_governance_notification(uuid, text, text, boolean, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_governance_notification(uuid, text, text, boolean, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public._create_refund(uuid, integer, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._create_refund(uuid, integer, text, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. claim_admin_access stays for the one-time setup page (it refuses once a super admin exists),
--    but it is no longer callable by signed-out clients.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_admin_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_access() TO authenticated, service_role;
