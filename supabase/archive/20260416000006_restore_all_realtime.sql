-- EMERGENCY REALTIME REPAIR (Fixed Syntax)
-- This script ensures ALL chat tables are part of the realtime broadcast
DO $$
BEGIN
  -- We just try to add them. If they already exist, Postgres will just skip or we can handle it.
  -- To be absolutely safe and clean, we'll use a series of individual ADD commands
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_space_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_message_read_status;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_message_read_status;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_rooms;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_spaces;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
