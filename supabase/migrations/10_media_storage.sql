-- media_storage.sql

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('portfolios', 'portfolios', true),
    ('project-files', 'project-files', false),
    ('post-media', 'post-media', true),
    ('call-sheets', 'call-sheets', false),
    ('legal-docs', 'legal-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (Standardized)

-- All authenticated users can list buckets
DROP POLICY IF EXISTS "Authenticated can list buckets" ON storage.buckets;
CREATE POLICY "Authenticated can list buckets" ON storage.buckets FOR SELECT TO authenticated USING ( true );

-- Avatars: Public Read, Auth Upload
DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
CREATE POLICY "Public view avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Portfolios: Public Read, Owner Manage
DROP POLICY IF EXISTS "Public view portfolios" ON storage.objects;
CREATE POLICY "Public view portfolios" ON storage.objects FOR SELECT USING ( bucket_id = 'portfolios' );
CREATE POLICY "Owner manage portfolios" ON storage.objects FOR ALL USING ( bucket_id = 'portfolios' AND owner = auth.uid() );

-- Project Files: Access for project members only
DROP POLICY IF EXISTS "Project members view files" ON storage.objects;
CREATE POLICY "Project members view files" ON storage.objects FOR SELECT USING (
    bucket_id = 'project-files' AND EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
    )
);

-- 3. Post Media Policies
DROP POLICY IF EXISTS "Public view post-media" ON storage.objects;
CREATE POLICY "Public view post-media" ON storage.objects FOR SELECT USING ( bucket_id = 'post-media' );

DROP POLICY IF EXISTS "Auth upload post-media" ON storage.objects;
CREATE POLICY "Auth upload post-media" ON storage.objects FOR INSERT WITH CHECK ( 
    bucket_id = 'post-media' AND 
    auth.role() = 'authenticated' 
);

DROP POLICY IF EXISTS "Owner manage post-media" ON storage.objects;
CREATE POLICY "Owner manage post-media" ON storage.objects FOR ALL USING ( 
    bucket_id = 'post-media' AND 
    owner = auth.uid() 
);
