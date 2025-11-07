-- Enable real-time updates for posts
-- ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE discussion_rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Set replica identity full for real-time
ALTER TABLE posts REPLICA IDENTITY FULL;
ALTER TABLE discussion_rooms REPLICA IDENTITY FULL;
ALTER TABLE room_messages REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;