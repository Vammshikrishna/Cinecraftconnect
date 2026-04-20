-- ============================================================================
-- ENABLE GLOBAL REALTIME (ALL FEATURES)
-- ============================================================================
-- This script enables Supabase Realtime for ALL key application tables.
-- This ensures that Feed, Projects, Notifications, Calls, etc., all update instantly.
-- ============================================================================

BEGIN;

-- 1. FEED & SOCIAL
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;

-- 2. MESSAGING (Already done, but ensuring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_space_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- 3. PROJECTS
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_space_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shot_list;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_applications;

-- 4. DISCUSSIONS
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;

-- 5. CALLS
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;

-- 6. NOTIFICATIONS & ANNOUNCEMENTS
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; -- If exists

COMMIT;

-- Note: Ignore "relation ... is already in publication" errors.
