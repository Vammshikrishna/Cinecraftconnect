-- 11_discussion_room_triggers.sql

-- Function to update the member count in discussion_rooms
CREATE OR REPLACE FUNCTION public.update_discussion_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.discussion_rooms
        SET member_count = member_count + 1
        WHERE id = NEW.room_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.discussion_rooms
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = OLD.room_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger to call the function on insert or delete in room_members
DROP TRIGGER IF EXISTS on_room_member_change ON public.room_members;
CREATE TRIGGER on_room_member_change
AFTER INSERT OR DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.update_discussion_room_member_count();
-- Initial sync of member counts (in case any are currently out of sync)
UPDATE public.discussion_rooms dr
SET member_count = (
    SELECT count(*)
    FROM public.room_members rm
    WHERE rm.room_id = dr.id
);
