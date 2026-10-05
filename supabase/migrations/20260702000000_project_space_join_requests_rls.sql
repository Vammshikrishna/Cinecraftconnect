-- Enable RLS for project_space_join_requests if not already enabled
ALTER TABLE "public"."project_space_join_requests" ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own join requests
CREATE POLICY "Users can create their own join requests" ON "public"."project_space_join_requests"
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own join requests
CREATE POLICY "Users can view their own join requests" ON "public"."project_space_join_requests"
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow project admins to view join requests for their projects
CREATE POLICY "Project admins can view join requests" ON "public"."project_space_join_requests"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            WHERE ps.id = project_space_id AND ps.admin_id = auth.uid()
        )
    );

-- Allow project admins to update/delete join requests for their projects
CREATE POLICY "Project admins can update join requests" ON "public"."project_space_join_requests"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            WHERE ps.id = project_space_id AND ps.admin_id = auth.uid()
        )
    );

CREATE POLICY "Project admins can delete join requests" ON "public"."project_space_join_requests"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_spaces ps
            WHERE ps.id = project_space_id AND ps.admin_id = auth.uid()
        )
    );

-- Allow users to delete their own join requests
CREATE POLICY "Users can delete their own join requests" ON "public"."project_space_join_requests"
    FOR DELETE
    USING (auth.uid() = user_id);
