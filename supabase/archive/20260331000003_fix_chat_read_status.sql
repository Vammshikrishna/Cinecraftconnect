-- Fix for "fake unread" messages in projects and discussion rooms
-- Adding read status tracking for discussion rooms and updating RPCs

-- 1. Create room_message_read_status table
CREATE TABLE IF NOT EXISTS public.room_message_read_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.room_message_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Member View Room Read Status" ON public.room_message_read_status;
DROP POLICY IF EXISTS "Update Own Room Read Status" ON public.room_message_read_status;

CREATE POLICY "Member View Room Read Status" ON public.room_message_read_status 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = room_message_read_status.room_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Update Own Room Read Status" ON public.room_message_read_status 
FOR ALL USING (auth.uid() = user_id);

-- 2. Update has_unread_messages function to be more accurate
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

    -- 2. Project Room Messages (Using project_message_read_status)
    IF EXISTS (
        SELECT 1 FROM public.project_space_messages pm
        JOIN public.project_space_members psm ON pm.project_space_id = psm.project_space_id
        LEFT JOIN public.project_message_read_status rs ON pm.project_space_id = rs.project_id AND rs.user_id = auth.uid()
        WHERE psm.user_id = auth.uid() 
        AND pm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
        AND pm.created_at > (NOW() - INTERVAL '7 days') -- Look back slightly longer
    ) THEN
        RETURN true;
    END IF;

    -- 3. Discussion Room Messages (Using room_message_read_status)
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
$function$;

-- 3. Update get_unread_message_previews RPC
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

        -- Project Messages (Accurate tracking)
        SELECT 
            p.id AS s_id, -- Use project_id as sender_id for grouping/linking
            p.title AS s_name,
            NULL::text AS s_avatar,
            pm.content AS msg,
            pm.created_at AS ts,
            'project' AS type,
            p.id AS c_id
        FROM public.project_space_messages pm
        JOIN public.project_spaces ps ON pm.project_space_id = ps.id
        JOIN public.projects p ON ps.project_id = p.id
        JOIN public.project_space_members psm ON ps.id = psm.project_space_id
        LEFT JOIN public.project_message_read_status rs ON ps.id = rs.project_id AND rs.user_id = auth.uid()
        WHERE psm.user_id = auth.uid()
        AND pm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
        AND pm.created_at > (NOW() - INTERVAL '7 days')

        UNION ALL

        -- Discussion Room Messages (Accurate tracking)
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
