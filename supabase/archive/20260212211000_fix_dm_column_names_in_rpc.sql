-- Final cleanup of all unread message logic
-- Standardizing on common schema patterns found in the project

CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- 1. Direct Messages
    IF EXISTS (
        SELECT 1 FROM public.direct_messages
        WHERE receiver_id = auth.uid() AND (is_read = false OR is_read IS NULL)
    ) THEN
        RETURN true;
    END IF;

    -- 2. Project Room Messages
    IF EXISTS (
        SELECT 1 FROM public.project_messages pm
        JOIN public.project_space_members psm ON pm.project_id = psm.project_space_id
        WHERE psm.user_id = auth.uid() 
        AND pm.user_id != auth.uid()
        AND pm.created_at > (NOW() - INTERVAL '48 hours') -- Recent only
    ) THEN
        RETURN true;
    END IF;

    -- 3. Discussion Room Messages
    IF EXISTS (
        SELECT 1 FROM public.room_messages rm
        JOIN public.room_members drm ON rm.room_id = drm.room_id
        WHERE drm.user_id = auth.uid()
        AND rm.user_id != auth.uid()
        AND rm.created_at > (NOW() - INTERVAL '48 hours') -- Recent only
    ) THEN
        RETURN true;
    END IF;

    RETURN FALSE;
END;
$function$;

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
    WITH all_unread AS (
        -- DMs
        SELECT 
            dm.sender_id AS s_id,
            COALESCE(p.full_name, p.username, 'User') AS s_name,
            p.avatar_url AS s_avatar,
            dm.content AS msg,
            dm.created_at AS ts,
            'dm' AS type,
            dm.sender_id AS c_id
        FROM public.direct_messages dm
        LEFT JOIN public.profiles p ON dm.sender_id = p.id
        WHERE dm.receiver_id = auth.uid() AND (dm.is_read = false OR dm.is_read IS NULL)

        UNION ALL

        -- Project Messages
        SELECT 
            pm.project_id AS s_id,
            ps.name AS s_name,
            NULL::text AS s_avatar,
            pm.content AS msg,
            pm.created_at AS ts,
            'project' AS type,
            pm.project_id AS c_id
        FROM public.project_messages pm
        JOIN public.project_spaces ps ON pm.project_id = ps.id
        WHERE pm.user_id != auth.uid()
        AND pm.created_at > (NOW() - INTERVAL '48 hours')
        AND EXISTS (SELECT 1 FROM public.project_space_members psm WHERE psm.project_space_id = pm.project_id AND psm.user_id = auth.uid())

        UNION ALL

        -- Discussion Room Messages
        SELECT 
            rm.room_id AS s_id,
            dr.name AS s_name,
            NULL::text AS s_avatar,
            rm.content AS msg,
            rm.created_at AS ts,
            'discussion' AS type,
            rm.room_id AS c_id
        FROM public.room_messages rm
        JOIN public.discussion_rooms dr ON rm.room_id = dr.id
        WHERE rm.user_id != auth.uid()
        AND rm.created_at > (NOW() - INTERVAL '48 hours')
        AND EXISTS (SELECT 1 FROM public.room_members drm WHERE drm.room_id = rm.room_id AND drm.user_id = auth.uid())
    )
    SELECT 
        u.s_id AS sender_id,
        u.s_name AS sender_name,
        u.s_avatar AS sender_avatar,
        (array_agg(u.msg ORDER BY u.ts DESC))[1] AS last_message,
        COUNT(*) AS unread_count,
        MAX(u.ts) AS last_timestamp,
        u.type AS chat_type,
        u.c_id AS context_id
    FROM all_unread u
    GROUP BY u.s_id, u.s_name, u.s_avatar, u.type, u.c_id
    ORDER BY last_timestamp DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
