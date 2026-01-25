-- ============================================================================
-- FIX: get_messages_for_channel
-- ============================================================================
-- The function `get_messages_for_channel` was dropped or missing.
-- Re-creating it with the standard schema.
-- Note: It uses `channel_id` which must closely match how the frontend requests it.
-- Based on the error, the frontend is calling `get_messages_for_channel(p_channel_id)`.
-- The schema should check for `direct_messages`.

CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;
