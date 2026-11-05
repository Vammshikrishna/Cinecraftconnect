-- PART DQ - server-side upload rules for Supabase Storage. Safe to run more than once.
-- The web app already refuses SVG and dangerous extensions (apps/web/src/utils/fileValidation.ts BLOCKED_EXTENSIONS), but a
-- direct call to the Storage API skips the app. This part enforces the same rules in the database.
--
-- What it does:
--   A. One RESTRICTIVE policy on storage.objects for INSERT and one for UPDATE. A restrictive policy must pass IN ADDITION
--      to a bucket's own permissive policies, so no bucket policy can allow what these refuse. They apply to every bucket
--      and every role that uses RLS. The service role bypasses RLS and is unaffected.
--      An object name is refused when its file name (the part after the last '/'), ignoring trailing dots and spaces
--      (Windows drops them), has a blocked extension as the LAST segment OR as ANY dot-separated segment after the first.
--      So 'invoice.exe.txt', 'photo.svg', 'page.HTML', 'run.sh.' are all refused; 'my.script.v2.pdf' passes.
--      The list is copied exactly from BLOCKED_EXTENSIONS (a test keeps the two in step).
--      Existing objects are not changed or deleted. The UPDATE policy only checks the NEW name (a rename); it does not
--      hide existing rows.
--   B. allowed_mime_types is set only on buckets that hold nothing but pictures the app displays (see list below).
--   C. Public buckets and active documents: Supabase serves a file with the content-type stored with it, so the
--      extension block (A) plus the image-only mime list (B) are the control that stops a public bucket from serving
--      HTML or SVG as a page. Buckets whose mime list is left alone are covered by (A) only (a client may still claim any
--      content-type for a harmless extension; HTML/SVG/JS names are refused, which is what browsers key on in practice).
--
-- Buckets in the repo SQL / app code and how they are handled (B):
--   SET to images:   avatars, marketplace-images, vendor-images
--   NOT classified, allowed_mime_types left alone (they receive mixed content or types the code does not show):
--     post-media     chat / room / project-space attachments (images, video, audio, pdf, office, text, csv; mobile sends the
--                    picker's own mime type, which may be anything)
--     portfolios     feed posts and portfolio media (images, video); also the fallback target of post-media on mobile
--     portfolio-media (STORAGE_BUCKETS.PORTFOLIO_MEDIA) media; may not exist in the live project
--     project-files  project files, call sheets, legal documents, screenplays (documents of many kinds)
--     legal-documents, legal-docs, call-sheets   documents (the last two are closed by part_cy)
--     resumes        CVs (pdf / office / images)
--     support        help-request attachments (images, pdf, text)
--     pitch_assets   pitch decks and images
--     page_docs, vendor_docs   verification documents (pdf / images; client sends file.type)
--     company_assets, project-assets   (project-assets: cinema submissions, images / video / documents)
--     attachments    end-to-end encrypted chat files (application/octet-stream, '.enc' names); must stay unrestricted
--   A bucket that does not exist in the live project is simply skipped by the UPDATE in B.

-- PREFLIGHT (read-only): every bucket with its public flag, size limit and allowed mime types, and object counts.
SELECT b.id,
       b.public,
       b.file_size_limit,
       b.allowed_mime_types,
       (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS objects
FROM storage.buckets b
ORDER BY b.id;

-- A. name check function (immutable, no table access)
CREATE OR REPLACE FUNCTION public.storage_name_has_blocked_extension(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(
           (string_to_array(
              regexp_replace(
                (string_to_array(coalesce(p_name, ''), '/'))[cardinality(string_to_array(coalesce(p_name, ''), '/'))],
                '[[:space:].]+$', '', 'g'),
              '.'))[2:]
         ) AS seg
    WHERE lower(btrim(seg, E' \t\r\n')) = ANY (ARRAY[
      'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'msp', 'dll', 'sys', 'pif', 'cpl', 'lnk', 'reg', 'inf',
      'js', 'mjs', 'cjs', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1', 'sh', 'bash', 'zsh', 'csh', 'php', 'phtml', 'py', 'pl', 'rb',
      'jar', 'class', 'apk', 'aab', 'ipa', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'bin', 'run', 'hta', 'gadget',
      'html', 'htm', 'xhtml', 'shtml', 'svg', 'svgz', 'xml', 'xsl', 'swf',
      'docm', 'xlsm', 'pptm'
    ])
  );
$$;
GRANT EXECUTE ON FUNCTION public.storage_name_has_blocked_extension(text) TO anon, authenticated, service_role;

-- A. restrictive policies (apply to all buckets)
DROP POLICY IF EXISTS "Refuse blocked file types on upload" ON storage.objects;
CREATE POLICY "Refuse blocked file types on upload" ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (NOT public.storage_name_has_blocked_extension(name));

DROP POLICY IF EXISTS "Refuse blocked file types on rename" ON storage.objects;
CREATE POLICY "Refuse blocked file types on rename" ON storage.objects
  AS RESTRICTIVE
  FOR UPDATE
  USING (true)
  WITH CHECK (NOT public.storage_name_has_blocked_extension(name));

-- B. image-only buckets: pictures the app displays (mobile may send image/jpg or an HEIC photo)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'
    ]
WHERE id IN ('avatars', 'marketplace-images', 'vendor-images');
-- No video / audio / document list is set anywhere: every bucket that holds those also holds other things (see header).

-- Check afterwards (read-only): existing objects whose name would now be refused (reported only, never deleted)
SELECT o.bucket_id, count(*) AS objects_with_blocked_name
FROM storage.objects o
WHERE public.storage_name_has_blocked_extension(o.name)
GROUP BY o.bucket_id
ORDER BY o.bucket_id;
-- Other checks:
--   SELECT public.storage_name_has_blocked_extension('a/invoice.exe.txt');  -- true
--   SELECT public.storage_name_has_blocked_extension('a/my.script.v2.pdf'); -- false
