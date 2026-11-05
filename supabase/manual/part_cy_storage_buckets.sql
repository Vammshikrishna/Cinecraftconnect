-- PART CY - storage bucket fixes (audit step 11). Based on the live policies read in audit_step11_preflight.sql.
-- Safe to run any time; nothing in the apps uses the two buckets locked below (both are empty).
--
-- 1. call-sheets and legal-docs: any signed-in person could read every file in them and upload anywhere. The apps keep
--    call sheets and legal documents in the project-files bucket (members of the project only), so these two buckets are
--    simply closed: no one can read, write or delete through the API. (The server's service key still can.)
-- 2. resumes: a job poster could read ANY person's CV by creating an application whose resume link pointed at that file.
--    A CV now counts as part of an application only if it sits in the APPLICANT's own folder.

-- 1. close call-sheets and legal-docs
DROP POLICY IF EXISTS "Auth upload call-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Auth view call-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete call-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Owner update call-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload legal-docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth view legal-docs" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete legal-docs" ON storage.objects;
DROP POLICY IF EXISTS "Owner update legal-docs" ON storage.objects;

-- 2. resumes: only the applicant's own file counts
DROP POLICY IF EXISTS "Resumes read owner or hiring team" ON storage.objects;
CREATE POLICY "Resumes read owner or hiring team" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.job_applications a
        WHERE (a.resume_url = ('resumes:' || objects.name) OR a.resume_url LIKE ('%/resumes/' || objects.name))
          AND (storage.foldername(objects.name))[1] = a.applicant_id::text
          AND public.can_manage_job(a.job_id, auth.uid())
      )
    )
  );
