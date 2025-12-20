CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(
    c_id UUID,
    cat_id UUID,
    room_title TEXT,
    room_description TEXT,
    type TEXT,
    room_tags TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_room_id UUID;
BEGIN
    -- 1. Insert the new room
    INSERT INTO public.discussion_rooms (
        title,
        description,
        category_id,
        room_type,
        creator_id
    ) VALUES (
        room_title,
        room_description,
        cat_id,
        type,
        c_id
    ) RETURNING id INTO new_room_id;

    -- 2. Add the creator as a member automatically
    -- Note: We are using 'moderator' as the role string based on typical schema.
    -- If room_members.role has a check constraint, ensure 'moderator' is allowed.
    INSERT INTO public.room_members (
        room_id,
        user_id,
        role
    ) VALUES (
        new_room_id,
        c_id,
        'moderator'
    );

    RETURN new_room_id;
END;
$$;
