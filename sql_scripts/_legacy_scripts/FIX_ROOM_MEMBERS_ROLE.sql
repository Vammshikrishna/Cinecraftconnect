-- 1. Ensure the 'role' column exists in 'room_members'
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- 2. Update the RPC function to correctly use the columns (it was already correct, but we reload to be safe)
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
    -- Set 'name' AND 'title'
    INSERT INTO public.discussion_rooms (
        title,
        name, 
        description,
        category_id,
        room_type,
        creator_id
    ) VALUES (
        room_title,
        room_title, -- Populate name with title
        room_description,
        cat_id,
        type,
        c_id
    ) RETURNING id INTO new_room_id;

    -- 2. Add the creator as a member automatically
    -- The error claimed 'role' didn't exist, so we added it above.
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
