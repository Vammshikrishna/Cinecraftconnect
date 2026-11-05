-- PART EZ - Performance Advisor "Multiple Permissive Policies", step 1 of 2, plus the last Duplicate Index. Safe to run more than once. Any time.
--
-- WHY ~400 ROWS: many policies are written "TO public" (every role). The linter then reports each table / action once for EVERY role that exists:
--   anon, authenticated, authenticator, cli_login_postgres, dashboard_user, supabase_privileged_role. The website and the apps only ever use anon (logged out) and
--   authenticated (signed in) through the API. The other four are internal login roles that never read your tables through the API.
-- 1. Every PERMISSIVE policy in public that is "TO public" is changed to "TO anon, authenticated". The USING / WITH CHECK text is NOT touched, so for anon and
--    authenticated the behaviour is identical. service_role and postgres bypass row-level security, so they are not affected either.
--    RESTRICTIVE policies are left alone (they must keep applying to everyone). Policies that already name roles are left alone.
--    Expected effect: roughly 2/3 of the rows disappear. What remains (a few dozen tables with real overlap for anon / authenticated) is step 2:
--    merging overlapping policies table by table, which changes policy text and is done separately, with a dry run first.
-- 2. user_roles: user_roles_user_id_key and user_roles_user_id_unique are identical constraints. The second one is dropped unless something depends on it
--    (then it is skipped and printed as NOTICE; nothing breaks). ON CONFLICT (user_id) keeps working with the remaining one.
--
-- PREFLIGHT (read only): how many policies are still "TO public" and permissive:
--   select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and roles = '{public}';
-- POST-CHECK (read only): the same query, expect 0.
-- ROLLBACK for one policy: alter policy "<name>" on public.<table> to public;      (the changed policies are printed as NOTICE)
-- ROLLBACK for the constraint: alter table public.user_roles add constraint user_roles_user_id_unique unique (user_id);

-- 1. TO public -> TO anon, authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND roles = '{public}'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO anon, authenticated', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'policy % on %.% now TO anon, authenticated (was public)', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END $$;

-- 2. user_roles duplicate unique
DO $$
DECLARE
  idx oid;
  con text;
BEGIN
  SELECT i.indexrelid INTO idx
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user_roles_user_id_unique';

  IF idx IS NULL THEN
    RAISE NOTICE 'user_roles_user_id_unique not found (already dropped)';
    RETURN;
  END IF;

  SELECT conname INTO con FROM pg_constraint WHERE conindid = idx AND conrelid = 'public.user_roles'::regclass LIMIT 1;

  BEGIN
    IF con IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT %I', con);
    ELSE
      EXECUTE 'DROP INDEX public.user_roles_user_id_unique';
    END IF;
  EXCEPTION WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'user_roles_user_id_unique is still needed by something, skipped (harmless)';
  END;
END $$;
