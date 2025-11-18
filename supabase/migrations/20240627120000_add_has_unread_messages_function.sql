
-- Function to check for any unread messages for the current user.
-- This checks direct messages and project space messages.
CREATE OR REPLACE FUNCTION has_unread_messages()
RETURNS BOOLEAN AS $$
DECLARE
  unread_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    -- Unread direct messages
    (SELECT 1
     FROM public.messages m
     JOIN public.conversations c ON m.conversation_id = c.id
     WHERE (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
       AND m.sender_id != auth.uid()
       AND m.is_read = false
     LIMIT 1)
    UNION ALL
    -- Unread messages in project spaces
    (SELECT 1
     FROM public.project_space_messages psm
     JOIN public.project_space_members psmemb ON psm.project_space_id = psmemb.project_space_id
     LEFT JOIN public.project_space_message_read_status rs ON rs.message_id = psm.id AND rs.user_id = auth.uid()
     WHERE psmemb.user_id = auth.uid()
       AND psm.user_id != auth.uid()
       AND rs.message_id IS NULL
     LIMIT 1)
  ) INTO unread_exists;

  RETURN unread_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
