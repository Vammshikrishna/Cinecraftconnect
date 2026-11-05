-- PART EN - logged-out visitors can no longer call the "needs a login" functions through the API. Safe to run more than once. Run any time.
--
-- WHAT THE LINTER FOUND: ~250 SECURITY DEFINER functions in public can be executed by the anon role (people who are not signed in), e.g.
-- /rest/v1/rpc/staff_send_gift, billing_set_mode, ban_user, assign_user_role, force_logout_user. Each one has its own checks inside, but a
-- function that can only ever make sense for a signed-in person should not be reachable by a stranger at all (defence in depth).
-- THE FIX: for the functions below (staff / billing writes / moderation / calls / bookings / invites / gifts / "my_*" / respond_* / request_* /
-- submit_* ...) revoke EXECUTE from PUBLIC and anon, and make sure authenticated and service_role keep it. Signed-in use is unchanged.
-- LEFT ALONE ON PURPOSE (logged-out pages use them): username_available, resolve_profile_id, get_profile_*, list_recommendations, film ratings,
-- record_*_view, get_shared_wishlist, listing_booked_ranges, search_*, get_algorithmic_feed, room_member_counts, billing_list_products,
-- billing_mode, log_post_impressions ...
-- SAFETY NET: a function that is mentioned in any row-level-security policy that applies to anon / public is SKIPPED (those policies run
-- the function for logged-out visitors, revoking it would break public pages). Skipped names are printed as NOTICE.
-- NOT COVERED: functions created later (Supabase grants execute to anon by default). Run this part again after adding RPC functions.
--
-- PREFLIGHT (read only):  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--                         where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
--                           and has_function_privilege('anon', p.oid, 'EXECUTE');
-- POST-CHECK (read only): the same query; expect it to drop by roughly 200 (what stays is the public-page list above plus policy helpers).
-- ROLLBACK for one function if a logged-out page breaks:  grant execute on function public.<name>(<args>) to anon;

DO $$
DECLARE
  r record;
  pattern text :=
    '^(staff_(?!rank$|mfa_ok$|notification_allowed$).*'
    '|gov_.*|moderator_.*|my_.*|respond_.*|request_.*|submit_.*|invite_.*|reply_.*|withdraw_.*|review_.*|get_my_.*|mark_.*_seen'
    '|billing_(set_.*|grant_.*|expire_.*|overview|live_impact|apply_.*|create_.*|claim_.*|fail_.*|my_.*)'
    '|assign_user_role|revoke_user_role|ban_user|shadow_ban_user|shadow_ban|mute_user|lift_ban|restore_user_access|force_logout_user'
    '|force_password_reset_user|approve_verification|reject_verification|resolve_report|resolve_flagged_message|list_flagged_messages'
    '|set_monetization_status|get_platform_economics|get_admin_stats|get_risk_distribution|claim_admin_access|issue_strike|revoke_strike'
    '|uphold_appeal|add_moderation_note|get_report_precedents|get_user_record|set_on_duty|purge_expired_staff_access|qa_sample_case|end_staff_access'
    '|approve_space_access|reject_space_access|approve_join_request|reject_join_request|close_expired_pitch_calls|close_overdue_jobs'
    '|expire_stale_calls|release_due_posts|answer_call|cancel_call|decline_call|create_or_start_call|reconcile_call_state'
    '|verify_call_room_membership|clear_room_messages|clear_project_space_messages|accept_gift|decline_gift|open_gift|_apply_gift'
    '|_gift_recipients|activate_beta_gifts|cancel_page_invite|cancel_date_hold|leave_page_team|set_page_admin|transfer_page_ownership'
    '|set_e2ee_enabled|rotate_group_key|group_key_status|attach_post_poll|vote_in_poll|remove_poll_vote|reschedule_post|write_recommendation'
    '|toggle_skill_endorsement|mark_announcements_seen|hide_message_for_user|ignore_connection_request|rate_support_ticket|close_support_ticket'
    '|reopen_support_ticket|open_marketplace_dispute|open_order_dispute|decide_quote|create_discussion_room_with_creator|remove_post_collaborator'
    '|total_unread_count|get_total_unread_count|has_unread_messages|get_unread_message_previews|get_user_conversations_with_profiles'
    '|get_messages_for_channel|get_messages_for_channel_paginated|get_connection_context|get_relationship|can_message_user'
    '|blocked_user_ids_both_ways|list_introductions|list_project_invites|list_date_holds|introduction_options|network_insights|network_overview'
    '|page_analytics|page_followers|job_analytics|pitch_call_stats|seller_hub_stats|suggest_collaborators|suggest_people|profile_hint'
    '|unread_announcement_count|record_announcement_view|export_my_data|get_nda_record|get_post_insights|get_crew_contact|get_nda_record'
    '|key_vault_.*|list_user_storage_objects|claim_background_jobs|calculate_daily_engagement_score|get_my_wishlist_token|reset_my_wishlist_token'
    '|log_pitch_call_view)$';
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prorettype <> 'trigger'::regtype
      AND p.proname ~ pattern
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies pol
      WHERE (pol.roles && ARRAY['anon','public']::name[])
        AND (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~ ('\m' || r.name || '\M')
    ) THEN
      RAISE NOTICE 'skipped (used by an anon/public policy): %', r.sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
