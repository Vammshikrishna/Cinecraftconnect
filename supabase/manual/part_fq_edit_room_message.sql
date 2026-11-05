-- PART FQ (edit messages) - lets people edit their own recent message in discussion rooms and project-space chat. Safe to run more than once.
--
-- WHAT THIS ADDS: an edited_at column on room_messages and project_space_messages, a trigger that (a) sets edited_at when the TEXT changes and (b) refuses a text edit by
-- the author after 15 minutes, on a deleted message, or on a message with media / a share card, and an UPDATE policy so an author can edit their own row.
-- Staff and other server code that change a message for other reasons (deleting it, moderation) are NOT affected: the rule only applies when the signed-in
-- person is the author and the new row is not being deleted. The website sends only the new text (encrypted in private rooms and in project spaces).
-- The website works before this part is run (the edit is just not time-limited or marked as edited by the server).
--
-- PREFLIGHT (read only): select table_name, column_name from information_schema.columns where table_schema = 'public'
--   and table_name in ('room_messages', 'project_space_messages') and column_name = 'edited_at';    -- 0 rows before, 2 rows after
-- POST-CHECK  (read only): select tgname from pg_trigger where tgrelid in ('public.room_messages'::regclass, 'public.project_space_messages'::regclass) and tgname = 'trg_message_edit_window';  -- 2 rows

SET lock_timeout = '5s';

ALTER TABLE public.room_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.project_space_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.message_edit_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_old jsonb := to_jsonb(OLD);
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     AND auth.uid() IS NOT NULL
     AND OLD.user_id = auth.uid()
     AND COALESCE(NEW.is_deleted, false) = false THEN
    IF COALESCE(OLD.is_deleted, false) THEN
      RAISE EXCEPTION 'This message was deleted' USING ERRCODE = 'P0001';
    END IF;
    IF now() - OLD.created_at > interval '15 minutes' THEN
      RAISE EXCEPTION 'The edit window (15 minutes) has passed' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_old ->> 'media_url', v_old ->> 'attachment_url', '') <> '' THEN
      RAISE EXCEPTION 'Messages with a photo, video or file cannot be edited' USING ERRCODE = 'P0001';
    END IF;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.message_edit_window() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_message_edit_window ON public.room_messages;
CREATE TRIGGER trg_message_edit_window BEFORE UPDATE ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.message_edit_window();
DROP TRIGGER IF EXISTS trg_message_edit_window ON public.project_space_messages;
CREATE TRIGGER trg_message_edit_window BEFORE UPDATE ON public.project_space_messages FOR EACH ROW EXECUTE FUNCTION public.message_edit_window();

-- the author may update their own row (the trigger above limits WHAT may change and WHEN)
DROP POLICY IF EXISTS "Authors edit own messages (part FQ)" ON public.room_messages;
CREATE POLICY "Authors edit own messages (part FQ)" ON public.room_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Authors edit own messages (part FQ)" ON public.project_space_messages;
CREATE POLICY "Authors edit own messages (part FQ)" ON public.project_space_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
