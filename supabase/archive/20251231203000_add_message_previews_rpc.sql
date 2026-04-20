-- Function to get unread message previews
CREATE OR REPLACE FUNCTION public.get_unread_message_previews(limit_count INT DEFAULT 5)
RETURNS TABLE (
    sender_id UUID,
    sender_name TEXT,
    sender_avatar TEXT,
    last_message TEXT,
    unread_count BIGINT,
    last_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    -- Check if direct_messages table exists to avoid error if feature not fully implemented
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'direct_messages') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        dm.sender_id,
        COALESCE(p.full_name, p.username, 'Unknown User') AS sender_name,
        p.avatar_url AS sender_avatar,
        (
            SELECT content 
            FROM public.direct_messages d2 
            WHERE d2.sender_id = dm.sender_id 
              AND d2.receiver_id = auth.uid() 
              AND d2.is_read = false
            ORDER BY d2.created_at DESC 
            LIMIT 1
        ) as last_message,
        COUNT(dm.id) as unread_count,
        MAX(dm.created_at) as last_timestamp
    FROM public.direct_messages dm
    JOIN public.profiles p ON dm.sender_id = p.id
    WHERE dm.receiver_id = auth.uid() AND dm.is_read = false
    GROUP BY dm.sender_id, p.full_name, p.username, p.avatar_url
    ORDER BY last_timestamp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
