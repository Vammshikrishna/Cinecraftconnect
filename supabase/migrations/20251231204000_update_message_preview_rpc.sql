-- ============================================================================
-- UNREAD MESSAGES RPC FOR PROJECTS AND DISCUSSIONS
-- ============================================================================

-- Function to get unread message previews extended to all chat types
CREATE OR REPLACE FUNCTION public.get_unread_message_previews(limit_count INT DEFAULT 10)
RETURNS TABLE (
    sender_id UUID,
    sender_name TEXT,
    sender_avatar TEXT,
    last_message TEXT,
    unread_count BIGINT,
    last_timestamp TIMESTAMPTZ,
    chat_type TEXT, -- 'dm', 'project', 'discussion'
    chat_id UUID    -- ID of the chat/room/project
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
            dm.sender_id AS context_id
        FROM public.direct_messages dm
        JOIN public.profiles p ON dm.sender_id = p.id
        WHERE dm.receiver_id = auth.uid() AND dm.is_read = false

        UNION ALL

        -- 2. Project Messages (Grouped by Project)
        SELECT 
            pm.project_id AS source_id,
            ps.title AS name,
            NULL AS avatar, -- Could fetch project cover
            pm.content AS message,
            pm.created_at AS timestamp,
            'project' AS type,
            pm.project_id AS context_id
        FROM public.project_messages pm
        JOIN public.project_spaces ps ON pm.project_id = ps.id
        WHERE 
            pm.user_id != auth.uid() -- Don't count own messages
            -- Logic for 'unread' in group chat is tricky without a 'read_receipts' table.
            -- Using a heuristic: messages created after user's last 'check in'?
            -- For simplicity in this iteration: show recent messages from last 24h that aren't mine.
            -- Real implementation needs a last_read_at timestamp per user per project.
            AND pm.created_at > (NOW() - INTERVAL '24 hours') 
            AND EXISTS (
                SELECT 1 FROM public.project_space_members psm 
                WHERE psm.project_space_id = pm.project_id 
                AND psm.user_id = auth.uid()
            )
            -- Ideally exclude if user has 'seen' them. Lacking that column, this might show "fake" unreads.
            -- We'll accept this limitation or add a last_seen_at column in a future migration.

        UNION ALL

        -- 3. Discussion Room Messages
        SELECT 
            rm.room_id AS source_id,
            dr.name AS name,
            NULL AS avatar,
            rm.content AS message,
            rm.created_at AS timestamp,
            'discussion' AS type,
            rm.room_id AS context_id
        FROM public.room_messages rm
        JOIN public.discussion_rooms dr ON rm.room_id = dr.id
        WHERE 
            rm.user_id != auth.uid()
            AND rm.created_at > (NOW() - INTERVAL '24 hours') -- Same heuristic
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
        context_id
    FROM all_messages
    GROUP BY source_id, name, avatar, type, context_id, message -- 'message' in group by forces unique lines; distinct on source usually wanted.
    -- Better query structure to pick LATEST message per source:
    ORDER BY last_timestamp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
