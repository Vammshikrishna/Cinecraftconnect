-- PART EL - close the "anyone can insert a row into dm_keys for anyone" policy. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND: public.dm_keys has the policy "Users can insert dm_keys for themselves or others" with WITH CHECK (true).
-- Any signed-in person could write a key row for ANY other person in ANY conversation. Because (conversation_id, user_id) is unique,
-- that also blocks the real key from ever being stored (a planted row wins).
-- WHY IT IS SAFE TO CLOSE: nothing in the website, the app, the packages or the edge functions reads or writes dm_keys any more
-- (searched all of them). The table is a leftover from the first E2EE draft; current E2EE uses the key vault and the group-key tables.
-- THE FIX: people may only insert a row for themselves. Read / update / delete already require auth.uid() = user_id.
--
-- PREFLIGHT (read only):  select policyname, cmd, with_check from pg_policies where schemaname = 'public' and tablename = 'dm_keys' order by 1;
--                         select count(*) from public.dm_keys;   -- just to see how many old rows exist; they are not touched
-- POST-CHECK (read only): select policyname, cmd, with_check from pg_policies where schemaname = 'public' and tablename = 'dm_keys' and cmd = 'INSERT';
--                         -- expect 1 row: Users can insert own dm_keys | INSERT | (auth.uid() = user_id)

DROP POLICY IF EXISTS "Users can insert dm_keys for themselves or others" ON public.dm_keys;
DROP POLICY IF EXISTS "Users can insert own dm_keys" ON public.dm_keys;
CREATE POLICY "Users can insert own dm_keys"
  ON public.dm_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
