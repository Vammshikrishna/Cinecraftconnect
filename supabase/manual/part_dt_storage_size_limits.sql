-- PART DT - a file size limit on every storage bucket. Safe to run more than once.
-- Until now no bucket had a limit (file_size_limit was empty everywhere), so anyone who is allowed to upload could put in a
-- very large file. The apps already refuse big files on their own (8 MB images, 12 MB videos in the feed, 50 MB chat files, 5 MB
-- support screenshots, 10 MB documents, 15 MB pitch files); these limits are the same numbers or a little above them, so the
-- server stops what the apps would never send and nothing the apps allow is refused.
--
-- Notes:
--   * A bucket limit cannot raise the project-wide limit (Settings > Storage in the Supabase dashboard; 50 MB on the free
--     plan): the lower of the two applies.
--   * Existing files are not touched. Only new uploads are checked.
--   * Buckets that do not exist in the project are skipped (the UPDATE just matches nothing).
--   * To change one later, edit the number below and run the part again.
--
-- PREFLIGHT (read-only): current limits and the largest file already in each bucket.
SELECT b.id,
       b.public,
       b.file_size_limit AS current_limit,
       (SELECT max((o.metadata ->> 'size')::bigint) FROM storage.objects o WHERE o.bucket_id = b.id) AS largest_file_bytes,
       (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS objects
FROM storage.buckets b
ORDER BY b.id;

UPDATE storage.buckets AS b
SET file_size_limit = v.bytes
FROM (VALUES
  ('avatars',            10 * 1024 * 1024),   -- profile pictures (the app compresses; 8 MB original max)
  ('marketplace-images', 10 * 1024 * 1024),   -- listing pictures
  ('vendor-images',      10 * 1024 * 1024),   -- vendor pictures
  ('company_assets',     12 * 1024 * 1024),   -- page logos / showcase images (12 MB in the app)
  ('portfolios',         50 * 1024 * 1024),   -- feed and portfolio media (videos up to 40 MB in the app)
  ('post-media',         50 * 1024 * 1024),   -- chat / room / project-space attachments (50 MB in the app)
  ('project-assets',     50 * 1024 * 1024),   -- cinema submissions: images, video, documents
  ('project-files',      50 * 1024 * 1024),   -- project files, screenplays, call sheets
  ('pitch_assets',       20 * 1024 * 1024),   -- pitch decks and images (15 MB in the app)
  ('resumes',            10 * 1024 * 1024),   -- CVs
  ('support',             5 * 1024 * 1024),   -- help-request screenshots (5 MB in the app)
  ('page_docs',          12 * 1024 * 1024),   -- page verification documents (10 MB in the app)
  ('vendor_docs',        12 * 1024 * 1024),   -- vendor verification documents (10 MB in the app)
  ('legal-documents',    25 * 1024 * 1024),
  ('legal-docs',         25 * 1024 * 1024),
  ('call-sheets',        25 * 1024 * 1024)
) AS v(id, bytes)
WHERE b.id = v.id;

-- Check afterwards (read-only): every bucket with its new limit, and existing files that are already bigger than their
-- bucket's limit (they stay; only new uploads are checked).
SELECT b.id, b.file_size_limit
FROM storage.buckets b
ORDER BY b.id;

SELECT o.bucket_id, count(*) AS files_over_the_new_limit
FROM storage.objects o
JOIN storage.buckets b ON b.id = o.bucket_id
WHERE b.file_size_limit IS NOT NULL AND (o.metadata ->> 'size')::bigint > b.file_size_limit
GROUP BY o.bucket_id
ORDER BY o.bucket_id;
