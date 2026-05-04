-- 34_harden_storage_security.sql
-- Hardening storage policies for all buckets and ensuring public access for optimized delivery

-- 1. Post Media Policies
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

-- 2. Call Sheets & Legal Docs (Private Access)
DROP POLICY IF EXISTS "Auth view call-sheets" ON storage.objects;
CREATE POLICY "Auth view call-sheets" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-sheets' );

DROP POLICY IF EXISTS "Auth view legal-docs" ON storage.objects;
CREATE POLICY "Auth view legal-docs" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'legal-docs' );

-- 3. Ensure profiles table column consistency
-- Many frontend components use cover_image_url while core schema used cover_url
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
        ALTER TABLE public.profiles RENAME COLUMN cover_url TO cover_image_url;
    END IF;
END $$;

-- 4. Social Graph Visibility
-- Standardize connection visibility so public profiles show correct counts
DROP POLICY IF EXISTS "Users can view own connections" ON public.user_connections;
DROP POLICY IF EXISTS "Anyone can view accepted connections" ON public.user_connections;
CREATE POLICY "Anyone can view accepted connections" ON public.user_connections 
FOR SELECT USING (status = 'accepted');

DROP POLICY IF EXISTS "Users can view own pending connections" ON public.user_connections;
CREATE POLICY "Users can view own pending connections" ON public.user_connections 
FOR SELECT USING (follower_id = auth.uid() OR following_id = auth.uid());

-- 5. Social & Content Column Consistency
-- Ensure posts and announcements have columns required by the UI for categorization
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS page_id uuid;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS publisher_page_id uuid;

-- 6. Optimized Asset Metadata (Optional helper)
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON public.user_connections (status);
CREATE INDEX IF NOT EXISTS idx_posts_page_id ON public.posts (page_id) WHERE page_id IS NOT NULL;
