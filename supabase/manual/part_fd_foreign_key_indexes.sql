-- PART FD - Performance Advisor INFO "Unindexed foreign keys": add a covering index for the foreign keys that are worth it. Safe to run more than once. Applies when run.
--
-- WHY: when a row in the parent table (profiles, posts, projects ...) is deleted or its key changes, Postgres must find the matching child rows; without an
-- index on the child's foreign key column it scans the WHOLE child table, once per child table. That is the slow path of account deletion, cascades, and
-- of every join / filter on that column (e.g. "all comments of this user").
--
-- WHAT IT DOES: for every foreign key in schema public that has no index starting with its columns, it creates  CREATE INDEX IF NOT EXISTS fkidx_<table>_<columns>.
-- Plain btree on the foreign key columns, nothing else. The result grid lists every index created (with its DROP INDEX undo) and every foreign key skipped, with the reason.
--
-- SKIPPED ON PURPOSE (low value, write cost not worth it):
--   * staff / admin / audit / log / config tables (audit_logs, gov_*, platform_*, moderation_*, content_reports, flagged_messages, notification_logs, verification requests,
--     user_bans, legal_requests, staff_alerts, vip_invites, announcement_edits, group_key_history, dm_keys ...): small or write-heavy, rarely joined by these columns.
--   * foreign keys that point to the plans / products config tables (plan_code, product_code): those parent rows are never deleted.
--
-- NOT DONE: the "Unused Index" rows. "Never used" only means no use since the statistics were last reset; the database has little traffic yet and most of those
-- indexes are search / filter indexes that real traffic will use. Dropping them would save nothing visible and could make search slow later.
--
-- LOCKING: CREATE INDEX blocks writes to that one table while it builds (milliseconds to a few seconds at your size). Run it outside busy hours.
-- ROLLBACK: run the undo column (DROP INDEX ...), or one index at a time.
-- POST-CHECK: refresh the Advisor; the "Unindexed foreign keys" rows drop by the number created (the skipped ones stay, on purpose).

DROP TABLE IF EXISTS pg_temp._fk_plan;
CREATE TEMP TABLE _fk_plan (seq int, tablename text, fkey text, cols text, action text, stmt text, undo text, applied boolean DEFAULT false);

DO $$
DECLARE
  dry_run constant boolean := false;
  include_skipped constant boolean := true;   -- true = also index the staff / audit / config tables listed below (they are small, the cost is negligible)
  skip_tables constant text[] := ARRAY[
    'audit_logs','gov_audit_ledger','gov_approval_queue','gov_entity_relationships','notification_logs','pitch_access_logs',
    'platform_announcements','platform_flags','platform_policies','platform_rules','platform_settings','system_announcements',
    'staff_alerts','legal_requests','moderation_evidence','moderation_notes','content_reports','flagged_messages','vip_invites',
    'company_page_verification_requests','vendor_verification_requests','verification_requests','user_bans','help_article_feedback',
    'group_key_history','announcement_edits','dm_keys'];
  skip_parents constant text[] := ARRAY['plans','products'];
  r record; stp record; n int := 0; idx_name text; col_list text; name_cols text;
BEGIN
  FOR r IN
    SELECT c.oid AS conoid, c.conname::text AS conname, c.conrelid, c.conkey,
           cl.relname::text AS tablename, rf.relname::text AS parent
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class rf ON rf.oid = c.confrelid
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND NOT EXISTS (   -- a covering index already exists (index starts with the foreign key columns, no partial index)
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indpred IS NULL
          AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
    ORDER BY cl.relname, c.conname
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord),
           string_agg(a.attname, '_' ORDER BY k.ord)
      INTO col_list, name_cols
    FROM unnest(r.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.conrelid AND a.attnum = k.attnum;

    n := n + 1;
    IF NOT include_skipped AND r.tablename = ANY (skip_tables) THEN
      INSERT INTO _fk_plan VALUES (n, r.tablename, r.conname, col_list, 'skip', 'staff / audit / log / config table', NULL);
      CONTINUE;
    ELSIF NOT include_skipped AND r.parent = ANY (skip_parents) THEN
      INSERT INTO _fk_plan VALUES (n, r.tablename, r.conname, col_list, 'skip', 'points to a config table that is never deleted', NULL);
      CONTINUE;
    END IF;

    idx_name := left('fkidx_' || r.tablename || '_' || name_cols, 55) || '_' || left(md5(r.conname), 7);
    INSERT INTO _fk_plan VALUES (n, r.tablename, r.conname, col_list, 'create',
      format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', idx_name, r.tablename, col_list),
      format('DROP INDEX IF EXISTS public.%I', idx_name));
  END LOOP;

  IF NOT dry_run THEN
    FOR stp IN SELECT * FROM _fk_plan WHERE action = 'create' ORDER BY seq LOOP
      EXECUTE stp.stmt;
    END LOOP;
    UPDATE _fk_plan SET applied = true WHERE action = 'create';
    RAISE NOTICE 'created % indexes, skipped % foreign keys',
      (SELECT count(*) FROM _fk_plan WHERE action = 'create'), (SELECT count(*) FROM _fk_plan WHERE action = 'skip');
  ELSE
    RAISE NOTICE 'DRY RUN: nothing changed';
  END IF;
END $$;

SELECT applied, seq, tablename, fkey, cols, action, stmt, undo FROM _fk_plan ORDER BY action, seq;
