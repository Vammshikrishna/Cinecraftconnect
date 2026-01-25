-- ============================================================================
-- FIX: get_unread_message_previews (Group By Fix)
-- ============================================================================
-- The previous query grouped by `message` (content) which causes every single message
-- to appear as a separate row if the content differs, effectively returning ALL unread messages
-- instead of ONE grouped preview per sender.
--
-- We need to GROUP BY sender ONLY and pick the latest message.

DROP FUNCTION IF EXISTS public.get_unread_message_previews(INT);

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

        -- 2. Project Messages
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
            AND pm.created_at > (NOW() - INTERVAL '30 days')
            AND EXISTS (
                SELECT 1 FROM public.project_space_members psm 
                WHERE psm.project_space_id = pm.project_id 
                AND psm.user_id = auth.uid()
            )

        UNION ALL

        -- 3. Discussion Room Messages
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
            AND rm.created_at > (NOW() - INTERVAL '30 days')
            AND EXISTS (
                 SELECT 1 FROM public.discussion_room_members drm 
                 WHERE drm.room_id = rm.room_id 
                 AND drm.user_id = auth.uid()
            )
    )
    SELECT 
        m.source_id,
        m.name,
        m.avatar,
        -- Get the content of the LATEST message for this group
        (array_agg(m.message ORDER BY m.timestamp DESC))[1] as last_message,
        COUNT(*) as unread_count,
        MAX(m.timestamp) as last_timestamp,
        m.type,
        m.c_id
    FROM all_messages m
    GROUP BY m.source_id, m.name, m.avatar, m.type, m.c_id
    ORDER BY last_timestamp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
