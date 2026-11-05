-- PART FC - clear the "SECURITY DEFINER function executable by signed-in users" Advisor warnings by moving the function bodies out of the API schema.
-- It APPLIES WHEN RUN to ALL eligible functions (only_names = NULL). Stage 1 (6 test functions) was done and tested. To limit a run, set only_names to e.g. ARRAY['my_gifts'].
-- "Success. No rows returned" means nothing was left to move.
--
-- HOW IT WORKS (the pattern Supabase recommends). For each SECURITY DEFINER function public.f(args) that signed-in users may call:
--   1. ALTER FUNCTION public.f(args) SET SCHEMA app_private;        the body, owner, search_path setting and privileges move unchanged.
--      app_private is NOT an exposed API schema, so nobody can call it over REST / RPC directly, and the linter does not list it.
--   2. CREATE FUNCTION public.f(args) ... SECURITY INVOKER ... AS SELECT * FROM app_private.f(args);     a thin wrapper, same name, same arguments (defaults kept),
--      same result type, same volatility, search_path pinned (so no new "search_path mutable" warning).
--   3. The wrapper gets exactly the EXECUTE grants the original had (anon / authenticated / service_role), nothing for PUBLIC.
--   The apps, edge functions and other SQL functions call public.f exactly as before. Inside the body nothing changes: it still runs with the owner's rights
--   (the wrapper calls the definer function, which switches to the owner), auth.uid() still reads the caller's token.
--
-- LEFT ALONE ON PURPOSE (skipped automatically, shown as step 'skip' with the reason):
--   * functions that a policy, view, column default, constraint or trigger depends on (policy helpers: has_role, staff_rank, is_room_member ...). Policies run as the caller.
--   * functions with OUT / INOUT / VARIADIC arguments, or unnamed arguments (move by hand if wanted). RETURNS TABLE and default arguments are handled.
--   About 26 policy helpers therefore keep their warning.
--
-- The whole DO block is one transaction: if anything fails nothing is changed. The result grid has the "applied" column and an undo statement per step. SAVE it.
-- PREFLIGHT: audit_step_fc_preflight.sql (the list of functions).
-- POST-CHECK (read only): select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef
--                         and has_function_privilege('authenticated', p.oid, 'EXECUTE');      -- drops by the number moved; then refresh the Advisor
-- SMOKE TESTS after the 6-function stage: open a profile (connection / post counts), a film page (ratings), the trending titles, Settings > account state, My gifts.
-- ROLLBACK: run the undo column in reverse seq order (drop the wrapper, then ALTER FUNCTION app_private.f(...) SET SCHEMA public).

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

DROP TABLE IF EXISTS pg_temp._w_plan;
CREATE TEMP TABLE _w_plan (seq int, fn text, step text, stmt text, undo text, applied boolean DEFAULT false);

DO $$
DECLARE
  only_names constant text[] := NULL;   -- NULL = all eligible functions (stage 1, the 6 test functions, is done)
  dry_run constant boolean := false;                                                                     -- true = plan only
  -- false = skip functions that a policy / view / default / constraint / trigger uses (first run).
  -- true  = move those too (the dependants follow the function by id, so policies keep working; a wrapper stays in public for callers by name).
  include_dependants constant boolean := true;
  r record; n int := 0; stp record;
  skip_reason text; arglist text; callargs text; vol text; a text; grants text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname::text AS fname,
           pg_get_function_identity_arguments(p.oid) AS idargs,
           pg_get_function_arguments(p.oid) AS allargs,
           pg_get_function_result(p.oid) AS res,
           p.provolatile, p.pronargdefaults, p.proargmodes::text AS modes,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS g_anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS g_auth,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS g_service
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND (only_names IS NULL OR p.proname = ANY (only_names))
    ORDER BY p.proname, 3
  LOOP
    skip_reason := NULL;

    IF NOT include_dependants AND EXISTS (SELECT 1 FROM pg_depend d
               WHERE d.refobjid = r.oid AND d.deptype = 'n'
                 AND d.classid IN ('pg_policy'::regclass, 'pg_rewrite'::regclass, 'pg_attrdef'::regclass,
                                   'pg_constraint'::regclass, 'pg_trigger'::regclass)) THEN
      skip_reason := 'used by a policy / view / default / constraint / trigger';
    ELSIF NOT include_dependants AND EXISTS (SELECT 1 FROM pg_policies pp
                  WHERE pp.schemaname = 'public'
                    AND (coalesce(pp.qual,'') || ' ' || coalesce(pp.with_check,'')) ~* ('\m' || r.fname || '\(')) THEN
      skip_reason := 'named in a policy';
    ELSIF r.modes IS NOT NULL AND r.modes ~ '[obv]' THEN
      skip_reason := 'has OUT / INOUT / VARIADIC arguments';
    ELSIF EXISTS (SELECT 1 FROM unnest(string_to_array(r.idargs, ', ')) AS x
                  WHERE btrim(x) <> '' AND btrim(x) !~ '^[a-z_][a-z0-9_]* ') THEN
      skip_reason := 'unnamed or quoted arguments';
    END IF;

    n := n + 1;
    IF skip_reason IS NOT NULL THEN
      INSERT INTO _w_plan VALUES (n, r.fname || '(' || r.idargs || ')', 'skip', skip_reason, NULL);
      CONTINUE;
    END IF;

    -- argument names for the call: first word of each identity argument
    SELECT coalesce(string_agg(split_part(btrim(x), ' ', 1), ', '), '') INTO callargs
    FROM unnest(string_to_array(r.idargs, ', ')) AS x WHERE btrim(x) <> '';
    arglist := CASE WHEN r.pronargdefaults > 0 THEN r.allargs ELSE r.idargs END;
    vol := CASE r.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END;

    grants := '';
    FOREACH a IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF (a = 'anon' AND r.g_anon) OR (a = 'authenticated' AND r.g_auth) OR (a = 'service_role' AND r.g_service) THEN
        grants := grants || format('; GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s', r.fname, r.idargs, a);
      END IF;
    END LOOP;

    INSERT INTO _w_plan VALUES (n, r.fname || '(' || r.idargs || ')', 'move',
      format('ALTER FUNCTION public.%I(%s) SET SCHEMA app_private', r.fname, r.idargs),
      format('ALTER FUNCTION app_private.%I(%s) SET SCHEMA public', r.fname, r.idargs));
    n := n + 1;
    INSERT INTO _w_plan VALUES (n, r.fname || '(' || r.idargs || ')', 'wrapper',
      format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s SECURITY INVOKER SET search_path = public, extensions, pg_temp AS $w$ SELECT * FROM app_private.%I(%s) $w$',
             r.fname, arglist, r.res, vol, r.fname, callargs),
      format('DROP FUNCTION public.%I(%s)', r.fname, r.idargs));
    n := n + 1;
    INSERT INTO _w_plan VALUES (n, r.fname || '(' || r.idargs || ')', 'grants',
      format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role', r.fname, r.idargs) || grants,
      NULL);
  END LOOP;

  IF NOT dry_run THEN
    FOR stp IN SELECT * FROM _w_plan WHERE _w_plan.step <> 'skip' ORDER BY _w_plan.seq LOOP
      EXECUTE stp.stmt;   -- the 'grants' step holds several statements separated by ;
    END LOOP;
    UPDATE _w_plan SET applied = true WHERE step <> 'skip';
    RAISE NOTICE 'applied % steps, % functions skipped', (SELECT count(*) FROM _w_plan WHERE step <> 'skip'), (SELECT count(*) FROM _w_plan WHERE step = 'skip');
  ELSE
    RAISE NOTICE 'DRY RUN: nothing changed';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT applied, seq, fn, step, stmt, undo FROM _w_plan ORDER BY seq;
