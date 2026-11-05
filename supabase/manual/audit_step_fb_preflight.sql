-- AUDIT STEP FB PREFLIGHT - READ ONLY. Changes nothing. ONE result grid: run it once and paste the whole grid back to me.
-- Purpose: current policies, grants, row counts and columns of the tables with the known open access holes
-- (project_messages, vip_invites, project_space_members) and their neighbours, before I write the fix.

select 'policy' as section, tablename::text as item,
       policyname || ' | ' || permissive || ' | ' || cmd || ' | ' || roles::text as detail,
       'USING: ' || coalesce(qual, '-') || '  CHECK: ' || coalesce(with_check, '-') as extra
from pg_policies
where schemaname = 'public'
  and tablename in ('project_messages','vip_invites','project_space_members','project_spaces','project_space_messages',
                    'project_message_read_status','room_message_read_status','announcement_seen')

union all
select 'grant', table_name::text, grantee::text, string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('project_messages','vip_invites','project_space_members',
                     'project_message_read_status','room_message_read_status')
  and grantee in ('anon','authenticated')
group by table_name, grantee

union all
select 'rows', 'project_messages', count(*)::text, '' from public.project_messages
union all
select 'rows', 'vip_invites', count(*)::text, '' from public.vip_invites
union all
select 'rows', 'project_space_members', count(*)::text, '' from public.project_space_members

union all
select 'column', table_name::text, column_name::text, data_type::text
from information_schema.columns
where table_schema = 'public'
  and table_name in ('vip_invites','project_space_members','project_message_read_status','room_message_read_status')

order by 1, 2, 3;
