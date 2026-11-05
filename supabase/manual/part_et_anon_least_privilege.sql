-- PART ET - least privilege for logged-out visitors (the anon role). Safe to run more than once. Run any time (after ER and ES).
--
-- WHAT THE PREFLIGHT SHOWED (audit_step_et_preflight.sql): the anon role has SELECT / INSERT / UPDATE / DELETE permission on almost every table
-- (Supabase's default). Only the row-level-security policies stood in the way, and many of those policies are written "for everyone", so the
-- helper functions they call (has_role, staff_rank, cl_can_see_call ...) had to stay callable by logged-out visitors too.
-- THE FIX, in three steps:
--   1. Private tables (staff tools, support, calls, chat, project chat, moderation, disputes ...): REVOKE ALL from anon. Logged-out visitors
--      can no longer even ask for those tables. Tables that public pages read (profiles, posts, listings, vendors, rooms, projects ...) are NOT touched.
--   2. Every table in schema public: REVOKE INSERT, UPDATE, DELETE, TRUNCATE from anon. Logged-out visitors never write to tables directly
--      (sign-up, view counters and username checks go through functions or the auth service).
--   3. Functions: REVOKE EXECUTE from anon for every SECURITY DEFINER function that is NOT one of the public-page functions listed below and that no
--      policy for anon / public (on a table anon can still reach), view, default, constraint or other function depends on.
-- PUBLIC-PAGE FUNCTIONS KEPT: billing_list_products, get_aggregated_film_ratings, get_algorithmic_feed, get_connection_counts, get_film_rating_detail,
--   get_profile_access, get_profile_activity, get_profile_availability, get_profile_counts, get_shared_wishlist, get_story_full_synopsis, list_film_reviews,
--   list_recommendations, list_user_connections, listing_booked_ranges, log_post_impressions, record_job_view, record_listing_view, record_page_view,
--   record_profile_view, resolve_profile_id, room_member_counts, skill_endorsement_summary, trending_community_titles, username_available.
-- Skipped functions are printed as NOTICE.
--
-- PREFLIGHT (read only):  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'EXECUTE');   -- about 50
-- POST-CHECK (read only): the same query; it should drop clearly (the rest are public-page functions and policy helpers for public tables).
-- ROLLBACK a table:    grant select on public.<table> to anon;      (add insert, update, delete only if you really need them)
-- ROLLBACK a function: grant execute on function public.<name>(<args>) to anon;

-- 1. private tables
DO $$
DECLARE t text;
DECLARE private_tables text[] := ARRAY[
  'audit_logs','content_reports','fraud_networks','legal_requests','messages','moderation_evidence','moderation_notes','platform_rules',
  'room_messages','support_ticket_messages','support_tickets','system_incidents','user_bans','user_risk_profiles','verification_requests',
  'vip_invites','calls','call_participants','project_messages','project_space_messages','project_space_message_reactions','appeals','gov_rules',
  'marketplace_dispute_messages','marketplace_disputes','mod_bundles','mod_templates','qa_reviews','screen_rules','staff_alerts',
  'staff_behaviour_runs','staff_duty','user_notices','user_strikes','pitch_calls'
];
BEGIN
  FOREACH t IN ARRAY private_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- 2. no direct writes by logged-out visitors anywhere in public
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- 3. functions
DO $$
DECLARE
  r record;
  had_auth boolean;
  had_srv boolean;
  keep text[] := ARRAY[
    'billing_list_products','get_aggregated_film_ratings','get_algorithmic_feed','get_connection_counts','get_film_rating_detail',
    'get_profile_access','get_profile_activity','get_profile_availability','get_profile_counts','get_shared_wishlist','get_story_full_synopsis',
    'list_film_reviews','list_recommendations','list_user_connections','listing_booked_ranges','log_post_impressions','record_job_view',
    'record_listing_view','record_page_view','record_profile_view','resolve_profile_id','room_member_counts','skill_endorsement_summary',
    'trending_community_titles','username_available'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY (keep))
  LOOP
    -- a policy for anon / public on a table anon can still reach needs the function
    IF EXISTS (
         SELECT 1 FROM pg_policies pol
         WHERE (pol.roles && ARRAY['anon','public']::name[])
           AND (coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,'')) ~ ('\m' || r.proname || '\M')
           AND (   has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'SELECT')
                OR has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'INSERT')
                OR has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'UPDATE')
                OR has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'DELETE'))
       )
       -- views, defaults, constraints, indexes, trigger conditions that depend on it
       OR EXISTS (
         SELECT 1 FROM pg_depend d
         WHERE d.refobjid = r.oid AND d.deptype IN ('n','a')
           AND d.classid IN ('pg_attrdef'::regclass, 'pg_constraint'::regclass, 'pg_trigger'::regclass, 'pg_rewrite'::regclass, 'pg_class'::regclass)
       )
       -- other functions that run with the caller's rights and call it
       OR EXISTS (
         SELECT 1 FROM pg_proc p2 JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
         WHERE n2.nspname = 'public' AND p2.oid <> r.oid AND p2.prokind = 'f' AND NOT p2.prosecdef
           AND p2.prosrc ~ ('\m' || r.proname || '\M')
       )
    THEN
      RAISE NOTICE 'kept (something still needs it): %', r.sig;
      CONTINUE;
    END IF;
    had_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    had_srv  := has_function_privilege('service_role', r.oid, 'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    -- only give back what the revoke of PUBLIC may have taken away; never widen access
    IF had_auth AND NOT has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF had_srv AND NOT has_function_privilege('service_role', r.oid, 'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;
