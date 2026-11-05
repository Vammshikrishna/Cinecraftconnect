-- PART EU - "mark as read" for rooms and project chats can only be done for yourself. Safe to run more than once. Any time.
--
-- WHAT THE PREFLIGHT SHOWED (audit_step_eu_preflight.sql): mark_room_message_as_seen(uuid, uuid) and mark_project_message_as_seen(uuid, uuid)
-- take a p_user_id and used it as given, so any signed-in person could write a read marker for someone else (and hide that person's unread badge).
-- mark_message_as_seen(uuid, uuid) (direct messages) already refuses a different user; this makes the other two behave the same.
-- The apps send their own user id (or nothing), so nothing changes for them. The one-argument versions already use auth.uid() and are untouched.
-- Also: a message id that does not exist now does nothing (before, it inserted a row with an empty room / space).
--
-- PREFLIGHT (read only): audit_step_eu_preflight.sql
-- POST-CHECK (read only): select count(*) from pg_proc p where p.proname in ('mark_room_message_as_seen','mark_project_message_as_seen')
--   and pg_get_function_arguments(p.oid) like '%p_user_id%' and p.prosrc like '%only mark your own%';     -- expect 2
-- ROLLBACK: re-create the two functions from audit_step_eu_preflight.sql output (the body column), or from supabase/migrations/20260610000028_squashed_migrations.sql.

CREATE OR REPLACE FUNCTION public.mark_room_message_as_seen(p_message_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_room_id uuid;
  v_created_at timestamptz;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_user_id IS NOT NULL AND p_user_id <> v_user THEN
    RAISE EXCEPTION 'You can only mark your own messages as read';
  END IF;

  SELECT room_id, created_at INTO v_room_id, v_created_at FROM public.room_messages WHERE id = p_message_id;
  IF v_room_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.room_message_read_status (room_id, user_id, last_read_at)
  VALUES (v_room_id, v_user, v_created_at)
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET last_read_at = EXCLUDED.last_read_at
    WHERE EXCLUDED.last_read_at > room_message_read_status.last_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_project_message_as_seen(p_message_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_space_id uuid;
  v_created_at timestamptz;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_user_id IS NOT NULL AND p_user_id <> v_user THEN
    RAISE EXCEPTION 'You can only mark your own messages as read';
  END IF;

  SELECT project_space_id, created_at INTO v_space_id, v_created_at FROM public.project_space_messages WHERE id = p_message_id;
  IF v_space_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.project_message_read_status (project_space_id, user_id, last_read_at)
  VALUES (v_space_id, v_user, v_created_at)
  ON CONFLICT (project_space_id, user_id) DO UPDATE
    SET last_read_at = EXCLUDED.last_read_at
    WHERE EXCLUDED.last_read_at > project_message_read_status.last_read_at;
END;
$$;
