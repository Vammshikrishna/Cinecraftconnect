-- Enable real-time for notifications and direct_messages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications' AND schemaname = 'public') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'direct_messages' AND schemaname = 'public') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'direct_messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
        END IF;
    END IF;
END $$;
