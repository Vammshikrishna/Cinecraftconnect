-- PART GF - message requests inbox. Safe to run more than once.
--
-- WHAT THIS ADDS: when someone who is NOT a connection of yours (no accepted connection, no mutual follow) writes to you first, and you have never written back, that chat is a "request".
--  * table message_request_states (receiver_id, sender_id, status accepted | declined | ignored): the receiver's answer. Only the receiver can see their own rows; changes go through the functions below.
--  * get_message_requests()                  -> the requests waiting for me (and the ones I declined or ignored, with hidden = true so the website keeps them out of my normal list)
--  * respond_message_request(sender, action) -> 'accept' | 'decline' | 'ignore'. Decline and ignore are silent: the sender is not told, they just cannot send more.
--  * get_dm_request_state(partner)           -> for the SENDER: waiting = true after the first message until the other person accepts, with sent / cap / remaining
--  * trigger on direct_messages              -> until accepted, a sender can send at most 3 messages; after a decline or ignore, none. Connections, a reply from the receiver, staff and server code are never limited.
-- The existing "this user is not accepting messages from you" (connections-only setting) refusal in enforce_dm_privacy is NOT changed and still runs first.
-- The website works before this part is run: there is simply no Requests section and no cap.
-- FIRST RUN ONLY: chats that already exist one-way (someone wrote, the other never answered) are marked accepted, so nobody's current inbox suddenly changes.
--
-- PREFLIGHT (read only): select to_regclass('public.message_request_states'), to_regprocedure('public.get_message_requests()');   -- both null before
-- POST-CHECK  (read only): same query -> both filled; select tgname from pg_trigger where tgrelid = 'public.direct_messages'::regclass and tgname = 'trg_dm_request_cap';   -- 1 row
--   as a signed-in person: select * from public.get_message_requests();   -- 0 rows is fine

SET lock_timeout = '5s';

DO $$
DECLARE v_fresh boolean := to_regclass('public.message_request_states') IS NULL;
BEGIN
  IF v_fresh THEN
    CREATE TABLE public.message_request_states (
      receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      status      text NOT NULL CHECK (status IN ('accepted', 'declined', 'ignored')),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (receiver_id, sender_id),
      CHECK (receiver_id <> sender_id)
    );
    -- existing one-way chats stay where they are
    INSERT INTO public.message_request_states (receiver_id, sender_id, status)
    SELECT DISTINCT d.receiver_id, d.sender_id, 'accepted'
    FROM public.direct_messages d
    WHERE d.sender_id <> d.receiver_id
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS message_request_states_sender_idx ON public.message_request_states (sender_id);

ALTER TABLE public.message_request_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_request_states FROM anon, PUBLIC;
GRANT SELECT ON public.message_request_states TO authenticated;
GRANT ALL ON public.message_request_states TO service_role;

DROP POLICY IF EXISTS "Receiver reads own request states" ON public.message_request_states;
CREATE POLICY "Receiver reads own request states" ON public.message_request_states
  FOR SELECT TO authenticated
  USING (receiver_id = (SELECT auth.uid()));

-- ── helper: are these two people connected? (accepted connection in either direction, or following each other) ──
CREATE OR REPLACE FUNCTION public.dm_pair_connected(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.user_connections c
           WHERE c.status = 'accepted'
             AND ((c.follower_id = a AND c.following_id = b) OR (c.follower_id = b AND c.following_id = a)))
      OR (EXISTS (SELECT 1 FROM public.user_follows f WHERE f.follower_id = a AND f.following_id = b)
          AND EXISTS (SELECT 1 FROM public.user_follows f WHERE f.follower_id = b AND f.following_id = a));
$$;
REVOKE ALL ON FUNCTION public.dm_pair_connected(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── is "sender -> receiver" currently a request? ──
CREATE OR REPLACE FUNCTION public.dm_is_request(p_sender uuid, p_receiver uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_sender IS NOT NULL AND p_receiver IS NOT NULL AND p_sender <> p_receiver
    AND NOT EXISTS (SELECT 1 FROM public.direct_messages d WHERE d.sender_id = p_receiver AND d.receiver_id = p_sender)
    AND NOT EXISTS (SELECT 1 FROM public.message_request_states s
                    WHERE s.receiver_id = p_receiver AND s.sender_id = p_sender AND s.status = 'accepted')
    AND NOT public.dm_pair_connected(p_sender, p_receiver);
$$;
REVOKE ALL ON FUNCTION public.dm_is_request(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── the cap for the sender ──
CREATE OR REPLACE FUNCTION public.enforce_dm_request_cap()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_sent int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.sender_id OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;
  IF public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  IF NOT public.dm_is_request(NEW.sender_id, NEW.receiver_id) THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status FROM public.message_request_states
   WHERE receiver_id = NEW.receiver_id AND sender_id = NEW.sender_id;
  IF v_status IN ('declined', 'ignored') THEN
    RAISE EXCEPTION 'This person is not accepting messages from you right now.' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_sent FROM public.direct_messages
   WHERE sender_id = NEW.sender_id AND receiver_id = NEW.receiver_id AND COALESCE(is_deleted, false) = false;
  IF v_sent >= 3 THEN
    RAISE EXCEPTION 'Waiting for them to accept. You can send more once they accept your message request.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_dm_request_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_dm_request_cap ON public.direct_messages;
CREATE TRIGGER trg_dm_request_cap
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dm_request_cap();

-- ── my requests ──
CREATE OR REPLACE FUNCTION public.get_message_requests()
RETURNS TABLE (
  partner_id uuid, full_name text, avatar_url text, account_type text,
  first_message text, first_message_at timestamptz, message_count int, unread_count int,
  mutual_count int, hidden boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (SELECT auth.uid() AS id),
  senders AS (
    SELECT d.sender_id,
           count(*)::int AS message_count,
           count(*) FILTER (WHERE d.is_read = false)::int AS unread_count,
           min(d.created_at) AS first_at
    FROM public.direct_messages d, me
    WHERE d.receiver_id = me.id AND d.sender_id <> me.id AND COALESCE(d.is_deleted, false) = false
    GROUP BY d.sender_id
  ),
  reqs AS (
    SELECT s.*, COALESCE(st.status, 'pending') AS st
    FROM senders s
    CROSS JOIN me
    LEFT JOIN public.message_request_states st ON st.receiver_id = me.id AND st.sender_id = s.sender_id
    WHERE me.id IS NOT NULL
      AND public.dm_is_request(s.sender_id, me.id)
      AND NOT EXISTS (SELECT 1 FROM public.blocked_users b
                       WHERE (b.user_id = me.id AND b.blocked_user_id = s.sender_id)
                          OR (b.user_id = s.sender_id AND b.blocked_user_id = me.id))
  )
  SELECT r.sender_id, p.full_name, p.avatar_url, p.account_type::text,
         (SELECT d.content FROM public.direct_messages d
           WHERE d.sender_id = r.sender_id AND d.receiver_id = (SELECT id FROM me) AND COALESCE(d.is_deleted, false) = false
           ORDER BY d.created_at ASC LIMIT 1),
         r.first_at, r.message_count, r.unread_count,
         (SELECT count(*)::int FROM (
            SELECT CASE WHEN c.follower_id = (SELECT id FROM me) THEN c.following_id ELSE c.follower_id END AS x
              FROM public.user_connections c
             WHERE c.status = 'accepted' AND (SELECT id FROM me) IN (c.follower_id, c.following_id)
            INTERSECT
            SELECT CASE WHEN c.follower_id = r.sender_id THEN c.following_id ELSE c.follower_id END
              FROM public.user_connections c
             WHERE c.status = 'accepted' AND r.sender_id IN (c.follower_id, c.following_id)
          ) m),
         r.st <> 'pending'
  FROM reqs r
  JOIN public.profiles p ON p.id = r.sender_id
  ORDER BY r.first_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_message_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_requests() TO authenticated;

-- ── accept / decline / ignore ──
CREATE OR REPLACE FUNCTION public.respond_message_request(p_sender uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
BEGIN
  IF v_me IS NULL OR p_sender IS NULL OR p_sender = v_me THEN
    RETURN false;
  END IF;
  v_status := CASE lower(coalesce(p_action, ''))
                WHEN 'accept' THEN 'accepted'
                WHEN 'decline' THEN 'declined'
                WHEN 'ignore' THEN 'ignored'
                ELSE NULL END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.message_request_states (receiver_id, sender_id, status, updated_at)
  VALUES (v_me, p_sender, v_status, now())
  ON CONFLICT (receiver_id, sender_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_message_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_message_request(uuid, text) TO authenticated;

-- ── what the sender sees ──
CREATE OR REPLACE FUNCTION public.get_dm_request_state(p_partner uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_sent int;
  v_status text;
BEGIN
  IF v_me IS NULL OR p_partner IS NULL OR p_partner = v_me OR NOT public.dm_is_request(v_me, p_partner) THEN
    RETURN jsonb_build_object('waiting', false, 'sent', 0, 'cap', 3, 'remaining', 3, 'closed', false);
  END IF;
  SELECT count(*) INTO v_sent FROM public.direct_messages
   WHERE sender_id = v_me AND receiver_id = p_partner AND COALESCE(is_deleted, false) = false;
  SELECT status INTO v_status FROM public.message_request_states WHERE receiver_id = p_partner AND sender_id = v_me;
  RETURN jsonb_build_object(
    'waiting', v_sent > 0,
    'sent', v_sent,
    'cap', 3,
    'remaining', CASE WHEN v_status IN ('declined', 'ignored') THEN 0 ELSE greatest(0, 3 - v_sent) END,
    -- declined or ignored looks the same to the sender as reaching the cap: no extra detail is given
    'closed', v_status IN ('declined', 'ignored'));
END;
$$;
REVOKE ALL ON FUNCTION public.get_dm_request_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dm_request_state(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
