-- Backfill creator_id for project_spaces from projects table
UPDATE public.project_spaces ps
SET creator_id = p.creator_id
FROM public.projects p
WHERE ps.project_id = p.id AND ps.creator_id IS NULL;

-- Also update the RLS policies to be more robust by checking both project_spaces.creator_id and projects.creator_id
DROP POLICY IF EXISTS "Project admins can view join requests" ON "public"."project_space_join_requests";
CREATE POLICY "Project admins can view join requests" ON "public"."project_space_join_requests"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            LEFT JOIN projects p ON p.id = ps.project_id
            WHERE ps.id = project_space_id AND (ps.creator_id = auth.uid() OR p.creator_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Project admins can update join requests" ON "public"."project_space_join_requests";
CREATE POLICY "Project admins can update join requests" ON "public"."project_space_join_requests"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            LEFT JOIN projects p ON p.id = ps.project_id
            WHERE ps.id = project_space_id AND (ps.creator_id = auth.uid() OR p.creator_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Project admins can delete join requests" ON "public"."project_space_join_requests";
CREATE POLICY "Project admins can delete join requests" ON "public"."project_space_join_requests"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            LEFT JOIN projects p ON p.id = ps.project_id
            WHERE ps.id = project_space_id AND (ps.creator_id = auth.uid() OR p.creator_id = auth.uid())
        )
    );
