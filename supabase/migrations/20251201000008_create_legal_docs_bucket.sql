-- Create legal-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false);

-- Enable RLS on storage.objects for legal-documents bucket
-- RLS is already enabled globally, we just need policies

-- Policy: Project members can view legal documents
CREATE POLICY "Project members can view legal documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'legal-documents' AND
    (
        EXISTS (
            SELECT 1 FROM public.legal_docs
            JOIN public.project_space_members ON legal_docs.project_id = project_space_members.project_space_id
            WHERE legal_docs.url LIKE '%' || storage.objects.name || '%'
            AND project_space_members.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.legal_docs
            JOIN public.project_spaces ON legal_docs.project_id = project_spaces.id
            WHERE legal_docs.url LIKE '%' || storage.objects.name || '%'
            AND project_spaces.creator_id = auth.uid()
        )
    )
);

-- Policy: Project members can upload legal documents
CREATE POLICY "Project members can upload legal documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'legal-documents' AND
    auth.uid() IS NOT NULL
);

-- Policy: Project members can update legal documents
CREATE POLICY "Project members can update legal documents"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'legal-documents' AND
    (
        EXISTS (
            SELECT 1 FROM public.legal_docs
            JOIN public.project_space_members ON legal_docs.project_id = project_space_members.project_space_id
            WHERE legal_docs.url LIKE '%' || storage.objects.name || '%'
            AND project_space_members.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.legal_docs
            JOIN public.project_spaces ON legal_docs.project_id = project_spaces.id
            WHERE legal_docs.url LIKE '%' || storage.objects.name || '%'
            AND project_spaces.creator_id = auth.uid()
        )
    )
);

-- Policy: Document uploaders and project creators can delete legal documents
CREATE POLICY "Document uploaders can delete legal documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'legal-documents' AND
    (
        owner = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.legal_docs
            JOIN public.project_spaces ON legal_docs.project_id = project_spaces.id
            WHERE legal_docs.url LIKE '%' || storage.objects.name || '%'
            AND project_spaces.creator_id = auth.uid()
        )
    )
);
