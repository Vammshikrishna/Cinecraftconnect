CREATE OR REPLACE FUNCTION get_user_conversations_with_profiles(p_user_id UUID)
RETURNS TABLE (
    conversation_id UUID,
    other_user_id UUID,
    other_user_username TEXT,
    other_user_full_name TEXT,
    other_user_avatar_url TEXT,
    other_user_craft TEXT,
    last_message_content TEXT,
    last_message_created_at TIMESTAMPTZ,
    last_message_sender_id UUID,
    unread_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH conversation_participants AS (
        SELECT
            c.id AS conv_id,
            CASE
                WHEN c.participant_a = p_user_id THEN c.participant_b
                ELSE c.participant_a
            END AS other_user
        FROM conversations c
        WHERE c.participant_a = p_user_id OR c.participant_b = p_user_id
    ),
    ranked_messages AS (
        SELECT
            m.conversation_id,
            m.content,
            m.created_at,
            m.sender_id,
            ROW_NUMBER() OVER(PARTITION BY m.conversation_id ORDER BY m.created_at DESC) as rn
        FROM messages m
        WHERE m.conversation_id IN (SELECT conv_id FROM conversation_participants)
    )
    SELECT
        cp.conv_id AS conversation_id,
        cp.other_user AS other_user_id,
        prof.username,
        prof.full_name,
        prof.avatar_url,
        prof.craft,
        rm.content AS last_message_content,
        rm.created_at AS last_message_created_at,
        rm.sender_id AS last_message_sender_id,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cp.conv_id AND m.is_read = false AND m.sender_id != p_user_id) AS unread_count
    FROM conversation_participants cp
    JOIN profiles prof ON prof.id = cp.other_user
    LEFT JOIN ranked_messages rm ON rm.conversation_id = cp.conv_id AND rm.rn = 1
    ORDER BY rm.created_at DESC NULLS LAST;
END;
$$;
