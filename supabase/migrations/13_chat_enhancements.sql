-- Consolidated Migration: 13_chat_enhancements.sql

-- =========================================================================
-- From original file: 37_fix_chat_pagination_rpc.sql
-- =========================================================================

-- 43_fix_chat_pagination_rpc.sql
-- Fixes 404 error when calling get_messages_for_channel_paginated

CREATE OR REPLACE FUNCTION public.get_messages_for_channel_paginated(
    p_channel_id text,
    p_limit int DEFAULT 30,
    p_offset int DEFAULT 0
)
RETURNS TABLE(
    id uuid, 
    content text, 
    created_at timestamp with time zone, 
    sender_id uuid, 
    sender_profile jsonb, 
    reply_to_id uuid, 
    is_deleted boolean, 
    deleted_for_users uuid[], 
    is_read boolean, 
    replied_to_message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dm.id, 
        dm.content, 
        dm.created_at, 
        dm.sender_id, 
        jsonb_build_object(
            'full_name', p.full_name, 
            'avatar_url', p.avatar_url
        ) AS sender_profile,
        dm.reply_to_id,
        dm.is_deleted,
        dm.deleted_for_users,
        dm.is_read,
        (
            SELECT jsonb_build_object(
                'id', rd.id,
                'content', rd.content,
                'is_deleted', rd.is_deleted,
                'sender_profile', jsonb_build_object(
                    'full_name', rp.full_name,
                    'avatar_url', rp.avatar_url
                )
            )
            FROM direct_messages rd
            JOIN profiles rp ON rd.sender_id = rp.id
            WHERE rd.id = dm.reply_to_id
        ) AS replied_to_message
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


-- =========================================================================
-- From original file: 38_enable_chat_realtime.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 39_add_chat_attachments.sql
-- =========================================================================

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
-- We'll assume post-media is used for now as it's already configured.


-- =========================================================================
-- From original file: 40_update_chat_rpc_for_attachments.sql
-- =========================================================================

-- 46_update_chat_rpc_for_attachments.sql
-- Updating chat RPCs to return attachment_url and attachment_type
-- We must DROP the function first because the return type (TABLE columns) has changed.

DROP FUNCTION IF EXISTS public.get_messages_for_channel_paginated(text, int, int);

CREATE OR REPLACE FUNCTION public.get_messages_for_channel_paginated(
    p_channel_id text,
    p_limit int DEFAULT 30,
    p_offset int DEFAULT 0
)
RETURNS TABLE(
    id uuid, 
    content text, 
    created_at timestamp with time zone, 
    sender_id uuid, 
    sender_profile jsonb, 
    reply_to_id uuid, 
    is_deleted boolean, 
    deleted_for_users uuid[], 
    is_read boolean, 
    replied_to_message jsonb,
    attachment_url text,
    attachment_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dm.id, 
        dm.content, 
        dm.created_at, 
        dm.sender_id, 
        jsonb_build_object(
            'full_name', p.full_name, 
            'avatar_url', p.avatar_url
        ) AS sender_profile,
        dm.reply_to_id,
        dm.is_deleted,
        dm.deleted_for_users,
        dm.is_read,
        (
            SELECT jsonb_build_object(
                'id', rd.id,
                'content', rd.content,
                'is_deleted', rd.is_deleted,
                'sender_profile', jsonb_build_object(
                    'full_name', rp.full_name,
                    'avatar_url', rp.avatar_url
                )
            )
            FROM direct_messages rd
            JOIN profiles rp ON rd.sender_id = rp.id
            WHERE rd.id = dm.reply_to_id
        ) AS replied_to_message,
        dm.attachment_url,
        dm.attachment_type
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


