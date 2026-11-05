-- PART GE (1) - edit your own direct message. Safe to run more than once.
--
-- WHAT THIS ADDS: an edited_at column on direct_messages and a trigger that, when the SENDER changes the text of their own message, (a) refuses it after 15 minutes, on a deleted message,
-- or on a message with a photo, video or file, and (b) stamps edited_at so both people see "(edited)". The sender may already update their own row (policy "Users Update Own Direct
-- Messages" exists), so no new policy is needed. Reading a message (is_read), "Delete for me", unsending and moderation do NOT change the text, so they are not affected, and
-- server code without a signed-in person is not affected either. The website sends only the new text (encrypted again in an end-to-end encrypted chat).
-- The website works before this part is run (the edit is just not time-limited or marked as edited by the server).
--
-- PREFLIGHT (read only): select column_name from information_schema.columns where table_schema = 'public' and table_name = 'direct_messages' and column_name = 'edited_at';   -- 0 rows before
-- POST-CHECK  (read only): same query -> 1 row; select tgname from pg_trigger where tgrelid = 'public.direct_messages'::regclass and tgname = 'trg_dm_edit_window';   -- 1 row

SET lock_timeout = '5s';

ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.dm_edit_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     AND auth.uid() IS NOT NULL
     AND OLD.sender_id = auth.uid()
     AND COALESCE(NEW.is_deleted, false) = false THEN
    IF COALESCE(OLD.is_deleted, false) THEN
      RAISE EXCEPTION 'This message was deleted' USING ERRCODE = 'P0001';
    END IF;
    IF now() - OLD.created_at > interval '15 minutes' THEN
      RAISE EXCEPTION 'The edit window (15 minutes) has passed' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(OLD.attachment_url, '') <> '' THEN
      RAISE EXCEPTION 'Messages with a photo, video or file cannot be edited' USING ERRCODE = 'P0001';
    END IF;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dm_edit_window() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_dm_edit_window ON public.direct_messages;
CREATE TRIGGER trg_dm_edit_window BEFORE UPDATE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.dm_edit_window();

NOTIFY pgrst, 'reload schema';
