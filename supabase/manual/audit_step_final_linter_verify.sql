-- READ ONLY. Final check for the Supabase linter pass (parts EK - ET). Nothing is changed.
-- Run it and paste the result (CSV). Every row says what it checks, the value found, and the value expected.

select 'trigger functions callable by anon/authenticated' as check_name,
       count(*)::text as found, '0' as expected
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))

union all
select 'server-only functions callable by signed-in users',
       count(*)::text, '0'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and p.proname in ('billing_apply_event','billing_claim_refund','billing_fail_refund','billing_create_order','billing_my_provider_subscription',
                    'billing_set_cancel_flag','billing_expire_products','billing_expire_subscriptions','key_vault_setup','key_vault_try',
                    'list_user_storage_objects','_apply_gift','_gift_recipients','notify_due_announcements','claim_background_jobs',
                    'calculate_daily_engagement_score','verify_call_room_membership')

union all
select 'public functions without a fixed search_path (not extension-owned)',
       count(*)::text, '0'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

union all
select 'security definer functions still callable by anon',
       count(*)::text, 'about 25-40 (public-page functions + helpers of public tables)'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'EXECUTE')

union all
select 'tables in public where anon can still INSERT/UPDATE/DELETE',
       count(*)::text, '0'
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
  and (has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))

union all
select 'storage: broad public-read policies on the 7 public buckets',
       count(*)::text, '0'
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('Public view avatars','Public view company_assets','Anyone can view marketplace images','Public view portfolios',
                     'Public view post-media','Public view project-assets','Anyone can view vendor images')

union all
select 'dm_keys insert policy that allows anything',
       count(*)::text, '0'
from pg_policies
where schemaname = 'public' and tablename = 'dm_keys' and cmd = 'INSERT' and with_check = 'true'

union all
select 'announcements UPDATE policy with WITH CHECK true',
       count(*)::text, '0'
from pg_policies
where schemaname = 'public' and tablename = 'announcements' and cmd = 'UPDATE' and with_check = 'true'

union all
select 'room_categories read policy present',
       count(*)::text, '1'
from pg_policies
where schemaname = 'public' and tablename = 'room_categories' and cmd = 'SELECT';
