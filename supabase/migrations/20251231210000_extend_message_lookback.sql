-- Drop the old function first to allow return type change
DROP FUNCTION IF EXISTS public.get_unread_message_previews(INT);

-- Re-create the function with new return type
CREATE OR REPLACE FUNCTION public.get_unread_message_previews(limit_count INT DEFAULT 10)
RETURNS TABLE (
    sender_id UUID,
    sender_name TEXT,
    sender_avatar TEXT,
    last_message TEXT,
    unread_count BIGINT,
    last_timestamp TIMESTAMPTZ,
    chat_type TEXT, 
    context_id UUID
) AS $$
BEGIN
    RETURN QUERY
    WITH all_messages AS (
        -- 1. Direct Messages
        SELECT 
            dm.sender_id AS source_id,
            COALESCE(p.full_name, p.username, 'Unknown User') AS name,
            p.avatar_url AS avatar,
            dm.content AS message,
            dm.created_at AS timestamp,
            'dm' AS type,
            dm.sender_id AS c_id
        FROM public.direct_messages dm
        JOIN public.profiles p ON dm.sender_id = p.id
        WHERE dm.receiver_id = auth.uid() AND dm.is_read = false

        UNION ALL

        -- 2. Project Messages (Extended lookback for testing)
        SELECT 
            pm.project_id AS source_id,
            ps.title AS name,
            NULL::text AS avatar,
            pm.content AS message,
            pm.created_at AS timestamp,
            'project' AS type,
            pm.project_id AS c_id
        FROM public.project_messages pm
        JOIN public.project_spaces ps ON pm.project_id = ps.id
        WHERE 
            pm.user_id != auth.uid() 
            AND pm.created_at > (NOW() - INTERVAL '30 days')  -- Changed from 24h to 30 days for visibility
            AND EXISTS (
                SELECT 1 FROM public.project_space_members psm 
                WHERE psm.project_space_id = pm.project_id 
                AND psm.user_id = auth.uid()
            )

        UNION ALL

        -- 3. Discussion Room Messages (Extended lookback for testing)
        SELECT 
            rm.room_id AS source_id,
            dr.name AS name,
            NULL::text AS avatar,
            rm.content AS message,
            rm.created_at AS timestamp,
            'discussion' AS type,
            rm.room_id AS c_id
        FROM public.room_messages rm
        JOIN public.discussion_rooms dr ON rm.room_id = dr.id
        WHERE 
            rm.user_id != auth.uid()
            AND rm.created_at > (NOW() - INTERVAL '30 days') -- Changed from 24h to 30 days
            AND EXISTS (
                 SELECT 1 FROM public.discussion_room_members drm 
                 WHERE drm.room_id = rm.room_id 
                 AND drm.user_id = auth.uid()
            )
    )
    SELECT 
        source_id,
        name,
        avatar,
        message,
        COUNT(*) as unread_count,
        MAX(timestamp) as last_timestamp,
        type,
        c_id
    FROM all_messages
    GROUP BY source_id, name, avatar, type, c_id, message
    ORDER BY last_timestamp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
