-- PART EP - stop strangers from LISTING the files in the 7 public storage buckets. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND ("Public Bucket Allows Listing"): avatars, company_assets, marketplace-images, portfolios, post-media, project-assets and
-- vendor-images each have a SELECT policy on storage.objects with USING (bucket_id = '<bucket>') for everyone. That lets anybody (not signed in
-- as well) ask the API for the full list of file names in the bucket, and with names, user ids and folders they can browse everything.
-- WHY IT IS SAFE: pictures in a PUBLIC bucket are served from the public URL (/storage/v1/object/public/...), which does not use these policies
-- at all. The website and the app only use getPublicUrl for these buckets, so every image keeps loading. Nothing in the code lists these buckets.
-- THE FIX: drop the 7 "anyone can read" policies and add one replacement that lets a signed-in person see only the files THEY own
-- (needed so that upload / replace / delete of your own file keeps working, for example the portfolios clean-up in the post editor).
-- Server code with the service key (account deletion) is not affected.
-- One side effect: the encrypted-attachment fallback in packages/e2ee (supabase.storage.from(bucket).download) is only used when the plain public
-- fetch of the same file has failed; it would no longer work for files of other people in these buckets. The normal path is unchanged.
--
-- PREFLIGHT (read only):  select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
--                         and policyname in ('Public view avatars','Public view company_assets','Anyone can view marketplace images','Public view portfolios',
--                                            'Public view post-media','Public view project-assets','Anyone can view vendor images');   -- expect 7 rows
-- POST-CHECK (read only): the same query, expect 0 rows; and
--                         select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners read own public bucket files';
--                         -- expect 1 row: SELECT | {authenticated}
-- ROLLBACK for one bucket (example avatars):
--   create policy "Public view avatars" on storage.objects for select using (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public view company_assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view marketplace images" ON storage.objects;
DROP POLICY IF EXISTS "Public view portfolios" ON storage.objects;
DROP POLICY IF EXISTS "Public view post-media" ON storage.objects;
DROP POLICY IF EXISTS "Public view project-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vendor images" ON storage.objects;

DROP POLICY IF EXISTS "Owners read own public bucket files" ON storage.objects;
CREATE POLICY "Owners read own public bucket files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('avatars','company_assets','marketplace-images','portfolios','post-media','project-assets','vendor-images')
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );
