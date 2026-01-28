-- Create start_call RPC
CREATE OR REPLACE FUNCTION public.start_call(room_id UUID, created_by UUID, call_type TEXT)
RETURNS JSONB AS $$
DECLARE
    new_call_id UUID;
    result JSONB;
    room_type TEXT;
BEGIN
    -- Determine room type based on where the room_id exists
    IF EXISTS (SELECT 1 FROM public.project_spaces WHERE id = room_id) THEN
        room_type := 'project';
    ELSIF EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id) THEN
         room_type := 'discussion';
    ELSE
         RAISE EXCEPTION 'Invalid room ID';
    END IF;

    -- Insert new call
    INSERT INTO public.calls (room_type, room_id, daily_room_name, daily_room_url, started_by, status)
    VALUES (
        room_type, 
        room_id, 
        'native-' || room_id || '-' || extract(epoch from now()), -- Dummy value for unused columns
        'native', -- Dummy value
        created_by, 
        'active'
    )
    RETURNING id INTO new_call_id;

    -- Add creator as participant
    INSERT INTO public.call_participants (call_id, user_id, status)
    VALUES (new_call_id, created_by, 'joined');

    -- Return the created call object
    SELECT jsonb_build_object(
        'id', c.id,
        'room_id', c.room_id,
        'room_type', c.room_type,
        'started_by', c.started_by,
        'status', c.status,
        'created_at', c.created_at
    ) INTO result
    FROM public.calls c
    WHERE c.id = new_call_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
