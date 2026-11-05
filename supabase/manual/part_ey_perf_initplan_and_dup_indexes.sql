-- PART EY - Performance Advisor: (1) "Auth RLS Initialization Plan" and (2) "Duplicate Index". Safe to run more than once. Any time.
--
-- 1. AUTH RLS INITPLAN (~200 policies): a policy that calls auth.uid() / auth.role() / auth.jwt() directly runs that call for EVERY row.
--    Written as (select auth.uid()) Postgres evaluates it once per query. The result is identical, only faster.
--    Every policy in schema public is read from pg_policies; each unwrapped auth.uid() / auth.role() / auth.jwt() call is wrapped and the policy is
--    updated with ALTER POLICY (name, table, roles and command stay the same; only the USING / WITH CHECK text changes).
--    Already-wrapped calls are not wrapped again, so a second run changes nothing. Each changed policy is printed as NOTICE.
-- 2. DUPLICATE INDEXES (5 pairs): one of each identical pair is dropped. A constraint-owned index is never dropped with DROP INDEX; if both of a pair
--    belong to constraints, or the index is still needed, the pair is skipped and printed as NOTICE.
--
-- NOT TOUCHED: "Multiple Permissive Policies" (several policies on the same table / role / action). Merging them changes who can see what, so it is
--    done table by table, never in bulk.
--
-- PREFLIGHT (read only): how many policies still call auth.* unwrapped:
--   select count(*) from pg_policies where schemaname = 'public' and
--     regexp_replace(coalesce(qual,'') || ' ' || coalesce(with_check,''), '\(\s*SELECT auth\.(uid|role|jwt)\(\)\s+AS\s+\w+\)', '', 'gi') ~* 'auth\.(uid|role|jwt)\(\)';
-- POST-CHECK (read only): the same query, expect 0. Then, for the indexes:
--   select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_announcements_posted_at','idx_direct_messages_protocol','idx_marketplace_listings_category','uq_marketplace_wishlists_user_listing');   -- expect 0 (or fewer than 4 if a NOTICE says skipped)
-- ROLLBACK 1: the old text is in the NOTICE lines (copy them before closing the SQL editor); or re-create the policy from supabase/migrations.
-- ROLLBACK 2: create index <name> on public.<table> (<columns>);   -- the identical remaining index shows the columns

-- 1. policies
DO $$
DECLARE
  r record;
  wrapped constant text := '\(\s*SELECT auth\.(uid|role|jwt)\(\)\s+AS\s+\w+\)';
  new_using text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    -- only policies that still have an unwrapped call
    IF regexp_replace(coalesce(r.qual,'') || ' ' || coalesce(r.with_check,''), wrapped, '', 'gi') !~* 'auth\.(uid|role|jwt)\(\)' THEN
      CONTINUE;
    END IF;

    -- step 1: turn already wrapped calls back into the plain call; step 2: wrap every call once
    new_using := CASE WHEN r.qual IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(r.qual, wrapped, 'auth.\1()', 'gi'), 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'gi') END;
    new_check := CASE WHEN r.with_check IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(r.with_check, wrapped, 'auth.\1()', 'gi'), 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'gi') END;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_using IS NOT NULL THEN stmt := stmt || ' USING (' || new_using || ')'; END IF;
    IF new_check IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || new_check || ')'; END IF;

    RAISE NOTICE 'policy % on %.%  OLD using=[%] check=[%]', r.policyname, r.schemaname, r.tablename, r.qual, r.with_check;
    EXECUTE stmt;
  END LOOP;
END $$;

-- 2. duplicate indexes (drop the second of each pair)
DO $$
DECLARE
  t text;
  r record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'idx_announcements_posted_at',
    'idx_direct_messages_protocol',
    'idx_marketplace_listings_category',
    'uq_marketplace_wishlists_user_listing'
  ] LOOP
    SELECT i.indexrelid, i.indrelid, c.relname AS idx,
           EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid) AS owned_by_constraint
    INTO r
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t;

    IF NOT FOUND THEN
      RAISE NOTICE 'index % not found (already dropped)', t;
    ELSIF r.owned_by_constraint THEN
      RAISE NOTICE 'index % belongs to a constraint, skipped', t;
    ELSE
      EXECUTE format('DROP INDEX public.%I', t);
    END IF;
  END LOOP;

  -- user_roles: user_roles_user_id_key and user_roles_user_id_unique are identical; drop the second only if it is a plain index
  SELECT i.indexrelid, EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid) AS owned_by_constraint
  INTO r
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user_roles_user_id_unique';

  IF NOT FOUND THEN
    RAISE NOTICE 'user_roles_user_id_unique not found (already dropped)';
  ELSIF r.owned_by_constraint THEN
    RAISE NOTICE 'user_roles_user_id_unique belongs to a constraint, skipped (keep both; harmless)';
  ELSE
    EXECUTE 'DROP INDEX public.user_roles_user_id_unique';
  END IF;
END $$;
