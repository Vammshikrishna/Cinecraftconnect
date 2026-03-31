-- Fix calls RLS to allow room/project creators to end calls
-- and allow participants to mark themselves as left.

DROP POLICY IF EXISTS "Call creator can update call" ON public.calls;

CREATE POLICY "Authorized users can update calls"
ON public.calls FOR UPDATE
USING (
  (select auth.uid()) = started_by OR
  (
    room_type = 'discussion' AND EXISTS (
      SELECT 1 FROM public.discussion_rooms
      WHERE id = room_id AND creator_id = (select auth.uid())
    )
  ) OR
  (
    room_type = 'project' AND EXISTS (
      SELECT 1 FROM public.project_spaces
      WHERE id = room_id AND creator_id = (select auth.uid())
    )
  )
);

-- Ensure participants can always update their own status
DROP POLICY IF EXISTS "Users can update their own participation" ON public.call_participants;
CREATE POLICY "Users can update their own participation"
ON public.call_participants FOR UPDATE
USING ((select auth.uid()) = user_id);
