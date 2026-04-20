-- ============================================================================
-- ENABLE REALTIME FOR CHAT
-- ============================================================================
-- This script ensures that Realtime updates are enabled for chat messages.
-- Without this, users have to refresh to see new messages.
-- ============================================================================

BEGIN;

-- 1. Enable Realtime for Discussion Room Messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

-- 2. Enable Realtime for Project Messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;

-- 3. Enable Realtime for Project Space Messages (if used)
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_space_messages;

COMMIT;

-- Note: If you get an error saying "relation ... is already in publication", 
-- it means Realtime was already enabled, and the issue might be elsewhere.
-- But usually, this is the missing step for new tables.
