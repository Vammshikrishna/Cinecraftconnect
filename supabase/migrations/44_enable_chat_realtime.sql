-- 44_enable_chat_realtime.sql
-- Enables realtime for chat tables and call coordination tables

DO $$
BEGIN
  -- Add direct_messages to publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table direct_messages already in publication';
  END;

  -- Add room_messages to publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table room_messages already in publication';
  END;

  -- Add project_space_messages to publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_space_messages;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table project_space_messages already in publication';
  END;

  -- Add calls table to publication (Fixes "Join Active Call" stale UI)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table calls already in publication';
  END;
END $$;

-- Set replica identity to FULL to ensure all columns are available in realtime payloads
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
ALTER TABLE public.project_space_messages REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
