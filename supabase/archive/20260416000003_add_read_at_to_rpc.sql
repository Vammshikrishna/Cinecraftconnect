-- REVERT: Restore get_messages_for_channel without read_at to fix UI
DROP FUNCTION IF EXISTS public.get_messages_for_channel(text);

CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
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
    ORDER BY dm.created_at ASC;
END;
$$;
