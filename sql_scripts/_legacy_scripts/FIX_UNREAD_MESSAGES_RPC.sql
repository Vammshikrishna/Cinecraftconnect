-- Function to check if user has any unread messages
-- Currently checks Direct Messages.
-- Future: Add logic for Project/Room messages if read tracking is implemented.

CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    unread_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM direct_messages
        WHERE recipient_id = auth.uid()
        AND read_at IS NULL
    ) INTO unread_exists;

    RETURN unread_exists;
END;
$$;
