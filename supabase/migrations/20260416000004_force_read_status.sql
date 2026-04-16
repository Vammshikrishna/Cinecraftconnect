-- Instagram-style Watermark Read Receipts
-- This allows tracking the 'furthest' message seen in a thread.

CREATE OR REPLACE FUNCTION public.mark_message_as_seen(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_channel_id text;
    v_created_at timestamptz;
BEGIN
    -- Get the details of the message being marked as seen
    SELECT channel_id, created_at INTO v_channel_id, v_created_at
    FROM direct_messages
    WHERE id = p_message_id;

    -- Update THIS message and ALL EARLIER messages in this thread
    -- Only if they belong to the current user (receiver)
    UPDATE direct_messages
    SET is_read = true
    WHERE channel_id = v_channel_id
    AND receiver_id = auth.uid()
    AND created_at <= v_created_at
    AND (is_read = false OR is_read IS NULL);
END;
$$;

-- Mark room message as seen (for groups)
CREATE OR REPLACE FUNCTION public.mark_room_message_as_seen(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id uuid;
    v_created_at timestamptz;
BEGIN
    SELECT room_id, created_at INTO v_room_id, v_created_at
    FROM room_messages
    WHERE id = p_message_id;

    -- Update the overall group read status for this user
    INSERT INTO public.room_message_read_status (room_id, user_id, last_read_at)
    VALUES (v_room_id, auth.uid(), v_created_at)
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    WHERE EXCLUDED.last_read_at > room_message_read_status.last_read_at;
END;
$$;

-- Rebuild room_message_read_status with correct HK and RLS
DROP TABLE IF EXISTS public.room_message_read_status CASCADE;
CREATE TABLE public.room_message_read_status (
    room_id uuid REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at timestamptz DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.room_message_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view read status in rooms" ON public.room_message_read_status FOR SELECT USING (true);
CREATE POLICY "Users can update their own read status in rooms" ON public.room_message_read_status FOR ALL USING (auth.uid() = user_id);

-- Grant access
    GRANT EXECUTE ON FUNCTION public.mark_room_message_as_seen(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.mark_message_as_seen(uuid) TO authenticated;

    -- Rebuild project_message_read_status with correct HK and RLS
    DROP TABLE IF EXISTS public.project_message_read_status CASCADE;
    CREATE TABLE public.project_message_read_status (
        project_space_id uuid REFERENCES public.project_spaces(id) ON DELETE CASCADE,
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        last_read_at timestamptz DEFAULT now(),
        PRIMARY KEY (project_space_id, user_id)
    );

    ALTER TABLE public.project_message_read_status ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view read status in their projects" ON public.project_message_read_status FOR SELECT USING (true);
    CREATE POLICY "Users can update their own read status in projects" ON public.project_message_read_status FOR ALL USING (auth.uid() = user_id);

    -- Mark project message as seen
    CREATE OR REPLACE FUNCTION public.mark_project_message_as_seen(p_message_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_space_id uuid;
        v_created_at timestamptz;
    BEGIN
        SELECT project_space_id, created_at INTO v_space_id, v_created_at
        FROM project_space_messages
        WHERE id = p_message_id;

        INSERT INTO public.project_message_read_status (project_space_id, user_id, last_read_at)
        VALUES (v_space_id, auth.uid(), v_created_at)
        ON CONFLICT (project_space_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
        WHERE EXCLUDED.last_read_at > project_message_read_status.last_read_at;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.mark_project_message_as_seen(uuid) TO authenticated;

    -- FIX LEGACY UNREAD FUNCTIONS
    CREATE OR REPLACE FUNCTION public.has_unread_messages()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- 1. Direct Messages
        IF EXISTS (
            SELECT 1 FROM public.direct_messages
            WHERE receiver_id = auth.uid() AND (is_read = false OR is_read IS NULL)
        ) THEN
            RETURN true;
        END IF;

        -- 2. Project Room Messages (Updated to project_space_id)
        IF EXISTS (
            SELECT 1 FROM public.project_space_messages pm
            JOIN public.project_space_members psm ON pm.project_space_id = psm.project_space_id
            LEFT JOIN public.project_message_read_status rs ON pm.project_space_id = rs.project_space_id AND rs.user_id = auth.uid()
            WHERE psm.user_id = auth.uid() 
            AND pm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
            AND pm.created_at > (NOW() - INTERVAL '7 days')
        ) THEN
            RETURN true;
        END IF;

        -- 3. Discussion Room Messages
        IF EXISTS (
            SELECT 1 FROM public.room_messages rm
            JOIN public.room_members drm ON rm.room_id = drm.room_id
            LEFT JOIN public.room_message_read_status rs ON rm.room_id = rs.room_id AND rs.user_id = auth.uid()
            WHERE drm.user_id = auth.uid()
            AND rm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
            AND rm.created_at > (NOW() - INTERVAL '7 days')
        ) THEN
            RETURN true;
        END IF;

        RETURN FALSE;
    END;
    $$;

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

            -- Project Messages (Updated to project_space_id)
            SELECT 
                pr.id AS s_id,
                pr.title AS s_name,
                NULL::text AS s_avatar,
                pm.content AS msg,
                pm.created_at AS ts,
                'project' AS type,
                pr.id AS c_id
            FROM public.project_space_messages pm
            JOIN public.project_spaces ps ON pm.project_space_id = ps.id
            JOIN public.projects pr ON ps.project_id = pr.id
            JOIN public.project_space_members psm ON ps.id = psm.project_space_id
            LEFT JOIN public.project_message_read_status rs ON ps.id = rs.project_space_id AND rs.user_id = auth.uid()
            WHERE psm.user_id = auth.uid()
            AND pm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
            AND pm.created_at > (NOW() - INTERVAL '7 days')

            UNION ALL

            -- Discussion Room Messages
            SELECT 
                dr.id AS s_id,
                dr.title AS s_name,
                NULL::text AS s_avatar,
                rm.content AS msg,
                rm.created_at AS ts,
                'discussion' AS type,
                dr.id AS c_id
            FROM public.room_messages rm
            JOIN public.discussion_rooms dr ON rm.room_id = dr.id
            JOIN public.room_members drm ON dr.id = drm.room_id
            LEFT JOIN public.room_message_read_status rs ON dr.id = rs.room_id AND rs.user_id = auth.uid()
            WHERE drm.user_id = auth.uid()
            AND rm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
            AND rm.created_at > (NOW() - INTERVAL '7 days')
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


-- GET TOTAL UNREAD COUNT
CREATE OR REPLACE FUNCTION public.get_total_unread_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total bigint := 0;
BEGIN
    -- 1. Direct Messages
    SELECT count(*) INTO v_total
    FROM public.direct_messages
    WHERE receiver_id = auth.uid() AND (is_read = false OR is_read IS NULL);

    -- 2. Project Room Messages
    v_total := v_total + (
        SELECT count(*)
        FROM public.project_space_messages pm
        JOIN public.project_space_members psm ON pm.project_space_id = psm.project_space_id
        LEFT JOIN public.project_message_read_status rs ON pm.project_space_id = rs.project_space_id AND rs.user_id = auth.uid()
        WHERE psm.user_id = auth.uid() 
        AND pm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
        AND pm.created_at > (NOW() - INTERVAL '7 days')
    );

    -- 3. Discussion Room Messages
    v_total := v_total + (
        SELECT count(*)
        FROM public.room_messages rm
        JOIN public.room_members drm ON rm.room_id = drm.room_id
        LEFT JOIN public.room_message_read_status rs ON rm.room_id = rs.room_id AND rs.user_id = auth.uid()
        WHERE drm.user_id = auth.uid()
        AND rm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
        AND rm.created_at > (NOW() - INTERVAL '7 days')
    );

    RETURN v_total;
END;
$$;
