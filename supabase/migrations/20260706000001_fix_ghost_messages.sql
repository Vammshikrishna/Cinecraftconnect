-- Fix ghost messages with incorrect channel_ids
CREATE OR REPLACE FUNCTION public.generate_direct_room_id(u1 uuid, u2 uuid)
RETURNS text AS $$
DECLARE
    sorted text[];
BEGIN
    IF u1 < u2 THEN
        sorted := ARRAY[u1::text, u2::text];
    ELSE
        sorted := ARRAY[u2::text, u1::text];
    END IF;
    RETURN replace(sorted[1] || sorted[2], '-', '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE direct_messages 
SET channel_id = public.generate_direct_room_id(sender_id, receiver_id) 
WHERE channel_id != public.generate_direct_room_id(sender_id, receiver_id);
