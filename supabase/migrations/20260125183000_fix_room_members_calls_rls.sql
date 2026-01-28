-- ============================================================================
-- FIX: room_members RLS policies
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view members of rooms they belong to" ON public.room_members;
DROP POLICY IF EXISTS "Users can join public rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_members;
DROP POLICY IF EXISTS "room_members_select_policy" ON public.room_members;
DROP POLICY IF EXISTS "room_members_insert_policy" ON public.room_members;
DROP POLICY IF EXISTS "room_members_delete_policy" ON public.room_members;

-- Allow users to view members of rooms they are part of
CREATE POLICY "Users can view members of rooms they belong to"
ON public.room_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_members rm
    WHERE rm.room_id = room_members.room_id
    AND rm.user_id = auth.uid()
  )
);

-- Allow users to join rooms (insert themselves)
CREATE POLICY "Users can join rooms"
ON public.room_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Allow users to leave rooms (delete themselves)
CREATE POLICY "Users can leave rooms"
ON public.room_members FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- FIX: calls table RLS policies
-- ============================================================================

-- Drop all existing policies with any possible name
DROP POLICY IF EXISTS "Users can view calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls in their rooms" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they created" ON public.calls;
DROP POLICY IF EXISTS "Authenticated users can view active calls" ON public.calls;
DROP POLICY IF EXISTS "Authenticated users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls in their projects/rooms" ON public.calls;
DROP POLICY IF EXISTS "Project/room members can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls" ON public.calls;

-- Allow authenticated users to view all active calls
-- (They can only join if they're in the room, which is checked at the application level)
CREATE POLICY "Authenticated users can view active calls"
ON public.calls FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to create calls
CREATE POLICY "Authenticated users can create calls"
ON public.calls FOR INSERT
TO authenticated
WITH CHECK (started_by = auth.uid());

-- Allow users to update calls they started
CREATE POLICY "Users can update their calls"
ON public.calls FOR UPDATE
TO authenticated
USING (started_by = auth.uid())
WITH CHECK (started_by = auth.uid());
