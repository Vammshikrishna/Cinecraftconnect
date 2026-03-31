-- Enhance chat message tables to support reply and undo (delete) features

-- direct_messages
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- project_messages
ALTER TABLE public.project_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.project_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- project_space_messages
ALTER TABLE public.project_space_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.project_space_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- room_messages
ALTER TABLE public.room_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.room_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Update the RPC to return the new columns
DROP FUNCTION IF EXISTS public.get_messages_for_channel(text);
CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb, reply_to_id uuid, is_deleted boolean, replied_to_message jsonb)
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
    ORDER BY dm.created_at ASC;
END;
$$;
