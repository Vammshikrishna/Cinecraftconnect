-- PART FA - Performance Advisor "Multiple Permissive Policies", step 2 of 2: merge overlapping policies. APPLIES WHEN RUN (the dry run was already done).
-- The first column of the result grid, "applied", is true when the changes were made. To only see the plan, set dry_run to true in the DO block.
--
-- WHAT IT DOES. Several permissive policies for the same table / action / role are OR-ed by Postgres anyway, but each one is evaluated separately.
-- For every table that has such an overlap for anon or authenticated, this script
--   1. takes the policies that overlap (an "ALL" policy counts for all four actions),
--   2. drops them and creates ONE policy per action (SELECT / INSERT / UPDATE / DELETE) and per group of roles that were covered by the same policies,
--      with   USING = (q1) OR (q2) ...   and   WITH CHECK = (c1) OR (c2) ...    where c = the policy's WITH CHECK, or its USING when it has no WITH CHECK
--      (that is exactly how Postgres reads a policy without WITH CHECK). The expression text of each old policy is copied unchanged.
--   Who can see / change which rows is therefore identical: permissive policies are OR-ed, and OR-ing them in one policy gives the same result.
--   RESTRICTIVE policies and policies that do not overlap are not touched. A table where an overlapping policy names a role other than
--   anon / authenticated is skipped (printed as NOTICE) and left for a manual look.
--
-- HOW TO RUN.
--   1. Run it as it is (dry_run = false). It applies the merge. The whole DO block is one transaction: if anything fails, nothing is changed.
--      The result grid lists every DROP and CREATE with its undo statement; the "applied" column is true when the changes were made.
--   2. To only see the plan first, change  dry_run constant boolean := false;  to  true  (one place, in the DO block). To apply to a few tables first,
--      set  only_tables  to e.g. ARRAY['posts','jobs'].
--   3. SAVE the result grid (the undo column) before you close the editor.
--
-- POST-CHECK (read only), expect 0 rows (or only the tables that were skipped):
--   select tablename, cmd, count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' group by 1, 2 having count(*) > 1;
--   (an "ALL" policy next to a per-action policy still shows there; the Advisor is the real check)
-- ROLLBACK: run the undo of every 'create' row (they are DROP POLICY), then the undo of every 'drop' row (they are CREATE POLICY).

DROP TABLE IF EXISTS pg_temp._m_exp;
DROP TABLE IF EXISTS pg_temp._m_plan;

-- one row per (table, policy, action, role) for anon / authenticated
CREATE TEMP TABLE _m_exp AS
SELECT p.tablename::text AS tablename, p.policyname::text AS policyname, a.act, r.rl
FROM pg_policies p
CROSS JOIN LATERAL unnest(CASE p.cmd WHEN 'ALL' THEN ARRAY['SELECT','INSERT','UPDATE','DELETE'] ELSE ARRAY[p.cmd::text] END) AS a(act)
CROSS JOIN LATERAL unnest(ARRAY['anon','authenticated']) AS r(rl)
WHERE p.schemaname = 'public'
  AND p.permissive = 'PERMISSIVE'
  AND (p.roles::text[] @> ARRAY[r.rl] OR p.roles::text[] = ARRAY['public']);

CREATE TEMP TABLE _m_plan (seq int, tablename text, kind text, action text, stmt text, undo text, applied boolean DEFAULT false);

DO $$
DECLARE
  dry_run constant boolean := false;         -- false = APPLY (this is the default now); true = plan only
  only_tables constant text[] := NULL;       -- e.g. ARRAY['posts','jobs'] to limit the run
  acts constant text[] := ARRAY['SELECT','INSERT','UPDATE','DELETE'];
  t text; a text; grp record; pol record; step record;
  inv text[]; using_expr text; check_expr text; stmt text; new_name text; role_list text;
  seq int := 0;
BEGIN
  FOR t IN
    SELECT DISTINCT o.tablename
    FROM (SELECT tablename, act, rl FROM _m_exp GROUP BY tablename, act, rl HAVING count(*) > 1) o
    ORDER BY 1
  LOOP
    IF only_tables IS NOT NULL AND NOT (t = ANY (only_tables)) THEN CONTINUE; END IF;

    SELECT array_agg(DISTINCT e.policyname) INTO inv
    FROM _m_exp e
    WHERE e.tablename = t
      AND (e.act, e.rl) IN (SELECT act, rl FROM _m_exp WHERE tablename = t GROUP BY act, rl HAVING count(*) > 1);

    IF EXISTS (SELECT 1 FROM pg_policies pp CROSS JOIN LATERAL unnest(pp.roles::text[]) x
               WHERE pp.schemaname = 'public' AND pp.tablename = t AND pp.policyname::text = ANY (inv)
                 AND x NOT IN ('anon','authenticated','public')) THEN
      RAISE NOTICE 'skipped %: an overlapping policy names a role other than anon / authenticated, merge it by hand', t;
      CONTINUE;
    END IF;

    -- drops (with the CREATE that undoes them)
    FOR pol IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname::text = ANY (inv) ORDER BY policyname LOOP
      seq := seq + 1;
      INSERT INTO _m_plan VALUES (
        seq, t, 'drop', pol.cmd,
        format('DROP POLICY %I ON public.%I', pol.policyname, t),
        format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s%s%s',
               pol.policyname, t, pol.cmd, array_to_string(pol.roles::text[], ', '),
               CASE WHEN pol.qual IS NOT NULL THEN ' USING (' || pol.qual || ')' ELSE '' END,
               CASE WHEN pol.with_check IS NOT NULL THEN ' WITH CHECK (' || pol.with_check || ')' ELSE '' END));
    END LOOP;

    -- merged policies
    FOREACH a IN ARRAY acts LOOP
      FOR grp IN
        SELECT s.pols, array_agg(s.rl ORDER BY s.rl) AS rls
        FROM (SELECT rl, array_agg(policyname ORDER BY policyname) AS pols
              FROM _m_exp WHERE tablename = t AND act = a AND policyname = ANY (inv) GROUP BY rl) s
        GROUP BY s.pols
      LOOP
        SELECT string_agg(DISTINCT '(' || qual || ')', ' OR ' ORDER BY '(' || qual || ')') INTO using_expr
        FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname::text = ANY (grp.pols) AND qual IS NOT NULL;

        SELECT string_agg(DISTINCT '(' || coalesce(with_check, qual) || ')', ' OR ' ORDER BY '(' || coalesce(with_check, qual) || ')') INTO check_expr
        FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname::text = ANY (grp.pols) AND coalesce(with_check, qual) IS NOT NULL;

        role_list := array_to_string(grp.rls, ', ');
        new_name := 'merged ' || lower(a) || ' ' || array_to_string(grp.rls, '+');
        stmt := NULL;

        IF a IN ('SELECT','DELETE') AND using_expr IS NOT NULL THEN
          stmt := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s USING (%s)', new_name, t, a, role_list, using_expr);
        ELSIF a = 'INSERT' AND check_expr IS NOT NULL THEN
          stmt := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO %s WITH CHECK (%s)', new_name, t, role_list, check_expr);
        ELSIF a = 'UPDATE' AND (using_expr IS NOT NULL OR check_expr IS NOT NULL) THEN
          stmt := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO %s', new_name, t, role_list)
                  || CASE WHEN using_expr IS NOT NULL THEN ' USING (' || using_expr || ')' ELSE '' END
                  || CASE WHEN check_expr IS NOT NULL THEN ' WITH CHECK (' || check_expr || ')' ELSE '' END;
        END IF;

        IF stmt IS NOT NULL THEN
          seq := seq + 1;
          INSERT INTO _m_plan VALUES (seq, t, 'create', a, stmt, format('DROP POLICY %I ON public.%I', new_name, t));
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF NOT dry_run THEN
    FOR step IN SELECT * FROM _m_plan ORDER BY seq LOOP
      EXECUTE step.stmt;
    END LOOP;
    UPDATE _m_plan SET applied = true;
    RAISE NOTICE 'applied % statements', (SELECT count(*) FROM _m_plan);
  ELSE
    RAISE NOTICE 'DRY RUN: nothing changed. % statements planned, see the result grid.', (SELECT count(*) FROM _m_plan);
  END IF;
END $$;

SELECT applied, seq, tablename, kind, action, stmt, undo FROM _m_plan ORDER BY seq;
