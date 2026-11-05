-- PART ES - take the API permission away from 30 functions that no website / app / edge code calls. Safe to run more than once. Run any time (after ER).
--
-- HOW THE LIST WAS MADE: audit_step_es_preflight.sql listed every function that signed-in people can call but whose name is not found in the code.
-- Each name below was then searched again in all of apps/, packages/ and supabase/functions (every file type, not only quoted strings, and
-- not counting the generated type files). Names that ARE used (approve_verification, force_logout_user, mute_user, restore_user_access,
-- set_monetization_status, get_unread_message_previews, get_user_conversations_with_profiles, mark_room_message_as_seen, ...) are NOT in this part.
-- WHAT THEY ARE: old admin functions (ban_user, assign_user_role, shadow_ban_user, lift_ban, resolve_report, revoke_user_role, get_platform_economics ...),
-- old call helpers (cancel_call, decline_call, expire_stale_calls), and helper functions that only other SECURITY DEFINER functions use
-- (are_connected, can_see_availability, effective_availability_status, is_page_team, pitch_is_blocked, staff_mfa_ok ...). SECURITY DEFINER functions
-- calling each other do not need the caller's permission, so those helpers keep working.
-- SAFETY NET: a function is skipped (printed as NOTICE) if the database itself depends on it: row-level-security policies, views, column defaults,
-- check constraints, indexes or trigger conditions. Skipped functions keep their permission.
-- THE FIX: REVOKE EXECUTE from PUBLIC, anon, authenticated; keep service_role.
--
-- PREFLIGHT (read only): select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') and p.proname in ('ban_user','assign_user_role','cancel_call','are_connected');
-- POST-CHECK (read only): the same query; expect 0 rows (or only names printed as "skipped" in the NOTICE output).
-- ROLLBACK for one function:  grant execute on function public.<name>(<args>) to authenticated;

DO $$
DECLARE
  r record;
  names text[] := ARRAY[
    'access_target_url','are_connected','assign_user_role','ban_user','billing_mode','booking_conflicts','can_see_availability',
    'cancel_call','decline_call','effective_availability_status','expire_stale_calls','get_aggregated_cinema_ratings','get_crew_contact',
    'get_follower_count','get_platform_economics','get_profile_snapshot','get_segmented_film_ratings','get_total_unread_count',
    'has_unread_messages','is_page_team','lift_ban','list_flagged_messages','pitch_is_blocked','remove_staff_memberships',
    'reset_my_wishlist_token','resolve_report','revoke_user_role','shadow_ban_user','staff_mfa_ok','verification_payment_problem'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (names)
  LOOP
    IF EXISTS (
         SELECT 1 FROM pg_policies pol
         WHERE (coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,'')) ~ ('\m' || r.proname || '\M')
       )
       OR EXISTS (
         SELECT 1 FROM pg_depend d
         WHERE d.refobjid = r.oid
           AND d.deptype IN ('n','a')
           AND d.classid IN ('pg_attrdef'::regclass, 'pg_constraint'::regclass, 'pg_trigger'::regclass,
                             'pg_rewrite'::regclass, 'pg_policy'::regclass, 'pg_class'::regclass)
       )
    THEN
      RAISE NOTICE 'skipped (the database depends on it): %', r.sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
