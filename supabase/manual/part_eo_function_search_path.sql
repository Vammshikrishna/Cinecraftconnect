-- PART EO - give every function in schema public a fixed search_path. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND ("Function Search Path Mutable", ~70 functions, e.g. has_role, handle_new_user, search_vendors, shadow_ban_user):
-- these functions have no search_path of their own, so they use the caller's. For SECURITY DEFINER functions that is a classic hijack route
-- (someone creates a look-alike object in a schema that is searched first). Fixing the path closes it.
-- THE FIX: ALTER FUNCTION ... SET search_path = public, extensions, pg_temp  for every function in public that has none yet.
--   * public       : where all the app tables and functions live
--   * extensions   : where Supabase puts pgcrypto / uuid helpers, so unqualified calls like gen_random_bytes() or digest() keep working
--   * pg_temp last : so temp objects can never shadow real ones
-- auth.uid() and storage.* are always written with their schema in this code base, so they are not affected.
-- Functions that belong to an extension (for example the pg_trgm ones in public) are skipped, they cannot be altered.
-- Function bodies are not changed. Functions created later need this part run again.
--
-- PREFLIGHT (read only):  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                         where n.nspname = 'public' and p.prokind = 'f'
--                           and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
--                           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
-- POST-CHECK (read only): the same query; expect 0.
-- ROLLBACK for one function:  alter function public.<name>(<args>) reset search_path;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.sig);
  END LOOP;
END $$;
