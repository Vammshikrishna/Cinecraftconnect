-- PART FQ (my reports) - adds the RPC list_my_reports() behind Settings > Help > "Your reports". Safe to run more than once.
--
-- WHY: people could send a report but never see what happened to it. content_reports is staff-only (RLS), so the app needs a small function that returns
-- ONLY the caller's own rows and ONLY user-safe columns: no reviewer, no assignee, no priority, no internal resolution note, no evidence, no auto actions.
-- HOW: same pattern as part FC: the work is done by a SECURITY DEFINER function in the private schema app_private (not exposed over the API), and
-- public.list_my_reports() is a thin SECURITY INVOKER wrapper the app calls. Both pin search_path. Logged-out visitors get nothing (no EXECUTE for anon).
-- The website degrades to "This list is not available yet" until this part is run.
--
-- PREFLIGHT (read only): select to_regprocedure('public.list_my_reports()');     -- null before, the signature after
-- POST-CHECK  (read only), signed in as any user in the SQL editor with: select set_config('request.jwt.claim.sub', '<a user id that made a report>', true);
--   select * from public.list_my_reports();      -- only that user's reports; no other columns than the ones below

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.list_my_reports()
RETURNS TABLE (id uuid, target_type text, reason text, details text, status text, created_at timestamptz, reviewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.target_type, r.reason, r.details, r.status, r.created_at, r.reviewed_at
    FROM public.content_reports r
   WHERE r.reported_by = auth.uid()
   ORDER BY r.created_at DESC
   LIMIT 200;
$$;
REVOKE ALL ON FUNCTION app_private.list_my_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.list_my_reports() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_my_reports()
RETURNS TABLE (id uuid, target_type text, reason text, details text, status text, created_at timestamptz, reviewed_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$
  SELECT * FROM app_private.list_my_reports();
$$;
REVOKE ALL ON FUNCTION public.list_my_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_reports() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
