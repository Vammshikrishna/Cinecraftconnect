-- AUDIT STEP 0b - READ-ONLY: live definitions of the functions the audit flagged.
-- Run once in the Supabase SQL editor, export the result (CSV) and paste it into the chat.
-- It only reads function source text and trigger names. It changes nothing and returns no user data.
-- Columns: section | object | detail

SELECT '1_function_definition' AS section,
       p.oid::regprocedure::text AS object,
       pg_get_functiondef(p.oid) AS detail
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'claim_admin_access','send_governance_notification','clear_project_space_messages',
  'approve_join_request','reject_join_request','get_messages_for_channel_paginated',
  'create_discussion_room_with_creator','mark_message_as_seen','remove_staff_memberships',
  '_create_refund','approve_space_access','answer_call','cancel_call','decline_call')

UNION ALL
-- Triggers on tables the first check did not cover.
SELECT '2_trigger', tgrelid::regclass::text, tgname::text
FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid::regclass::text IN (
  'verification_requests','legal_docs','pitch_calls','discussion_rooms','user_settings','key_backups')

UNION ALL
-- Policies on tables the first check did not cover.
SELECT '3_policy', schemaname || '.' || tablename,
       policyname || ' | ' || cmd || ' | ' || permissive || ' | roles=' || roles::text
         || ' | USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-')
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
  'posts','profiles','profile_highlights','pitch_calls','nda_viewer_signatures','pitch_access_logs',
  'company_pages','vendors','marketplace_bookings','audit_logs','content_reports','direct_messages')

ORDER BY section, object, detail;
