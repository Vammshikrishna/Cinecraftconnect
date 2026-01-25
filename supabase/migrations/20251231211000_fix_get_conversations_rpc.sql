-- ============================================================================
-- FIX: get_user_conversations_with_profiles
-- ============================================================================
-- The column `recipient_id` was incorrect. Using `receiver_id` instead.

CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id uuid)
RETURNS TABLE(other_user_id uuid, other_user_full_name text, other_user_avatar_url text, last_message_content text, last_message_created_at timestamp with time zone, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (
            LEAST(sender_id, receiver_id),
            GREATEST(sender_id, receiver_id)
        )
            id, sender_id, receiver_id, content, created_at, is_read
        FROM direct_messages
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
        ORDER BY
            LEAST(sender_id, receiver_id),
            GREATEST(sender_id, receiver_id),
            created_at DESC
    ),
    unread_counts AS (
        SELECT sender_id, COUNT(*) as count
        FROM direct_messages
        WHERE receiver_id = p_user_id AND is_read = false
        GROUP BY sender_id
    )
    SELECT
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
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
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
            ELSE lm.sender_id
        END
    )
    LEFT JOIN unread_counts uc ON uc.sender_id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
            ELSE lm.sender_id
        END
    )
    ORDER BY lm.created_at DESC;
END;
$function$;
