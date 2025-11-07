-- Ensure the default category exists, and then create a trigger to assign it.

-- First, ensure the 'General Discussion' category exists.
INSERT INTO public.room_categories (name, description, is_private)
VALUES ('General Discussion', 'A default category for general topics.', false)
ON CONFLICT (name) DO NOTHING;

-- This function is triggered before a new discussion room is inserted.
-- If the category_id is not provided, it assigns the 'General Discussion' category.
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
    -- Find the ID of the 'General Discussion' category. STRICT ensures it raises an exception if not found.
    SELECT id INTO STRICT general_category_id
    FROM public.room_categories
    WHERE name = 'General Discussion';

    -- Assign the found category ID.
    NEW.category_id := general_category_id;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'Default category "General Discussion" not found.';
END;
$$;

-- Create a trigger to run the function before inserting a new discussion room
DROP TRIGGER IF EXISTS set_default_category_trigger ON public.discussion_rooms;
CREATE TRIGGER set_default_category_trigger
  BEFORE INSERT ON public.discussion_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_discussion_category();
