-- part_gj_mentions_table.sql
-- WHY: the live database has no public.mentions table (REST says PGRST205), but the posts trigger notify_post_mentions (part_aq_posts.sql) writes to it.
-- Result today: a post that contains an @mention or a tagged person fails with "relation public.mentions does not exist", and comment and
-- announcement mentions are lost silently. This file recreates the table, tighter than the old archive migration (people can only read mentions
-- they wrote or received, not everyone's), and the notification trigger that tells the person who was mentioned.
-- SAFE TO RE-RUN: yes (IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE).
--
-- PREFLIGHT (read only, run first):
--   select to_regclass('public.mentions');                                   -- NULL means the table is missing (expected)
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'notifications'
--     and column_name in ('user_id','trigger_user_id','type','title','message','action_url','related_id');   -- expect 7 rows
--
-- ROLLBACK: drop trigger trg_mention_notification on public.mentions; drop table public.mentions;  (posts with @mentions will fail again)

BEGIN;

CREATE TABLE IF NOT EXISTS public.mentions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioner_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  related_id    uuid NOT NULL,          -- the post, comment, chat message or announcement
  related_type  text NOT NULL CHECK (related_type IN ('post', 'chat_message', 'announcement')),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- a person can read mentions they wrote or received (nobody else's)
DROP POLICY IF EXISTS "Anyone can view mentions" ON public.mentions;
DROP POLICY IF EXISTS "Users see their own mentions" ON public.mentions;
CREATE POLICY "Users see their own mentions" ON public.mentions FOR SELECT TO authenticated
  USING (auth.uid() = mentioner_id OR auth.uid() = mentioned_id);

-- a person can only create a mention as themselves, and not of someone who has blocked them
DROP POLICY IF EXISTS "Users can create mentions" ON public.mentions;
CREATE POLICY "Users can create mentions" ON public.mentions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = mentioner_id
    AND NOT EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.user_id = mentioned_id AND b.blocked_user_id = mentioner_id)
  );

DROP POLICY IF EXISTS "Users can delete their own mentions" ON public.mentions;
CREATE POLICY "Users can delete their own mentions" ON public.mentions FOR DELETE TO authenticated
  USING (auth.uid() = mentioner_id);

REVOKE ALL ON public.mentions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.mentions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_mentions_mentioned ON public.mentions (mentioned_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioner ON public.mentions (mentioner_id);
CREATE INDEX IF NOT EXISTS idx_mentions_related   ON public.mentions (related_id, related_type);

-- tell the person who was mentioned (skipped if they blocked the mentioner)
CREATE OR REPLACE FUNCTION public.handle_new_mention_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
  v_url  text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.user_id = NEW.mentioned_id AND b.blocked_user_id = NEW.mentioner_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), username) INTO v_name FROM public.profiles WHERE id = NEW.mentioner_id;

  v_url := CASE NEW.related_type
             WHEN 'chat_message' THEN '/messages'
             WHEN 'announcement' THEN '/announcements'
             ELSE '/feed'
           END;

  -- only the columns that exist on every version of the notifications table (the person who triggered it is trigger_user_id)
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
  VALUES (
    NEW.mentioned_id, NEW.mentioner_id, 'mention', 'New Mention',
    COALESCE(v_name, 'Someone') || ' mentioned you in a ' || replace(NEW.related_type, '_', ' ') || '.',
    v_url, NEW.related_id
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_mention_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mention_notification ON public.mentions;
CREATE TRIGGER trg_mention_notification AFTER INSERT ON public.mentions
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_mention_notification();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- POST-CHECK (read only):
--   select to_regclass('public.mentions');                                                   -- now returns public.mentions
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'mentions';   -- 3 policies: select, insert, delete
--   Then post "hello @someone" as a test account: the post saves and @someone gets a "New Mention" notification (once, not twice).
