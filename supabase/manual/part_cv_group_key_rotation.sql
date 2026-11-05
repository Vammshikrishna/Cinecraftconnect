-- PART CV - chat key rotation, database side (audit step 10). Safe to run before any app update: old apps keep working.
--
-- Today each private room / project space has ONE chat key, and removing someone does not change it. This part adds:
--   group_keys.epoch        which version of the chat key a stored copy belongs to (all existing keys become epoch 1)
--   group_key_state         per chat: the current epoch, and whether a rotation is waiting ("a member was removed")
--   group_key_history       each member's wrapped copy of OLDER keys, so old messages stay readable after a rotation
--   rotate_group_key(...)   the one way to move a chat to a new key; atomic; the next remaining member's app calls it
--   a trigger that, when someone is removed from a room / space, deletes their key copies and flags the chat for rotation
--
-- Old apps (which know nothing about epochs) keep working: any key copy they save is stamped with the chat's current epoch.
-- Staff access grants that expire do NOT rotate the key yet (the staff member keeps the key they were given); that is a
-- separate follow-up.

-- ---------------------------------------------------------------------------
-- 1. Tables and column
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_keys ADD COLUMN IF NOT EXISTS epoch integer;
UPDATE public.group_keys SET epoch = 1 WHERE epoch IS NULL;
ALTER TABLE public.group_keys ALTER COLUMN epoch SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.group_key_state (
  target_type    text NOT NULL CHECK (target_type IN ('room', 'project_space')),
  target_id      uuid NOT NULL,
  epoch          integer NOT NULL DEFAULT 1,
  needs_rotation boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS public.group_key_history (
  target_type            text NOT NULL CHECK (target_type IN ('room', 'project_space')),
  target_id              uuid NOT NULL,
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  epoch                  integer NOT NULL,
  encrypted_symmetric_key text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id, user_id, epoch)
);

ALTER TABLE public.group_key_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_key_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_key_state, public.group_key_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.group_key_state, public.group_key_history TO authenticated;
GRANT ALL ON public.group_key_state, public.group_key_history TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Who belongs to a chat
-- ---------------------------------------------------------------------------
-- Real members and creators (not staff observers).
CREATE OR REPLACE FUNCTION public.cv_is_group_member(p_type text, p_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_uid IS NOT NULL AND CASE p_type
    WHEN 'project_space' THEN
      EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = p_id AND m.user_id = p_uid)
      OR public.cj_can_manage_space(p_id, p_uid)
    WHEN 'room' THEN
      EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = p_id AND m.user_id = p_uid)
      OR EXISTS (SELECT 1 FROM public.discussion_rooms r WHERE r.id = p_id AND r.creator_id = p_uid)
    ELSE false
  END;
$function$;

-- Members plus staff who hold an active access grant (they are given the key too).
CREATE OR REPLACE FUNCTION public.cv_can_see_group(p_type text, p_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.cv_is_group_member(p_type, p_id, p_uid)
      OR EXISTS (SELECT 1 FROM public.space_access_grants g
                  WHERE g.user_id = p_uid AND g.target_type = p_type AND g.target_id = p_id::text AND g.expires_at > now());
$function$;

REVOKE ALL ON FUNCTION public.cv_is_group_member(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cv_can_see_group(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cv_is_group_member(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cv_can_see_group(text, uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Members read key state" ON public.group_key_state;
CREATE POLICY "Members read key state" ON public.group_key_state
  FOR SELECT TO authenticated
  USING (public.cv_can_see_group(target_type, target_id, auth.uid()));

DROP POLICY IF EXISTS "Read own key history" ON public.group_key_history;
CREATE POLICY "Read own key history" ON public.group_key_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Every saved key copy is stamped with the chat's current epoch (or refused if an app claims another one)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cv_stamp_group_key_epoch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_epoch integer;
BEGIN
  IF current_setting('cv.rotating', true) = '1' THEN
    RETURN NEW;  -- rotate_group_key sets the epoch itself
  END IF;
  SELECT s.epoch INTO v_epoch FROM public.group_key_state s WHERE s.target_type = NEW.target_type AND s.target_id = NEW.target_id;
  v_epoch := COALESCE(v_epoch, 1);
  IF NEW.epoch IS NULL THEN
    NEW.epoch := v_epoch;
  ELSIF NEW.epoch <> v_epoch THEN
    RAISE EXCEPTION 'KEY_EPOCH_STALE: the chat key has changed, reload and try again' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_cv_stamp_group_key_epoch ON public.group_keys;
CREATE TRIGGER a_cv_stamp_group_key_epoch
  BEFORE INSERT OR UPDATE ON public.group_keys
  FOR EACH ROW EXECUTE FUNCTION public.cv_stamp_group_key_epoch();

-- ---------------------------------------------------------------------------
-- 4. Removing someone deletes their key copies and flags the chat for rotation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cv_on_member_removed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type text;
  v_id uuid;
  v_exists boolean;
BEGIN
  IF TG_TABLE_NAME = 'project_space_members' THEN
    v_type := 'project_space'; v_id := OLD.project_space_id;
    SELECT EXISTS (SELECT 1 FROM public.project_spaces WHERE id = v_id) INTO v_exists;
  ELSE
    v_type := 'room'; v_id := OLD.room_id;
    SELECT EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = v_id) INTO v_exists;
  END IF;

  IF NOT v_exists THEN
    -- the whole chat is being deleted: clean up instead of flagging
    DELETE FROM public.group_key_state WHERE target_type = v_type AND target_id = v_id;
    DELETE FROM public.group_key_history WHERE target_type = v_type AND target_id = v_id;
    DELETE FROM public.group_keys WHERE target_type = v_type AND target_id = v_id;
    RETURN OLD;
  END IF;

  -- chats without any chat key (public rooms) have nothing to rotate
  IF NOT EXISTS (SELECT 1 FROM public.group_keys WHERE target_type = v_type AND target_id = v_id) THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.group_keys WHERE target_type = v_type AND target_id = v_id AND user_id = OLD.user_id;
  DELETE FROM public.group_key_history WHERE target_type = v_type AND target_id = v_id AND user_id = OLD.user_id;

  INSERT INTO public.group_key_state (target_type, target_id, epoch, needs_rotation, updated_at)
  VALUES (v_type, v_id, 1, true, now())
  ON CONFLICT (target_type, target_id) DO UPDATE SET needs_rotation = true, updated_at = now();
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS cv_member_removed ON public.project_space_members;
CREATE TRIGGER cv_member_removed
  AFTER DELETE ON public.project_space_members
  FOR EACH ROW EXECUTE FUNCTION public.cv_on_member_removed();

DROP TRIGGER IF EXISTS cv_member_removed ON public.room_members;
CREATE TRIGGER cv_member_removed
  AFTER DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.cv_on_member_removed();

-- ---------------------------------------------------------------------------
-- 5. rotate_group_key: move a chat to a new key, atomically
--    p_rows = [{ "user_id": "...", "encrypted_symmetric_key": "..." }, ...]  the NEW key wrapped for each person
--    Rules: the caller must be a current member; the new epoch must be exactly current + 1 (so two people rotating at
--    once cannot both win); keys are accepted only for current members / staff with an active grant; the caller's own
--    copy must be included. Each person's existing key copy is first moved to their history, so old messages stay readable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_group_key(p_type text, p_id uuid, p_new_epoch integer, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_state public.group_key_state%ROWTYPE;
  v_saved integer := 0;
  v_self boolean := false;
  e jsonb;
  v_user uuid;
  v_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('room', 'project_space') OR p_id IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Bad request' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'Too many members' USING ERRCODE = '22023';
  END IF;
  IF NOT public.cv_is_group_member(p_type, p_id, v_uid) THEN
    RAISE EXCEPTION 'Only a member of this chat can change its key' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.group_key_state (target_type, target_id) VALUES (p_type, p_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_state FROM public.group_key_state WHERE target_type = p_type AND target_id = p_id FOR UPDATE;

  IF p_new_epoch IS DISTINCT FROM v_state.epoch + 1 THEN
    RAISE EXCEPTION 'EPOCH_CONFLICT: the chat key was already changed' USING ERRCODE = '40001';
  END IF;

  -- validate the new copies first (only for people who may hold the key; the caller must be one of them)
  FOR e IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_user := NULLIF(e ->> 'user_id', '')::uuid;
    v_key := e ->> 'encrypted_symmetric_key';
    IF v_user IS NULL OR COALESCE(v_key, '') = '' OR length(v_key) > 4000 THEN
      RAISE EXCEPTION 'Bad key row' USING ERRCODE = '22023';
    END IF;
    IF NOT public.cv_can_see_group(p_type, p_id, v_user) THEN
      RAISE EXCEPTION 'A key was offered for someone who is not in this chat' USING ERRCODE = '42501';
    END IF;
    IF v_user = v_uid THEN v_self := true; END IF;
  END LOOP;
  IF NOT v_self THEN
    RAISE EXCEPTION 'Your own copy of the new key must be included' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('cv.rotating', '1', true);

  -- 1. keep everyone's current (old) copy as history
  INSERT INTO public.group_key_history (target_type, target_id, user_id, epoch, encrypted_symmetric_key)
  SELECT gk.target_type, gk.target_id, gk.user_id, gk.epoch, gk.encrypted_symmetric_key
    FROM public.group_keys gk
   WHERE gk.target_type = p_type AND gk.target_id = p_id
     AND public.cv_can_see_group(p_type, p_id, gk.user_id)
  ON CONFLICT DO NOTHING;

  -- 2. remove all current copies (including any left behind by people who are no longer in the chat)
  DELETE FROM public.group_keys WHERE target_type = p_type AND target_id = p_id;

  -- 3. store the new copies
  FOR e IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.group_keys (target_type, target_id, user_id, encrypted_symmetric_key, epoch)
    VALUES (p_type, p_id, (e ->> 'user_id')::uuid, e ->> 'encrypted_symmetric_key', p_new_epoch)
    ON CONFLICT (target_type, target_id, user_id) DO UPDATE
      SET encrypted_symmetric_key = EXCLUDED.encrypted_symmetric_key, epoch = EXCLUDED.epoch;
    v_saved := v_saved + 1;
  END LOOP;

  UPDATE public.group_key_state
     SET epoch = p_new_epoch, needs_rotation = false, updated_at = now()
   WHERE target_type = p_type AND target_id = p_id;

  PERFORM set_config('cv.rotating', '', true);
  RETURN p_new_epoch;
END;
$function$;

REVOKE ALL ON FUNCTION public.rotate_group_key(text, uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_group_key(text, uuid, integer, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rollback (only if needed):
--   DROP TRIGGER cv_member_removed ON public.project_space_members; DROP TRIGGER cv_member_removed ON public.room_members;
--   DROP TRIGGER a_cv_stamp_group_key_epoch ON public.group_keys;
--   DROP FUNCTION public.rotate_group_key(text, uuid, integer, jsonb);
-- (the tables and the epoch column can stay; nothing reads them yet)
-- ---------------------------------------------------------------------------
