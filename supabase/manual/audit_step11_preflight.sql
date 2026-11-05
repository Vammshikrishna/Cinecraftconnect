-- AUDIT STEP 11 PRE-FLIGHT (storage buckets: legal docs, call sheets, resumes, pitch decks) - READ-ONLY.
-- Run once, export the CSV and paste it into the chat. Returns bucket flags, storage policy text and object COUNTS only.
SELECT '1_bucket' AS section, b.id::text AS object,
       'public=' || b.public::text || ' | size_limit=' || COALESCE(b.file_size_limit::text, '-') || ' | mime=' || COALESCE(array_to_string(b.allowed_mime_types, ','), '-') AS detail
FROM storage.buckets b
UNION ALL
SELECT '2_policy', policyname::text, cmd || ' | roles=' || roles::text || ' | using=' || COALESCE(qual, '') || ' | check=' || COALESCE(with_check, '')
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
UNION ALL
SELECT '3_objects', o.bucket_id::text, count(*)::text
FROM storage.objects o GROUP BY o.bucket_id
UNION ALL
SELECT '4_sample_paths', o.bucket_id::text, string_agg(DISTINCT split_part(o.name, '/', 1), ', ')
FROM storage.objects o WHERE o.bucket_id IN ('legal-docs', 'legal-documents', 'call-sheets', 'resumes', 'pitch-decks', 'project-files', 'support', 'post-media', 'portfolios')
GROUP BY o.bucket_id
ORDER BY 1, 2;
