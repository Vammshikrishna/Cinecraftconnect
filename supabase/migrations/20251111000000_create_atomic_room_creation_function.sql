
CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(
  room_title TEXT,
  room_description TEXT,
  type TEXT,
  cat_id UUID,
  room_tags TEXT[],
  c_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_room_id UUID;
BEGIN
  -- Insert the new discussion room
  INSERT INTO public.discussion_rooms (
    title,
    description,
    room_type,
    category_id,
    tags,
    creator_id,
    is_active
  ) VALUES (
    room_title,
    room_description,
    type,
    cat_id,
    room_tags,
    c_id,
    true
  ) RETURNING id INTO new_room_id;

  -- Add the creator as a member with the 'creator' role
  IF new_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (
      room_id,
      user_id,
      role
    ) VALUES (
      new_room_id,
      c_id,
      'creator'
    );
  END IF;

  RETURN new_room_id;
END;
$$;
