-- READ ONLY. Step EV preflight: get_admin_stats() only checks two-step sign-in, then calls _impl_get_admin_stats().
-- Does the helper check that the caller is staff, and can ordinary signed-in users call the helper directly?
-- Paste the result (CSV) back. Nothing is changed by this query.

select p.oid::regprocedure::text as function,
       p.prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as signed_in_can_call,
       has_function_privilege('anon', p.oid, 'EXECUTE') as logged_out_can_call,
       (p.prosrc ~* '(staff_rank|is_staff|has_role|is_market_admin|super_admin|admin)') as checks_staff,
       left(regexp_replace(p.prosrc, '\s+', ' ', 'g'), 1200) as body
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('_impl_get_admin_stats', 'get_admin_stats')
order by 1;
