-- Part BN: sign-in rate limit on the server.
-- The sign-in page already stops after 3 wrong passwords, but that lives in the browser and can be bypassed by
-- calling the API directly. This puts the same protection in the database through Supabase's
-- "Password verification attempt" auth hook.
--
-- After running this file, switch the hook on (the SQL alone does nothing):
--   Dashboard -> Authentication -> Hooks -> Password verification attempt
--   -> choose "Postgres function" -> public.hook_password_verification_attempt -> Save
--
-- Rule: after 5 wrong passwords for one account within 15 minutes, further attempts are refused until the
-- oldest failure is 15 minutes old. A correct password clears the count.

create table if not exists public.auth_login_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_attempts_user_time_idx
  on public.auth_login_attempts (user_id, created_at desc);

-- nobody reads this from the apps; only the auth hook (security definer) touches it
alter table public.auth_login_attempts enable row level security;
revoke all on public.auth_login_attempts from anon, authenticated, public;

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (event->>'user_id')::uuid;
  ok boolean := coalesce((event->>'valid')::boolean, false);
  recent_failures int;
  max_failures constant int := 5;
  window_len constant interval := interval '15 minutes';
begin
  select count(*) into recent_failures
  from public.auth_login_attempts
  where user_id = uid and succeeded = false and created_at > now() - window_len;

  -- already locked: refuse, even if this password happens to be right, and do not extend the lock
  if recent_failures >= max_failures then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Too many failed sign-in attempts. Try again in 15 minutes.'
    );
  end if;

  if ok then
    delete from public.auth_login_attempts where user_id = uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  insert into public.auth_login_attempts (user_id, succeeded) values (uid, false);

  -- housekeeping: drop anything older than a day
  delete from public.auth_login_attempts where created_at < now() - interval '1 day';

  return jsonb_build_object('decision', 'continue');
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant all on public.auth_login_attempts to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt(jsonb) from authenticated, anon, public;

-- the hook runs as supabase_auth_admin, which needs a policy while row level security is on
drop policy if exists "auth admin manages attempts" on public.auth_login_attempts;
create policy "auth admin manages attempts" on public.auth_login_attempts
  as permissive for all to supabase_auth_admin using (true) with check (true);
