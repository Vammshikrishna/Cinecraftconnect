-- Fix project_messages foreign key to reference profiles instead of auth.users
-- This allows PostgREST to automatically detect the relationship for joins

ALTER TABLE public.project_messages
DROP CONSTRAINT project_messages_user_id_fkey;

ALTER TABLE public.project_messages
ADD CONSTRAINT project_messages_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Re-define has_unread_messages RPC to ensure it exists
CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder implementation
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_unread_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_unread_messages() TO anon;
