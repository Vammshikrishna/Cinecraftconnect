-- Support screenshots may contain personal data. Make the bucket private; only the uploader and staff
-- can read objects (via signed URLs). Objects are named "support-attachments/<uploader_uuid>-<random>.<ext>".
UPDATE storage.buckets SET public = false WHERE id = 'support';

DROP POLICY IF EXISTS "Auth view support" ON storage.objects;
DROP POLICY IF EXISTS "support_read_owner_or_staff" ON storage.objects;

CREATE POLICY "support_read_owner_or_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support'
    AND (
      public.is_current_user_internal()
      OR owner = auth.uid()
      OR name LIKE 'support-attachments/' || auth.uid()::text || '-%'
    )
  );
