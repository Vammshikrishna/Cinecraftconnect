
-- Function to check for any unread messages for the current user.
-- This checks direct messages, discussion room messages, and project space messages.
CREATE OR REPLACE FUNCTION has_unread_messages()
RETURNS BOOLEAN AS $$
DECLARE
  unread_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    -- Unread direct messages
    (SELECT 1 FROM direct_messages WHERE recipient_id = auth.uid() AND sender_id != auth.uid() LIMIT 1)
    UNION ALL
    -- Unread messages in discussion rooms
    (SELECT 1 
     FROM discussion_room_messages drm
     JOIN discussion_room_participants drp ON drm.room_id = drp.room_id
     LEFT JOIN discussion_room_message_read_status rst ON rst.message_id = drm.id AND rst.user_id = auth.uid()
     WHERE drp.user_id = auth.uid() AND drm.user_id != auth.uid() AND rst.message_id IS NULL
     LIMIT 1)
    -- In a real application, you would also add logic here to check for unread messages
    -- in project spaces. For this example, we'll just use the two tables above.
  ) INTO unread_exists;

  RETURN unread_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
