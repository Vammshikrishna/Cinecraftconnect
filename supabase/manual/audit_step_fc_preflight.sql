-- AUDIT STEP FC PREFLIGHT - READ ONLY. Changes nothing. ONE result grid: run it once and paste the whole grid back to me (or export CSV).
-- Purpose: sort the ~276 "SECURITY DEFINER function executable by signed-in users" Advisor rows into groups, so I can decide per group
-- which functions could safely become SECURITY INVOKER (or lose EXECUTE) and which must stay as they are.
--   used_by_policy = true  -> a policy / view / default calls it; must stay callable (policies run as the caller).
--   writes         = the body contains insert / update / delete / perform on a table -> a definer is probably needed (it writes what RLS would block).
--   checks_uid     = the body looks at auth.uid() or a helper like has_role / staff_rank.
--   tables         = tables the body reads or writes (first 6).

with defs as (
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args,
         p.prosrc as src, p.provolatile
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
pol as (
  select distinct d.oid
  from defs d
  join pg_policies pp on pp.schemaname = 'public'
   and (coalesce(pp.qual,'') || ' ' || coalesce(pp.with_check,'')) ~* ('\m' || d.proname || '\(')
)
select d.proname as function_name,
       d.args,
       case d.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end as volatility,
       (d.oid in (select oid from pol)) as used_by_policy,
       (d.src ~* '\m(insert\s+into|update\s+public|update\s+\w+\s+set|delete\s+from|perform\s)') as writes,
       (d.src ~* '(auth\.uid\(\)|staff_rank|has_role|is_staff_user|is_current_user_internal)') as checks_uid,
       (select string_agg(distinct m[1], ', ')
          from (select regexp_matches(d.src, '(?:from|join|into|update)\s+(?:public\.)?"?([a-z_]+)"?', 'gi') as m limit 6) x) as tables,
       length(d.src) as body_len
from defs d
order by used_by_policy desc, writes, d.proname;
