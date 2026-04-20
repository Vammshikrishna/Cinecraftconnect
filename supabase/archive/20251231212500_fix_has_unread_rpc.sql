-- ============================================================================
-- FIX: has_unread_messages RPC
-- ============================================================================
-- The previous version of this function only checked `project_space_message_read_status`
-- which was causing Direct Messages updates to be ignored by the notification system.
-- This update ensures we explicitly check the `direct_messages` table for any 
-- messages addressed to the current user that are marked as unread.

CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Check for unread Direct Messages (User is receiver and is_read is false)
    IF EXISTS (
        SELECT 1 FROM public.direct_messages
        WHERE receiver_id = auth.uid() AND is_read = false
    ) THEN
        RETURN true;
    END IF;

    -- (Optional) Add checks for other types if schemas support it
    -- For now, primary "Red Dot" driver is DM.
    
    RETURN FALSE;
END;
$function$;
