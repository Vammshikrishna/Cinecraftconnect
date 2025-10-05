-- Create RLS policies for portfolios storage bucket
-- Allow users to upload their own files
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portfolios' AND
  (storage.foldername(name))[1] = 'posts' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow anyone to view files in portfolios bucket (since it's public)
CREATE POLICY "Anyone can view portfolios files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'portfolios');

-- Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portfolios' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolios' AND
  (storage.foldername(name))[2] = auth.uid()::text
);