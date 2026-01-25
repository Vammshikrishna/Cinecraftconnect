-- Fix RLS policy for calls table to correctly check project creator
-- The previous policy assumed project_spaces had a creator_id column or that it was populated
-- validly. It is safer to check the parent projects table.

DROP POLICY IF EXISTS "Project/room members can create calls" ON public.calls;

CREATE POLICY "Project/room members can create calls"
ON public.calls FOR INSERT
WITH CHECK (
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
);

-- Also fix the SELECT policy just in case
DROP POLICY IF EXISTS "Users can view calls in their projects/rooms" ON public.calls;

CREATE POLICY "Users can view calls in their projects/rooms"
ON public.calls FOR SELECT
USING (
    (room_type = 'project' AND EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = room_id AND user_id = auth.uid()
    )) OR
    (room_type = 'project' AND EXISTS (
        SELECT 1 FROM public.project_spaces ps
        JOIN public.projects p ON ps.project_id = p.id
        WHERE ps.id = room_id AND p.creator_id = auth.uid()
    )) OR
    (room_type = 'discussion' AND EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = calls.room_id AND user_id = auth.uid()
    ))
);
