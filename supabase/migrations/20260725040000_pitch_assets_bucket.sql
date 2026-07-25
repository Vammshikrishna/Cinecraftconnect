-- Create the pitch_assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('pitch_assets', 'pitch_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up access controls for the bucket
-- Allow public read access to the bucket
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'pitch_assets');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pitch_assets' AND auth.role() = 'authenticated'
  );
