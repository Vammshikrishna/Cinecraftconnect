-- 20251201000007_create_project_files_bucket.sql
-- Create storage bucket for project files

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS is already enabled on storage.objects

-- Policy: Project members can view files
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files" ON storage.objects FOR SELECT USING (
    bucket_id = 'project-files' AND (
        -- Extract project_id from path (format: project_id/filename)
        EXISTS (
            SELECT 1 FROM public.project_space_members 
            WHERE project_space_id::text = split_part(name, '/', 1) AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);

-- Policy: Project members can upload files
DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
CREATE POLICY "Project members can upload project files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'project-files' AND (
        EXISTS (
            SELECT 1 FROM public.project_space_members 
            WHERE project_space_id::text = split_part(name, '/', 1) AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);

-- Policy: Project members can update their files
DROP POLICY IF EXISTS "Project members can update project files" ON storage.objects;
CREATE POLICY "Project members can update project files" ON storage.objects FOR UPDATE USING (
    bucket_id = 'project-files' AND (
        owner = auth.uid() OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);

-- Policy: File owners and project creators can delete files
DROP POLICY IF EXISTS "File owners can delete project files" ON storage.objects;
CREATE POLICY "File owners can delete project files" ON storage.objects FOR DELETE USING (
    bucket_id = 'project-files' AND (
        owner = auth.uid() OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);
