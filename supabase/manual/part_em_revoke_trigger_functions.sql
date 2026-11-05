-- PART EM - take the "call me through the API" permission away from every trigger function. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND: about 150 functions such as guard_post, notify_new_room_message, handle_new_user, update_post_stats are
-- SECURITY DEFINER and executable by anon / authenticated, so they show up as /rest/v1/rpc/<name> in both linter lists
-- ("Public Can Execute" and "Signed-In Users Can Execute").
-- WHY IT IS SAFE: these functions return "trigger". Postgres checks the EXECUTE permission only when a trigger is CREATED, never when it
-- fires, and a trigger function cannot be called directly anyway ("trigger functions can only be called as triggers"). So revoking changes nothing
-- for the website or the app. Triggers keep working. The owner (postgres) and service_role keep their access.
-- THE FIX: one loop over every function in schema public whose return type is trigger; revoke EXECUTE from PUBLIC, anon, authenticated.
-- Functions created LATER are not covered (Supabase grants execute by default); run this part again after adding new trigger functions.
--
-- PREFLIGHT (read only):  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                         where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
--                           and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
-- POST-CHECK (read only): the same query; expect 0.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
