-- Migration: Add RPC to safely clear discussion room messages
-- Fixes foreign key constraints (room_messages_reply_to_id_fkey) and bypasses RLS for room creators/admins

CREATE OR REPLACE FUNCTION public.clear_room_messages(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Verify caller is creator of the room or an admin member
    IF NOT EXISTS (
        SELECT 1 FROM public.discussion_rooms WHERE id = _room_id AND creator_id = auth.uid()
        UNION
        SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = auth.uid() AND role IN ('admin', 'creator')
    ) THEN
        RAISE EXCEPTION 'Not authorized to clear history for this room';
    END IF;

    -- 2. Break self-referencing reply_to_id foreign keys to prevent FK 409 Conflict
    UPDATE public.room_messages SET reply_to_id = NULL WHERE room_id = _room_id;

    -- 3. Delete all reactions attached to these messages
    DELETE FROM public.room_message_reactions 
    WHERE message_id IN (SELECT id FROM public.room_messages WHERE room_id = _room_id);

    -- 4. Delete all messages for this room
    DELETE FROM public.room_messages WHERE room_id = _room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_room_messages(uuid) TO authenticated;
