-- Create call-sheets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-sheets', 'call-sheets', false);

-- Policy: Project members can view call sheets
CREATE POLICY "Project members can view call sheets"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'call-sheets' AND
    (
        EXISTS (
            SELECT 1 FROM public.call_sheets
            JOIN public.project_space_members ON call_sheets.project_id = project_space_members.project_space_id
            WHERE call_sheets.notes LIKE '%' || storage.objects.name || '%'
            AND project_space_members.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.call_sheets
            JOIN public.project_spaces ON call_sheets.project_id = project_spaces.id
            WHERE call_sheets.notes LIKE '%' || storage.objects.name || '%'
            AND project_spaces.creator_id = auth.uid()
        )
    )
);

-- Policy: Project members can upload call sheets
CREATE POLICY "Project members can upload call sheets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'call-sheets' AND
    auth.uid() IS NOT NULL
);

-- Policy: Project members can update call sheets
CREATE POLICY "Project members can update call sheets"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'call-sheets' AND
    auth.uid() IS NOT NULL
);

-- Policy: Uploaders and project creators can delete call sheets
CREATE POLICY "Uploaders can delete call sheets"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'call-sheets' AND
    (owner = auth.uid() OR EXISTS (
        SELECT 1 FROM public.call_sheets
        JOIN public.project_spaces ON call_sheets.project_id = project_spaces.id
        WHERE call_sheets.notes LIKE '%' || storage.objects.name || '%'
        AND project_spaces.creator_id = auth.uid()
    ))
);
