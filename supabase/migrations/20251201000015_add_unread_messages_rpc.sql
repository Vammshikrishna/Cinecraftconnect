-- Function to check if the current user has any unread messages
-- This is a placeholder implementation to fix the 404 error
-- In a real implementation, this would check message read status tables

CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For now, just return false
  -- You can implement actual unread logic here later
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_unread_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_unread_messages() TO anon;
