-- Fix RLS policies for call_participants table
-- The SELECT policy was failing because it relied on the potentially broken project_spaces.creator_id check.
-- We must update it to check public.projects.creator_id instead.

DROP POLICY IF EXISTS "Users can view participants in their calls" ON public.call_participants;

CREATE POLICY "Users can view participants in their calls"
ON public.call_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.calls
        WHERE id = call_id AND (
            (room_type = 'project' AND (
                EXISTS (
                    SELECT 1 FROM public.project_space_members
                    WHERE project_space_id = room_id AND user_id = auth.uid()
                ) OR EXISTS (
                    SELECT 1 FROM public.project_spaces ps
                    JOIN public.projects p ON ps.project_id = p.id
                    WHERE ps.id = room_id AND p.creator_id = auth.uid()
                )
            )) OR
            (room_type = 'discussion' AND EXISTS (
                SELECT 1 FROM public.room_members
                WHERE room_id = calls.room_id AND user_id = auth.uid()
            ))
        )
    )
);

-- Ensure keys are created if not exists (although they should be)
-- We keep the INSERT/UPDATE policies simple as they were, assuming SELECT covers the visibility check needed for UPSERT.
-- The original INSERT policy was: WITH CHECK (user_id = auth.uid())
-- The original UPDATE policy was: USING (user_id = auth.uid())

