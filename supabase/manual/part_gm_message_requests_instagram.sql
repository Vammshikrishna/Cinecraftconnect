-- PART GM - message requests, Instagram style: Hidden requests, Deleted requests (30 days), restore. Safe to run more than once.
-- RUN AFTER part_gf_message_requests.sql (it stops with a clear message if part GF is missing).
--
-- WHAT THIS ADDS (on top of part GF, whose table and functions are reused):
--  * message_request_states gets: status 'pending' (a request that nobody answered yet, now stored), columns hidden (filtered as possible spam) and deleted_at.
--  * CLASSIFICATION: when a message that is a request arrives (BEFORE INSERT trigger trg_dm_request_classify) the request is marked HIDDEN when
--      - the message has a link (http://, https://, www., or name.com / .net / .org / .io ... patterns), or
--      - the message has a word from the app's profanity list (the same 15 words as the room chat filter, with the same endings s/es/ed/ing/in/y), or
--      - the sender has NO profile photo AND the account is less than 24 hours old.
--    Once hidden, a request stays hidden (a later clean message does not unhide it). Share cards (POST_SHARE:: ...) are not scanned for links.
--    LIMIT: encrypted messages are opaque to the database, so for them ONLY the sender signal (no photo + new account) is used. Links / words inside encrypted text cannot be seen here.
--    KEEP IN SYNC: the word list below must match apps/web/src/lib/messageRequests.ts (REQUEST_PROFANITY) and the room chat list; a unit test compares them.
--  * HIDDEN requests: not in the main Requests list, not counted in the badge, and NO push / notification (trigger_push_delivery is patched below to skip them). The receiver can still open "Hidden requests" and Accept or Delete them.
--  * DELETE: respond_message_request(sender, 'delete') (same as 'decline') hides the request and stamps deleted_at. "Recently deleted" lists them for 30 days; after that they are 'expired' (kept out of the lists AND out of the normal chat list, never shown again).
--    'restore' puts a deleted or ignored request back in the main Requests list. 'ignore' stays a silent move to the Hidden folder. 'accept' moves the chat to the normal list. The sender is never told anything: they keep seeing "Waiting for them to accept".
--  * get_message_requests_v2() -> all my requests with bucket = main | hidden | deleted | expired (+ username, verified, last message time, deleted_at).
--    get_message_requests() (the old one, same columns) keeps working and now reports hidden = true for every bucket except main, so the OLD website / app build simply shows fewer requests.
--  * the 3-message cap, privacy refusal and sender messages are NOT changed.
--  * Security pattern: bodies live in app_private (definer), the public functions are SECURITY INVOKER wrappers with pinned search_path, nothing for anon / PUBLIC. RLS on the table is unchanged (only the receiver reads their own rows).
-- The website and app work before this part is run: they fall back to the old single Requests list (no Hidden, no Recently deleted).
-- ASSUMPTION: the push trigger function is public.trigger_push_delivery() (part CM). It is patched in place (a guard line is added once); if it is missing the patch is skipped with a NOTICE. If the older webhook trigger "Push Delivery - DMs" still exists on direct_messages it would still send pushes for hidden requests: drop it if the audit shows both.
--
-- PREFLIGHT (read only):
--   select to_regclass('public.message_request_states') as gf_table, to_regprocedure('public.get_message_requests()') as gf_fn, to_regprocedure('public.get_message_requests_v2()') as gm_fn;   -- gf_* filled, gm_fn null before
--   select column_name from information_schema.columns where table_name = 'message_request_states';   -- hidden / deleted_at missing before
-- POST-CHECK (read only):
--   select to_regprocedure('public.get_message_requests_v2()');   -- filled
--   select tgname from pg_trigger where tgrelid = 'public.direct_messages'::regclass and tgname in ('trg_dm_request_cap', 'trg_dm_request_classify');   -- 2 rows
--   select column_name from information_schema.columns where table_name = 'message_request_states' and column_name in ('hidden', 'deleted_at');   -- 2 rows
--   select pg_get_functiondef('public.trigger_push_delivery()'::regprocedure) like '%dm_request_is_hidden%';   -- true
--   as a signed-in person: select partner_id, bucket from public.get_message_requests_v2();   -- 0 rows is fine
-- ROLLBACK: drop trigger trg_dm_request_classify on public.direct_messages; the website falls back by itself if get_message_requests_v2 is dropped.

SET lock_timeout = '5s';

DO $do$
BEGIN
  IF to_regclass('public.message_request_states') IS NULL OR to_regprocedure('public.dm_is_request(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run part_gf_message_requests.sql first (the message request table and functions are missing).';
  END IF;
END
$do$;

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

-- ── 1. table: pending status, hidden flag, deleted_at ──
ALTER TABLE public.message_request_states ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.message_request_states ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $do$
DECLARE c record;
BEGIN
  -- replace the old status check (accepted | declined | ignored) by one that also allows 'pending'
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.message_request_states'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%' AND pg_get_constraintdef(oid) NOT ILIKE '%pending%'
  LOOP
    EXECUTE format('ALTER TABLE public.message_request_states DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.message_request_states'::regclass AND conname = 'message_request_states_status_check') THEN
    ALTER TABLE public.message_request_states
      ADD CONSTRAINT message_request_states_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'ignored'));
  END IF;
END
$do$;

-- ── 2. classification helpers (private) ──
CREATE OR REPLACE FUNCTION app_private.dm_content_flagged(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_text IS NOT NULL
    -- encrypted payloads and share cards are not scanned
    AND p_text !~ '^\s*\{'
    AND p_text NOT LIKE '%__e2ee%'
    AND p_text !~ '^[A-Z_]+_SHARE::'
    AND (
      -- a link
      p_text ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|co|ly|me|xyz|info|ru|cn|app|link|site|top)\M)'
      -- the profanity list (same words and endings as the room chat filter)
      OR p_text ~* '\m(fuck|fucker|motherfucker|shit|bullshit|bitch|bastard|asshole|cunt|slut|whore|dickhead|prick|wanker|bollocks)(s|es|ed|ing|in|y)?\M'
    );
$$;
REVOKE ALL ON FUNCTION app_private.dm_content_flagged(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.dm_sender_looks_new(p_sender uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(btrim(p.avatar_url), '') = '' AND u.created_at > now() - interval '24 hours'
       FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = p_sender),
    false);
$$;
REVOKE ALL ON FUNCTION app_private.dm_sender_looks_new(uuid) FROM PUBLIC, anon, authenticated;

-- "is this sender -> receiver message currently in the hidden folder?" (used to skip the push)
CREATE OR REPLACE FUNCTION app_private.dm_request_is_hidden(p_sender uuid, p_receiver uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.dm_is_request(p_sender, p_receiver)
    AND EXISTS (SELECT 1 FROM public.message_request_states s
                 WHERE s.receiver_id = p_receiver AND s.sender_id = p_sender
                   AND ((s.status = 'pending' AND s.hidden) OR s.status IN ('ignored', 'declined'))),
    false);
$$;
REVOKE ALL ON FUNCTION app_private.dm_request_is_hidden(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. classify when a request message arrives (runs after the cap trigger, before the push trigger) ──
CREATE OR REPLACE FUNCTION app_private.dm_request_classify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_flag boolean;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.dm_is_request(NEW.sender_id, NEW.receiver_id) THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM public.message_request_states
   WHERE receiver_id = NEW.receiver_id AND sender_id = NEW.sender_id;
  IF v_status IS NOT NULL AND v_status <> 'pending' THEN
    RETURN NEW;
  END IF;
  v_flag := app_private.dm_content_flagged(NEW.content) OR app_private.dm_sender_looks_new(NEW.sender_id);
  INSERT INTO public.message_request_states (receiver_id, sender_id, status, hidden, updated_at)
  VALUES (NEW.receiver_id, NEW.sender_id, 'pending', v_flag, now())
  ON CONFLICT (receiver_id, sender_id) DO UPDATE
    SET hidden = public.message_request_states.hidden OR EXCLUDED.hidden
    WHERE public.message_request_states.status = 'pending';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;   -- classifying must never block sending a message
END;
$$;
REVOKE ALL ON FUNCTION app_private.dm_request_classify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dm_request_classify ON public.direct_messages;
CREATE TRIGGER trg_dm_request_classify
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION app_private.dm_request_classify();

-- ── 4. one-time backfill: requests that are waiting now get a pending row with their hidden flag ──
INSERT INTO public.message_request_states (receiver_id, sender_id, status, hidden)
SELECT g.receiver_id, g.sender_id, 'pending',
       g.flagged OR app_private.dm_sender_looks_new(g.sender_id)
FROM (
  SELECT d.receiver_id, d.sender_id, bool_or(app_private.dm_content_flagged(d.content)) AS flagged
  FROM public.direct_messages d
  WHERE d.sender_id <> d.receiver_id AND COALESCE(d.is_deleted, false) = false
  GROUP BY d.receiver_id, d.sender_id
) g
WHERE NOT EXISTS (SELECT 1 FROM public.message_request_states s WHERE s.receiver_id = g.receiver_id AND s.sender_id = g.sender_id)
  AND public.dm_is_request(g.sender_id, g.receiver_id)
ON CONFLICT DO NOTHING;

-- ── 5. my requests, all buckets ──
CREATE OR REPLACE FUNCTION app_private.get_message_requests_v2()
RETURNS TABLE (
  partner_id uuid, full_name text, username text, avatar_url text, is_verified boolean, account_type text,
  first_message text, first_message_at timestamptz, last_message_at timestamptz,
  message_count int, unread_count int, mutual_count int,
  bucket text, deleted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  senders AS (
    SELECT d.sender_id,
           count(*)::int AS message_count,
           count(*) FILTER (WHERE d.is_read = false)::int AS unread_count,
           min(d.created_at) AS first_at,
           max(d.created_at) AS last_at
    FROM public.direct_messages d, me
    WHERE d.receiver_id = me.id AND d.sender_id <> me.id AND COALESCE(d.is_deleted, false) = false
    GROUP BY d.sender_id
  ),
  reqs AS (
    SELECT s.*, COALESCE(st.status, 'pending') AS st, COALESCE(st.hidden, false) AS flagged,
           CASE WHEN st.status = 'declined' THEN COALESCE(st.deleted_at, st.updated_at) END AS del_at
    FROM senders s
    CROSS JOIN me
    LEFT JOIN public.message_request_states st ON st.receiver_id = me.id AND st.sender_id = s.sender_id
    WHERE me.id IS NOT NULL
      AND public.dm_is_request(s.sender_id, me.id)
      AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                       WHERE (b.user_id = me.id AND b.blocked_user_id = s.sender_id)
                          OR (b.user_id = s.sender_id AND b.blocked_user_id = me.id))
  )
  SELECT r.sender_id, p.full_name, p.username, p.avatar_url, COALESCE(p.is_verified, false), p.account_type::text,
         (SELECT d.content FROM public.direct_messages d
           WHERE d.sender_id = r.sender_id AND d.receiver_id = (SELECT id FROM me) AND COALESCE(d.is_deleted, false) = false
           ORDER BY d.created_at ASC LIMIT 1),
         r.first_at, r.last_at, r.message_count, r.unread_count,
         (SELECT count(*)::int FROM (
            SELECT CASE WHEN c.follower_id = (SELECT id FROM me) THEN c.following_id ELSE c.follower_id END AS x
              FROM public.user_connections c
             WHERE c.status = 'accepted' AND (SELECT id FROM me) IN (c.follower_id, c.following_id)
            INTERSECT
            SELECT CASE WHEN c.follower_id = r.sender_id THEN c.following_id ELSE c.follower_id END
              FROM public.user_connections c
             WHERE c.status = 'accepted' AND r.sender_id IN (c.follower_id, c.following_id)
          ) m),
         CASE
           WHEN r.st = 'declined' AND r.del_at > now() - interval '30 days' THEN 'deleted'
           WHEN r.st = 'declined' THEN 'expired'
           WHEN r.st = 'ignored' THEN 'hidden'
           WHEN r.flagged THEN 'hidden'
           ELSE 'main'
         END,
         r.del_at
  FROM reqs r
  JOIN public.profiles p ON p.id = r.sender_id
  ORDER BY r.last_at DESC;
$$;
REVOKE ALL ON FUNCTION app_private.get_message_requests_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.get_message_requests_v2() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_message_requests_v2()
RETURNS TABLE (
  partner_id uuid, full_name text, username text, avatar_url text, is_verified boolean, account_type text,
  first_message text, first_message_at timestamptz, last_message_at timestamptz,
  message_count int, unread_count int, mutual_count int,
  bucket text, deleted_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ SELECT * FROM app_private.get_message_requests_v2(); $$;
REVOKE ALL ON FUNCTION public.get_message_requests_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_requests_v2() TO authenticated;

-- the old function keeps its columns; everything that is not in the main list counts as "hidden" for old builds
CREATE OR REPLACE FUNCTION public.get_message_requests()
RETURNS TABLE (
  partner_id uuid, full_name text, avatar_url text, account_type text,
  first_message text, first_message_at timestamptz, message_count int, unread_count int,
  mutual_count int, hidden boolean
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT v.partner_id, v.full_name, v.avatar_url, v.account_type, v.first_message, v.first_message_at,
         v.message_count, v.unread_count, v.mutual_count, (v.bucket <> 'main')
  FROM app_private.get_message_requests_v2() v;
$$;
REVOKE ALL ON FUNCTION public.get_message_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_requests() TO authenticated;

-- ── 6. answer: accept | decline | delete | ignore | restore ──
CREATE OR REPLACE FUNCTION app_private.respond_message_request(p_sender uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_action text := lower(coalesce(p_action, ''));
  v_status text;
  v_rows int;
BEGIN
  IF v_me IS NULL OR p_sender IS NULL OR p_sender = v_me THEN
    RETURN false;
  END IF;
  IF v_action = 'restore' THEN
    -- back to the main Requests list; only a deleted or ignored request can be restored
    UPDATE public.message_request_states
       SET status = 'pending', hidden = false, deleted_at = NULL, updated_at = now()
     WHERE receiver_id = v_me AND sender_id = p_sender AND status IN ('declined', 'ignored');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
  END IF;
  v_status := CASE v_action
                WHEN 'accept' THEN 'accepted'
                WHEN 'decline' THEN 'declined'
                WHEN 'delete' THEN 'declined'
                WHEN 'ignore' THEN 'ignored'
                ELSE NULL END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.message_request_states (receiver_id, sender_id, status, deleted_at, updated_at)
  VALUES (v_me, p_sender, v_status, CASE WHEN v_status = 'declined' THEN now() END, now())
  ON CONFLICT (receiver_id, sender_id) DO UPDATE
    SET status = EXCLUDED.status,
        deleted_at = CASE WHEN EXCLUDED.status = 'declined' THEN now() ELSE NULL END,
        updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.respond_message_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.respond_message_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_message_request(p_sender uuid, p_action text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ SELECT app_private.respond_message_request(p_sender, p_action); $$;
REVOKE ALL ON FUNCTION public.respond_message_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_message_request(uuid, text) TO authenticated;

-- ── 7. no push for hidden requests: add one guard line to trigger_push_delivery (once) ──
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'trigger_push_delivery' AND p.pronargs = 0;
  IF v_def IS NULL THEN
    RAISE NOTICE 'trigger_push_delivery() not found: push for hidden requests was NOT patched.';
    RETURN;
  END IF;
  IF v_def LIKE '%dm_request_is_hidden%' THEN
    RAISE NOTICE 'trigger_push_delivery() already patched.';
    RETURN;
  END IF;
  v_new := regexp_replace(
    v_def,
    '\mBEGIN\M',
    E'BEGIN\n    IF TG_TABLE_NAME = ''direct_messages'' THEN\n        IF app_private.dm_request_is_hidden(NEW.sender_id, NEW.receiver_id) THEN RETURN NEW; END IF;\n    END IF;',
    'i');
  IF v_new = v_def THEN
    RAISE NOTICE 'trigger_push_delivery() has no BEGIN block this part understands: NOT patched.';
    RETURN;
  END IF;
  EXECUTE v_new;
END
$do$;

NOTIFY pgrst, 'reload schema';
