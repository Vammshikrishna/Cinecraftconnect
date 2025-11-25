-- Migration: Add RLS policies for the 'portfolios' storage bucket
-- Authenticated users can read objects in the bucket
-- Authenticated users can upload (insert) objects
-- Owners can delete their own objects

-- Note: RLS on storage.objects is already enabled by Supabase.

-- SELECT policy: only authenticated users can read objects in 'portfolios'
CREATE POLICY "authenticated read portfolios"
  ON storage.objects
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'portfolios'
  );

-- INSERT policy: only authenticated users can upload objects to 'portfolios'
CREATE POLICY "authenticated upload portfolios"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id = 'portfolios'
  );

-- DELETE policy: owners can delete their own objects in 'portfolios'
CREATE POLICY "owner delete portfolios"
  ON storage.objects
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'portfolios'
    AND owner = auth.uid()
  );
