-- Migration: Fix permissions for storage.buckets
-- The client cannot see the bucket, causing "Bucket not found" errors.
-- This adds a policy to allow authenticated users to list/see buckets.

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Authenticated can list buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Public can list public buckets" ON storage.buckets;

-- Allow authenticated users to select (list) buckets
CREATE POLICY "Authenticated can list buckets"
ON storage.buckets FOR SELECT
TO authenticated
USING ( true );

-- Also allow public access to public buckets (for good measure)
CREATE POLICY "Public can list public buckets"
ON storage.buckets FOR SELECT
TO public
USING ( public = true );
