-- PART DH - tell the account owner (and staff) when someone is guessing a password, WITHOUT any email service
-- (audit step 13, finding 56). Run after part DA. Safe to run more than once. (The file name is kept from the first, email-based
-- version; this version needs no email provider and no Edge Function.)
--
-- What it does, all inside the database:
--   * Normal accounts: unchanged lock (5 wrong passwords = 15 minutes), but the moment it starts the owner gets a notification
--     in the app and as a push to every device where they are signed in: "Sign-in was paused: someone entered the wrong
--     password 5 times. If it was not you, change your password in Settings > Security."
--   * Staff accounts: a staff member can no longer be locked out with 5 guesses. They get the warning at 5 wrong passwords
--     (together with other senior staff, who see "possible password guessing on <staff member>") and the lock starts at 10.
--     (Staff can also turn on two-step sign-in, which makes guessing the password alone worthless.)
-- Why not "unlock with a link": that needs an email service. The lock is only 15 minutes and the owner is now told about it.

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
  v_is_staff boolean := false;
  max_failures int := 5;
  warn_at constant int := 5;
  window_len constant interval := interval '15 minutes';
  v_new int;
begin
  -- one attempt per account at a time: parallel guesses can no longer all read "4 failures so far"
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  begin
    v_is_staff := coalesce(public.staff_rank(uid), 0) >= 1;
  exception when others then
    v_is_staff := false;
  end;
  if v_is_staff then max_failures := 10; end if;

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
  v_new := recent_failures + 1;

  -- tell people (never lets an error here affect the sign-in)
  begin
    if v_new = warn_at or v_new = max_failures then
      if v_new = max_failures then
        insert into public.notifications (user_id, title, message, type, priority, action_url)
        values (uid, 'Sign-in was paused',
                'Someone entered the wrong password ' || v_new || ' times, so sign-in is paused for 15 minutes. If it was not you, change your password in Settings > Security.',
                'security_alert', 'high', '/settings');
      elsif v_is_staff then
        insert into public.notifications (user_id, title, message, type, priority, action_url)
        values (uid, 'Wrong password entered 5 times',
                'Someone entered the wrong password 5 times for your account. If it was not you, change your password in Settings > Security.',
                'security_alert', 'high', '/settings');
      end if;
      if v_is_staff then
        perform public.notify_staff('Possible password guessing on a staff account',
                                    'A staff account had ' || v_new || ' wrong passwords in 15 minutes.',
                                    '/admin', 2, uid);
      end if;
    end if;
  exception when others then
    null;
  end;

  -- housekeeping: drop anything older than a day
  delete from public.auth_login_attempts where created_at < now() - interval '1 day';

  return jsonb_build_object('decision', 'continue');
end;
$$;

grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_password_verification_attempt(jsonb) from authenticated, anon, public;
