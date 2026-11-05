-- PART ER - put the SERVER-ONLY functions back to server-only. RUN THIS SOON (after EN). Safe to run more than once.
--
-- WHAT WENT WRONG: part EN ended each revoke with "GRANT EXECUTE ... TO authenticated, service_role". For functions that the earlier parts
-- (CA, CB, CN, CS, BX, CT) had deliberately closed to signed-in people, that GRANT opened them again. Affected: billing_apply_event,
-- billing_claim_refund, billing_fail_refund, billing_create_order, billing_my_provider_subscription, billing_set_cancel_flag, key_vault_setup,
-- key_vault_try, list_user_storage_objects. Most check nothing about WHO calls them (the edge functions use the service key), so a signed-in person
-- could have called them directly. The linter list you pasted shows them under "Signed-In Users Can Execute".
-- THE FIX: revoke EXECUTE from PUBLIC, anon and authenticated for every function that only the server (service_role / cron / other SECURITY DEFINER
-- functions) calls, and keep service_role. The website and the app never call these (searched all client code), so nothing visible changes.
-- Also included: the other internal-only helpers that have no client caller: billing_expire_*, _apply_gift, _gift_recipients, notify_due_announcements,
-- claim_background_jobs, calculate_daily_engagement_score, verify_call_room_membership.
-- NOT included on purpose (the website or app calls them): close_expired_pitch_calls, close_overdue_jobs, release_due_posts, purge_expired_staff_access.
--
-- PREFLIGHT (read only): select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
--     and p.proname in ('billing_apply_event','billing_claim_refund','billing_fail_refund','billing_create_order','billing_my_provider_subscription',
--       'billing_set_cancel_flag','key_vault_setup','key_vault_try','list_user_storage_objects');      -- you will see these names
-- POST-CHECK (read only): the same query with the full name list below; expect 0 rows.

DO $$
DECLARE
  r record;
  names text[] := ARRAY[
    'billing_apply_event','billing_claim_refund','billing_fail_refund','billing_create_order','billing_my_provider_subscription',
    'billing_set_cancel_flag','billing_expire_products','billing_expire_subscriptions',
    'key_vault_setup','key_vault_try','list_user_storage_objects',
    '_apply_gift','_gift_recipients','notify_due_announcements',
    'claim_background_jobs','calculate_daily_engagement_score','verify_call_room_membership'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
