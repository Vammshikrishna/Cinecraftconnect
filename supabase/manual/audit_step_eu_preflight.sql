-- READ ONLY. Step EU preflight: do the signed-in-callable functions that look like jobs / admin / user-id overloads check WHO is calling?
-- Paste the result (CSV) back. Nothing is changed by this query.
--
-- Columns: checks_uid = body mentions auth.uid(); checks_staff = mentions a staff/role/admin check; takes_user_arg = has a *user* argument;
-- body = the function source (trimmed to 1500 chars) so it can be read.

select p.oid::regprocedure::text as function,
       pg_get_function_arguments(p.oid) as args,
       (p.prosrc ~* 'auth\.uid\(\)')                                                  as checks_uid,
       (p.prosrc ~* '(staff_rank|is_staff|has_role|is_market_admin|is_support_staff|super_admin|admin)') as checks_staff,
       (pg_get_function_arguments(p.oid) ~* '(user_id|_user|p_user)')                 as takes_user_arg,
       left(regexp_replace(p.prosrc, '\s+', ' ', 'g'), 1500)                          as body
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('close_expired_pitch_calls','close_overdue_jobs','purge_expired_staff_access','release_due_posts','get_admin_stats',
                    'billing_grant_founding_plan','billing_live_impact','billing_overview','staff_run_billing_jobs',
                    'mark_message_as_seen','mark_project_message_as_seen','mark_room_message_as_seen')
order by 1;
