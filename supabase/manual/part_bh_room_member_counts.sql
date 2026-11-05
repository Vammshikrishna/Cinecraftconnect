-- PART BH: live member counts for discussion rooms.
--  * room_member_counts(room ids) returns the real number of members per room, counted from room_members.
--    The web room list uses it, so the "MEMBERS" figure on a card is always the live number.
--  * the stored discussion_rooms.member_count is recounted now, and the trigger recounts instead of adding or
--    subtracting one (a missed or doubled event used to leave it wrong for good).
-- Run after part BG. Safe to run twice.
BEGIN;

CREATE OR REPLACE FUNCTION public.room_member_counts(p_room_ids uuid[])
RETURNS TABLE (room_id uuid, member_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ids.id AS room_id,
         (SELECT count(*)::int FROM public.room_members m WHERE m.room_id = ids.id) AS member_count
    FROM unnest(p_room_ids) AS ids(id);
$$;
REVOKE ALL ON FUNCTION public.room_member_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.room_member_counts(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_room uuid := COALESCE(NEW.room_id, OLD.room_id);
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.discussion_rooms
     SET member_count = (SELECT count(*)::int FROM public.room_members WHERE room_id = v_room)
   WHERE id = v_room;
  RETURN NULL;
END;
$$;

-- the trigger exists on insert and delete already; make sure both are there
DROP TRIGGER IF EXISTS update_member_count_on_join ON public.room_members;
CREATE TRIGGER update_member_count_on_join AFTER INSERT ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();
DROP TRIGGER IF EXISTS update_member_count_on_leave ON public.room_members;
CREATE TRIGGER update_member_count_on_leave AFTER DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

-- recount every room now
SELECT set_config('app.market_system', '1', true);
UPDATE public.discussion_rooms r
   SET member_count = (SELECT count(*)::int FROM public.room_members m WHERE m.room_id = r.id);

COMMIT;
