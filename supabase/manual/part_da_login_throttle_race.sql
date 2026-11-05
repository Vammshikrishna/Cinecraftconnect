-- PART DA - sign-in throttle race fix (audit step 13, finding 55). Run after part_bn. Safe to run more than once.
-- The hook counted recent failures and inserted the new failure in two separate steps, so many guesses sent at the same
-- moment could all see "fewer than 5" and all go through. The hook now takes a per-account lock first, so attempts for one
-- account are checked one at a time.
--
-- Finding 56 (anyone can lock an account for 15 minutes with 5 wrong passwords) is a trade-off, not a bug: a lock that
-- lets the right password through would not slow down guessing at all. It stays as is: the lock never extends itself
-- (attempts during a lock do not add failures), so it ends 15 minutes after the first of the 5 failures.

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
  -- one attempt per account at a time: parallel guesses can no longer all read "4 failures so far"
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

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

grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt(jsonb) from authenticated, anon, public;
