-- PART EX - move the pg_trgm extension out of schema public (the linter's "Extension in Public"). Safe to run more than once. Any time.
--
-- WHY IT IS SAFE: pg_trgm is only used by the GIN search indexes (ILIKE '%term%' on posts, profiles, projects, rooms, vendors, listings, pages ...).
-- An index remembers its operator class by id, not by name, so every index keeps working after the move. No function, policy or view of yours calls
-- the pg_trgm functions (similarity, word_similarity, show_trgm); the preflight below proves it. The "extensions" schema is in the search_path of
-- the API roles and of every function (part EO), so unqualified names still resolve.
--
-- PREFLIGHT (read only): your own functions / views that mention pg_trgm functions (expect 0 rows):
--   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
--     and p.prosrc ~* '(similarity|show_trgm|show_limit|set_limit|gin_trgm|gist_trgm)';
-- POST-CHECK (read only): select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';  -- extensions
--   Then search for a person, a post and a room on the website (results appear, no error).
-- ROLLBACK: alter extension pg_trgm set schema public;

DO $$
DECLARE cur text;
BEGIN
  SELECT n.nspname INTO cur
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF cur IS NULL THEN
    RAISE NOTICE 'pg_trgm is not installed, nothing to do';
  ELSIF cur = 'extensions' THEN
    RAISE NOTICE 'pg_trgm is already in extensions';
  ELSE
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;
