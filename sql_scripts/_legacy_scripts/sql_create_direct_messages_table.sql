-- Create direct_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    read_at TIMESTAMPTZ,
    channel_id TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own messages"
    ON public.direct_messages
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert messages they send"
    ON public.direct_messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON public.direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_id ON public.direct_messages(channel_id);

-- Create function to get user conversations
CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id UUID)
RETURNS TABLE (
    other_user_id UUID,
    other_user_full_name TEXT,
    other_user_avatar_url TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMPTZ,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (
            LEAST(sender_id, recipient_id),
            GREATEST(sender_id, recipient_id)
        )
            id,
            sender_id,
            recipient_id,
            content,
            created_at,
            read_at
        FROM direct_messages
        WHERE sender_id = p_user_id OR recipient_id = p_user_id
        ORDER BY
            LEAST(sender_id, recipient_id),
            GREATEST(sender_id, recipient_id),
            created_at DESC
    ),
    unread_counts AS (
        SELECT
            sender_id,
            COUNT(*) as count
        FROM direct_messages
        WHERE recipient_id = p_user_id AND read_at IS NULL
        GROUP BY sender_id
    )
    SELECT
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END AS other_user_id,
        p.full_name AS other_user_full_name,
        p.avatar_url AS other_user_avatar_url,
        lm.content AS last_message_content,
        lm.created_at AS last_message_created_at,
        COALESCE(uc.count, 0) AS unread_count
    FROM latest_messages lm
    JOIN profiles p ON p.id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END
    )
    LEFT JOIN unread_counts uc ON uc.sender_id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END
    )
    ORDER BY lm.created_at DESC;
END;
$$;

-- Create function to get messages for a channel
CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id TEXT)
RETURNS TABLE (
    id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    sender_id UUID,
    sender_profile JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
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
        ) AS sender_profile
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at ASC;
END;
$$;
