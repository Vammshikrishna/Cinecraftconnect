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
    INSERT INTO public.room_members (
        room_id,
        user_id,
        role
    ) VALUES (
        new_room_id,
        c_id,
        'moderator' -- Creator gets moderator/admin role
    );

    -- 3. (Optional) Process tags logic if you have a tags table
    -- For now, just logging or ignoring since the table might not exist
    -- IF array_length(room_tags, 1) > 0 THEN ... END IF;

    RETURN new_room_id;
END;
$$;
