-- ============================================================================
-- FIX: Add channel_id to direct_messages
-- ============================================================================
-- The frontend relies on `channel_id` for grouping chats, but it's missing.
-- We add it and populate it for existing messages (if possible) or just leave null.
-- We also update the RPC to handle the case.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'channel_id') THEN
        ALTER TABLE public.direct_messages ADD COLUMN channel_id text;
        CREATE INDEX idx_direct_messages_channel_id ON public.direct_messages(channel_id);
    END IF;
END $$;

-- Update the RPC to use the now-guaranteed column
CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
        ) AS sender_profile
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at ASC;
END;
$function$;
