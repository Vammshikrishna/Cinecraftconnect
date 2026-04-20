-- Migration: Create 'avatars' bucket and policies
-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policies for 'avatars'

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete avatars" ON storage.objects;

-- SELECT: Public access (anyone can view avatars)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- INSERT: Authenticated users can upload avatars
CREATE POLICY "Authenticated can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND bucket_id = 'avatars'
);

-- UPDATE: Owners can update their own avatars
CREATE POLICY "Owners can update avatars"
ON storage.objects FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND bucket_id = 'avatars'
  AND owner = auth.uid()
);

-- DELETE: Owners can delete their own avatars
CREATE POLICY "Owners can delete avatars"
ON storage.objects FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND bucket_id = 'avatars'
  AND owner = auth.uid()
);
