-- READ ONLY. Step EW preflight: of all SECURITY DEFINER functions that signed-in users can call, which ones never look at WHO is calling?
-- Paste the result (CSV) back. Nothing is changed by this query.
--
-- A function is listed when its body has NO auth.uid() / auth.role() / auth.jwt() AND does not call a permission helper
-- (staff_rank, is_staff*, has_role, is_*admin, is_*member, is_page_manager, can_*, cl_*, cv_*, gov_can_*, has_active_staff_grant, ...).
-- Argument names that look like a user id are flagged (takes_user_arg): those are the ones where someone could pass another person's id.
-- writes = the body contains INSERT / UPDATE / DELETE. Sorted so the riskiest come first.
-- Functions already reviewed (steps EU / EV) are left out, and so are the public-page functions logged-out visitors use on purpose.

with candidates as (
  select p.oid, p.proname, pg_get_function_arguments(p.oid) as args, p.prosrc, p.prolang
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and p.proname not in ('close_expired_pitch_calls','close_overdue_jobs','purge_expired_staff_access','release_due_posts','get_admin_stats',
                          'billing_grant_founding_plan','billing_live_impact','billing_overview','staff_run_billing_jobs',
                          'mark_message_as_seen','mark_project_message_as_seen','mark_room_message_as_seen')
)
select c.oid::regprocedure::text as function,
       has_function_privilege('anon', c.oid, 'EXECUTE')                                        as logged_out_can_call,
       (c.args ~* '(user_id|_user\M|p_user|p_target|p_subject|p_profile|_uid)')               as takes_user_arg,
       (c.prosrc ~* '\m(insert|update|delete)\M')                                              as writes,
       left(regexp_replace(c.prosrc, '\s+', ' ', 'g'), 700)                                    as body
from candidates c
where c.prosrc !~* '(auth\.uid\(\)|auth\.role\(\)|auth\.jwt\(\)|current_setting\(.request\.jwt)'
  and c.prosrc !~* '\m(staff_rank|is_staff\w*|has_role|is_\w*admin|is_\w*member\w*|is_page_manager|is_room_\w+|is_project_\w+|can_\w+|cl_\w+|cv_\w+|gov_can_\w+|has_active_staff_grant|check_is_\w+|announcement_visible)\M'
  and c.proname not in ('get_aggregated_film_ratings','get_algorithmic_feed','get_connection_counts','get_film_rating_detail','get_profile_access',
                        'get_profile_activity','get_profile_availability','get_profile_counts','get_shared_wishlist','get_story_full_synopsis',
                        'list_film_reviews','list_recommendations','list_user_connections','listing_booked_ranges','log_post_impressions',
                        'record_job_view','record_listing_view','record_page_view','record_profile_view','resolve_profile_id',
                        'room_member_counts','skill_endorsement_summary','trending_community_titles','username_available','billing_list_products')
order by 4 desc, 3 desc, 1;
