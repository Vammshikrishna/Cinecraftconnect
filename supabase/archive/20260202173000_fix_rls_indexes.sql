-- CRITICAL PERFORMANCE FIX
-- These indexes are required for RLS policies (is_member_of_room, is_member_of_project) to run fast.
-- Without them, the database scans the entire members table for EVERY row in the projects/rooms list.

-- 1. Discussion Rooms RLS optimization
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
-- Composite index is even better for "Is User X in Room Y?"
CREATE INDEX IF NOT EXISTS idx_room_members_room_user_composite ON public.room_members(room_id, user_id);

-- 2. Projects RLS optimization
-- Assuming 'project_members' is the join table for 'projects'
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_user_composite ON public.project_members(project_id, user_id);

-- 3. Project Spaces RLS optimization (if used)
CREATE INDEX IF NOT EXISTS idx_project_space_members_ps_id ON public.project_space_members(project_space_id);
CREATE INDEX IF NOT EXISTS idx_project_space_members_ps_user_composite ON public.project_space_members(project_space_id, user_id);

-- 4. Conversations/Messages optimization (often slow too)
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(user1_id, user2_id);
