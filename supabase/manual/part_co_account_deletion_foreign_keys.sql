-- PART CO - let accounts be deleted (audit step 2c)
-- Run in the Supabase SQL editor. Based on the live foreign keys read in audit_step2_preflight.sql.
--
-- Today 16 foreign keys point at profiles with no ON DELETE action, so deleting certain accounts fails.
-- This part fixes the ones where the right outcome is clear:
--   * "who reviewed / assigned / used" columns (nullable)      -> the link is cleared (SET NULL), the record stays
--   * support_ticket_messages.sender_id                        -> the person's own messages are deleted with them
-- It deliberately does NOT change these, because the records must be kept or need a person to decide:
--   payouts.seller_id, payout_holds.seller_id (money records), legal_requests.target_user_id (legal hold),
--   moderation_evidence.uploader_id, moderation_notes.author_id (staff audit trail).
-- The delete-account function now refuses those accounts with a clear message instead of failing half way.

DO $do$
DECLARE
  r record;
  v_con text;
  v_ref_table text;
  v_ref_col text;
  v_done integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('calls',                               'started_by',    'SET NULL'),
      ('company_page_verification_requests',  'reviewed_by',   'SET NULL'),
      ('content_reports',                     'assigned_to',   'SET NULL'),
      ('platform_announcements',              'created_by',    'SET NULL'),
      ('platform_policies',                   'created_by',    'SET NULL'),
      ('platform_rules',                      'updated_by',    'SET NULL'),
      ('platform_settings',                   'updated_by',    'SET NULL'),
      ('support_tickets',                     'assigned_to',   'SET NULL'),
      ('vendor_verification_requests',        'reviewed_by',   'SET NULL'),
      ('vip_invites',                         'used_by_id',    'SET NULL'),
      ('support_ticket_messages',             'sender_id',     'CASCADE')
    ) AS t(tbl, col, action)
  LOOP
    SELECT con.conname,
           con.confrelid::regclass::text,
           (SELECT a2.attname FROM pg_attribute a2 WHERE a2.attrelid = con.confrelid AND a2.attnum = con.confkey[1])
      INTO v_con, v_ref_table, v_ref_col
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.conrelid = ('public.' || r.tbl)::regclass
      AND a.attname = r.col
      AND con.confrelid = 'public.profiles'::regclass
      AND con.confdeltype IN ('a', 'r')
    LIMIT 1;

    IF v_con IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, v_con);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE %s',
                     r.tbl, v_con, r.col, 'public.profiles', v_ref_col, r.action);
      v_done := v_done + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'part_co: % foreign key(s) updated', v_done;
END
$do$;
