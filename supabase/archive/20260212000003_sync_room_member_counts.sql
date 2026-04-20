-- Sync discussion_rooms.member_count with the actual count from room_members.
-- This fixes any drift caused by out-of-order operations or failed trigger executions.

UPDATE public.discussion_rooms dr
SET member_count = (
    SELECT COUNT(*)
    FROM public.room_members rm
    WHERE rm.room_id = dr.id
);

-- Re-create the trigger function with SECURITY DEFINER and a safe search_path
-- to ensure it works correctly under RLS
CREATE OR REPLACE FUNCTION public.update_room_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.discussion_rooms 
        SET member_count = (
            SELECT COUNT(*) FROM public.room_members WHERE room_id = NEW.room_id
        )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.discussion_rooms 
        SET member_count = (
            SELECT COUNT(*) FROM public.room_members WHERE room_id = OLD.room_id
        )
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Re-create triggers (idempotent)
DROP TRIGGER IF EXISTS update_member_count_on_join ON public.room_members;
CREATE TRIGGER update_member_count_on_join 
    AFTER INSERT ON public.room_members 
    FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

DROP TRIGGER IF EXISTS update_member_count_on_leave ON public.room_members;
CREATE TRIGGER update_member_count_on_leave 
    AFTER DELETE ON public.room_members 
    FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();
