-- Enable Realtime for read status tracking
BEGIN;
  -- Add room_message_read_status to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_message_read_status;
  
  -- Add project_message_read_status to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_message_read_status;
COMMIT;
