-- ==========================================
-- 1. Create user_activities table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own activities"
    ON public.user_activities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities (mark as read)"
    ON public.user_activities FOR UPDATE
    USING (auth.uid() = user_id);

-- (Optional) Policy for system/triggers to insert activities - usually handled by service_role or functions with security definer
-- For now, allow authenticated users to insert (e.g. for testing or client-side generation if needed, though strictly backend triggers are better)
CREATE POLICY "Users can insert activities (if needed by client)"
    ON public.user_activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- 2. Create get_user_message_threads function
-- ==========================================
-- This function aggregates direct messages to return a thread-like structure
-- matching the frontend expectation:
-- {
--   id: string (conversation id / partner id),
--   last_message: { content: string, created_at: string },
--   participants: { profiles: { id, full_name, avatar_url } }[]
-- }

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
            m.id as message_id,
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


-- ==========================================
-- 3. Create get_user_conversations_with_profiles function
-- ==========================================
-- Also implementing this as it is used in ChatsList.tsx and likely missing if the other one was.

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
