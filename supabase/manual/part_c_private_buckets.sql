-- PART C: run ONLY after the new web build (signed URLs) is live.
BEGIN;
-- Full pitch decks are NDA-gated IP. Make the bucket private and only let the submitter, the owner of
-- the pitch call (or a targeted producer) and staff read them (via signed URLs created client-side).
UPDATE storage.buckets SET public = false WHERE id = 'pitch_assets';

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "pitch_assets_read_participants" ON storage.objects;

-- Objects are named "<submission_uuid>-full-deck-<timestamp>.<ext>".
CREATE POLICY "pitch_assets_read_participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pitch_assets'
    AND (
      public.is_current_user_internal()
      OR (
        name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-'
        AND EXISTS (
          SELECT 1
          FROM public.pitch_submissions s
          LEFT JOIN public.pitch_calls c ON c.id = s.pitch_call_id
          WHERE s.id = (left(storage.objects.name, 36))::uuid
            AND (
              s.submitter_id = auth.uid()
              OR c.creator_id = auth.uid()
              OR (c.attachments->>'target_producer_id') = auth.uid()::text
            )
        )
      )
    )
  );

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

COMMIT;
