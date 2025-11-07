
CREATE OR REPLACE FUNCTION public.assign_default_discussion_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  general_category_id UUID;
BEGIN
  -- Check if a category is already assigned
  IF NEW.category_id IS NULL THEN
    -- Find the ID of the 'General Discussion' category
    SELECT id INTO general_category_id
    FROM public.room_categories
    WHERE name = 'General Discussion'
    LIMIT 1;

    -- If the category is found, assign it to the new room
    IF general_category_id IS NOT NULL THEN
      NEW.category_id := general_category_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create a trigger to run the function before inserting a new discussion room
DROP TRIGGER IF EXISTS set_default_category_trigger ON public.discussion_rooms;
CREATE TRIGGER set_default_category_trigger
  BEFORE INSERT ON public.discussion_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_discussion_category();
