-- PART FS (rooms) - private rooms get a "Who can find this room" setting (Hidden / Listed), so people can see a LISTED private room's card and ask to join.
-- Safe to run more than once. Default for every existing and new room is 'hidden' = today's behaviour (a private room is invisible to non-members).
--
-- WHAT THIS ADDS
--  1. discussion_rooms.discoverability text ('hidden' | 'listed'), default 'hidden'. The room admin chooses it in Room settings > Privacy.
--  2. A SELECT policy so everyone can see the row of a LISTED room (plain column test: it cannot recurse). Messages and members of a private room stay members-only.
--  3. room_join_requests: one pending request per person per room (unique index), an optional message (column already exists), and a BEFORE INSERT check that refuses
--     a request when the room is not listed (or is public), the person is already a member, is banned, or is blocked by / has blocked the room owner.
--  4. Admins (not only the owner) can read, approve (update) and delete requests, and add the approved person to room_members (policies use the cm_* helper functions from part FM).
--  5. When a request is approved or rejected the requester gets a notification ("Request approved" / "Request not accepted").
--
-- PREFLIGHT (read only):
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'discussion_rooms' and column_name = 'discoverability';   -- 0 rows now
--   select policyname, cmd from pg_policies where tablename = 'room_join_requests' order by 2, 1;
-- POST-CHECK (read only): the first query returns 1 row; select policyname from pg_policies where tablename = 'discussion_rooms' and policyname = 'cm_discussion_rooms_listed_select';  -> 1 row.
--   Then: make a private room, set Privacy > "Who can find this room" = Listed, open the Discussion rooms page with another account: the room shows with a lock and "Request to join".
-- ROLLBACK: drop policy cm_discussion_rooms_listed_select on public.discussion_rooms; update public.discussion_rooms set discoverability = 'hidden';

SET lock_timeout = '5s';

-- 1. the column
ALTER TABLE public.discussion_rooms ADD COLUMN IF NOT EXISTS discoverability text NOT NULL DEFAULT 'hidden';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.discussion_rooms'::regclass AND conname = 'discussion_rooms_discoverability_check') THEN
    ALTER TABLE public.discussion_rooms ADD CONSTRAINT discussion_rooms_discoverability_check CHECK (discoverability IN ('hidden', 'listed'));
  END IF;
END $$;

-- helper functions (row security off, so they never recurse). Same names as part FM; replacing them is harmless.
CREATE OR REPLACE FUNCTION public.cm_room_is_creator(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.discussion_rooms dr WHERE dr.id = p_room AND dr.creator_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cm_room_is_member(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = p_room AND rm.user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cm_room_is_admin(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = p_room AND rm.user_id = auth.uid() AND lower(COALESCE(rm.role, '')) IN ('admin', 'owner', 'moderator'));
$$;
REVOKE ALL ON FUNCTION public.cm_room_is_creator(uuid), public.cm_room_is_member(uuid), public.cm_room_is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cm_room_is_creator(uuid), public.cm_room_is_member(uuid), public.cm_room_is_admin(uuid) TO anon, authenticated, service_role;

-- 2. everybody can see the row of a LISTED room
DROP POLICY IF EXISTS cm_discussion_rooms_listed_select ON public.discussion_rooms;
CREATE POLICY cm_discussion_rooms_listed_select ON public.discussion_rooms FOR SELECT
  TO authenticated USING (discoverability = 'listed');

-- 3. join requests: one pending per person and room, optional message, and the rules
ALTER TABLE public.room_join_requests ADD COLUMN IF NOT EXISTS message text;
-- tidy: if the same person somehow has several pending rows for a room, keep the newest
DELETE FROM public.room_join_requests a USING public.room_join_requests b
 WHERE a.status = 'pending' AND b.status = 'pending' AND a.room_id = b.room_id AND a.user_id = b.user_id
   AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id::text < b.id::text));
CREATE UNIQUE INDEX IF NOT EXISTS room_join_requests_one_pending ON public.room_join_requests (room_id, user_id) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.cm_check_room_join_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  v_room record;
BEGIN
  SELECT id, room_type, creator_id, discoverability INTO v_room FROM public.discussion_rooms WHERE id = NEW.room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This room does not exist.' USING ERRCODE = 'P0001';
  END IF;
  IF v_room.room_type = 'public' THEN
    RAISE EXCEPTION 'This room is public: you can join it directly.' USING ERRCODE = 'P0001';
  END IF;
  IF v_room.discoverability IS DISTINCT FROM 'listed' THEN
    RAISE EXCEPTION 'This room does not take join requests.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.room_members WHERE room_id = NEW.room_id AND user_id = NEW.user_id) OR v_room.creator_id = NEW.user_id THEN
    RAISE EXCEPTION 'You are already in this room.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND COALESCE(is_banned, false)) THEN
    RAISE EXCEPTION 'Your account cannot send join requests.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_room.creator_id AND b.blocked_user_id = NEW.user_id)
                 OR (b.user_id = NEW.user_id AND b.blocked_user_id = v_room.creator_id)) THEN
    RAISE EXCEPTION 'You cannot ask to join this room.' USING ERRCODE = 'P0001';
  END IF;
  NEW.status := 'pending';
  IF NEW.message IS NOT NULL THEN NEW.message := left(btrim(NEW.message), 300); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_check_room_join_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cm_room_join_request_check ON public.room_join_requests;
CREATE TRIGGER cm_room_join_request_check BEFORE INSERT ON public.room_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.cm_check_room_join_request();

-- 4. admins (not only the owner) manage requests and can add the approved person
DROP POLICY IF EXISTS cm_room_requests_admin_select ON public.room_join_requests;
CREATE POLICY cm_room_requests_admin_select ON public.room_join_requests FOR SELECT
  USING (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id));
DROP POLICY IF EXISTS cm_room_requests_admin_update ON public.room_join_requests;
CREATE POLICY cm_room_requests_admin_update ON public.room_join_requests FOR UPDATE
  USING (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id))
  WITH CHECK (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id));
DROP POLICY IF EXISTS cm_room_requests_admin_delete ON public.room_join_requests;
CREATE POLICY cm_room_requests_admin_delete ON public.room_join_requests FOR DELETE
  USING (public.cm_room_is_creator(room_id) OR public.cm_room_is_admin(room_id));
DROP POLICY IF EXISTS cm_room_members_admin_add ON public.room_members;
CREATE POLICY cm_room_members_admin_add ON public.room_members FOR INSERT
  WITH CHECK (public.cm_room_is_admin(room_id) AND (role IS NULL OR lower(role) = 'member'));

-- 5. tell the requester
CREATE OR REPLACE FUNCTION public.cm_notify_room_request_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  v_title text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO v_title FROM public.discussion_rooms WHERE id = NEW.room_id;
  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (NEW.user_id, auth.uid(), 'project_update', 'Request approved',
            'You can now join the private room "' || COALESCE(v_title, 'Room') || '".', '/discussion-rooms/' || NEW.room_id, NEW.room_id);
  ELSIF NEW.status IN ('rejected', 'declined', 'denied') THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (NEW.user_id, auth.uid(), 'project_update', 'Request not accepted',
            'Your request to join "' || COALESCE(v_title, 'the room') || '" was not accepted this time.', '/discussion-rooms', NEW.room_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cm_notify_room_request_decision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cm_room_request_decision_notify ON public.room_join_requests;
CREATE TRIGGER cm_room_request_decision_notify AFTER UPDATE OF status ON public.room_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.cm_notify_room_request_decision();

NOTIFY pgrst, 'reload schema';
