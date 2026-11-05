-- READ ONLY. Step ET preflight: for every function that logged-out visitors can still call, which policies use it,
-- and can logged-out visitors read / write that table at all?
-- Paste the result (CSV) back. Nothing is changed by this query.
--
-- How to read it:
--   anon_can_select / anon_can_insert / anon_can_update / anon_can_delete = does the anon role have the TABLE permission at all.
--   If all four are false, the policy never runs for logged-out visitors, so the helper does not need to be callable by them.
--   If anon_can_select is true, logged-out pages may really read that table, and the helper must stay (or the policy must be limited
--   to signed-in people first).

with fns as (
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'EXECUTE')
)
select f.proname as helper,
       pol.schemaname || '.' || pol.tablename as table_name,
       pol.policyname,
       pol.cmd,
       pol.roles::text as policy_roles,
       has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'SELECT') as anon_can_select,
       has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'INSERT') as anon_can_insert,
       has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'UPDATE') as anon_can_update,
       has_table_privilege('anon', format('%I.%I', pol.schemaname, pol.tablename), 'DELETE') as anon_can_delete
from fns f
join pg_policies pol
  on (pol.roles && array['anon','public']::name[])
 and (coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,'')) ~ ('\m' || f.proname || '\M')
order by 6 desc, 1, 2, 3;
