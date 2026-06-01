-- 45_add_chat_attachments.sql
-- Adding media support (images/videos) to direct messages and project space messages

-- 1. Add columns to direct_messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'attachment_url') THEN
        ALTER TABLE public.direct_messages ADD COLUMN attachment_url text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'attachment_type') THEN
        ALTER TABLE public.direct_messages ADD COLUMN attachment_type text;
    END IF;
END $$;
-- 2. Add columns to project_space_messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_space_messages' AND column_name = 'attachment_url') THEN
        ALTER TABLE public.project_space_messages ADD COLUMN attachment_url text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_space_messages' AND column_name = 'attachment_type') THEN
        ALTER TABLE public.project_space_messages ADD COLUMN attachment_type text;
    END IF;
END $$;
-- 3. Add columns to room_messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_messages' AND column_name = 'media_url') THEN
        ALTER TABLE public.room_messages ADD COLUMN media_url text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_messages' AND column_name = 'media_type') THEN
        ALTER TABLE public.room_messages ADD COLUMN media_type text;
    END IF;
END $$;
-- 4. Enable RLS for chat-media bucket (if it doesn't exist, we'll use post-media)
-- We'll assume post-media is used for now as it's already configured.;
