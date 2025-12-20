-- ==========================================
-- 1. Create direct_messages table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own messages (sent or received)"
    ON public.direct_messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
    ON public.direct_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own received messages (mark as read)"
    ON public.direct_messages FOR UPDATE
    USING (auth.uid() = receiver_id);


-- ==========================================
-- 2. Re-Create Functions (Ensure they exist and are valid)
-- ==========================================

-- Function to get distinct conversation threads
CREATE OR REPLACE FUNCTION public.get_user_message_threads(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    last_message JSONB,
    participants JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT 
            DISTINCT ON (
                CASE WHEN sender_id = p_user_id THEN receiver_id ELSE sender_id END
            )
            m.id,
            m.sender_id,
            m.receiver_id,
            m.content,
            m.created_at,
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as other_user_id
        FROM direct_messages m
        WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
        ORDER BY 
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
            m.created_at DESC
    )
    SELECT 
        rm.other_user_id as id,
        jsonb_build_object(
            'content', rm.content,
            'created_at', rm.created_at
        ) as last_message,
        jsonb_build_array(
            jsonb_build_object(
                'profiles', jsonb_build_object(
                    'id', p.id,
                    'full_name', p.full_name,
                    'avatar_url', p.avatar_url
                )
            )
        ) as participants
    FROM ranked_messages rm
    JOIN profiles p ON p.id = rm.other_user_id
    ORDER BY rm.created_at DESC;
END;
$$;

-- Function for ChatsList.tsx
CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id UUID)
RETURNS TABLE (
    other_user_id UUID,
    other_user_full_name TEXT,
    other_user_avatar_url TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT 
            DISTINCT ON (
                CASE WHEN sender_id = p_user_id THEN receiver_id ELSE sender_id END
            )
            m.id,
            m.sender_id,
            m.receiver_id,
            m.content,
            m.created_at,
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as partner_id
        FROM direct_messages m
        WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
        ORDER BY 
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
            m.created_at DESC
    ),
    unread_counts AS (
        SELECT 
            sender_id, 
            COUNT(*) as count
        FROM direct_messages
        WHERE receiver_id = p_user_id AND is_read = false
        GROUP BY sender_id
    )
    SELECT 
        rm.partner_id as other_user_id,
        p.full_name as other_user_full_name,
        p.avatar_url as other_user_avatar_url,
        rm.content as last_message_content,
        rm.created_at as last_message_created_at,
        COALESCE(uc.count, 0) as unread_count
    FROM ranked_messages rm
    JOIN profiles p ON p.id = rm.partner_id
    LEFT JOIN unread_counts uc ON uc.sender_id = rm.partner_id
    ORDER BY rm.created_at DESC;
END;
$$;
