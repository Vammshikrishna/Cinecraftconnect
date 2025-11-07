CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(
  room_title text,
  room_description text,
  type public.room_type,
  cat_id uuid,
  room_tags text[],
  c_id uuid
)
RETURNS uuid -- Changed from void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_room_id uuid;
BEGIN
  -- Insert into discussion_rooms
  INSERT INTO public.discussion_rooms (title, description, room_type, category_id, tags, creator_id, is_active, last_activity_at)
  VALUES (room_title, room_description, type, cat_id, room_tags, c_id, true, now())
  RETURNING id INTO new_room_id;

  -- Insert the creator as a member
  IF new_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (new_room_id, c_id, 'creator');
  END IF;

  RETURN new_room_id; -- Added return value
END;
$$;
