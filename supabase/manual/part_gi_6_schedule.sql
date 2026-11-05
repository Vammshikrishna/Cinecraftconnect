-- PART GI-6 - schedule the staff digest emails and the Staff Watch check. Safe to run more than once.
--
-- NEEDS FIRST (the file skips what is missing and tells you with a NOTICE, it never fails):
--   1. Extensions pg_cron and pg_net switched on (Dashboard > Database > Extensions).
--   2. Parts GI-1 and GI-5 applied.
--   3. The edge function deployed:   supabase functions deploy staff-digest
--   4. Function secrets:             supabase secrets set STAFF_DIGEST_SECRET=<long random text> RESEND_API_KEY=<key> DIGEST_FROM="CineCraft <digest@yourdomain>"
--   5. The SAME random text stored for the database (replace the placeholder, run ONCE in the SQL editor, do not paste it into any file):
--        insert into public.app_settings (key, value) values ('staff_digest_secret', '<the same long random text>')
--        on conflict (key) do update set value = excluded.value;
--      app_settings must also already hold 'supabase_url' and 'supabase_anon_key' (the push notifications already use them).
--
-- WHAT IT SCHEDULES (times are UTC):
--   staff-digest-daily   : every day 02:30 UTC (08:00 India) -> staff who chose "daily"
--   staff-digest-weekly  : Mondays 02:30 UTC                 -> staff who chose "weekly"
--   staff-behaviour-scan : every hour at :40 (already scheduled by part CD; re-stated here so one file shows the whole timetable)
-- To stop: select cron.unschedule(jobid) from cron.job where jobname like 'staff-digest-%';
--
-- PREFLIGHT (read only): select jobname, schedule from cron.job where jobname like 'staff-%';
-- POST-CHECK  (read only): the same query shows the three jobs; Super admin > Digests shows "Scheduled".

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.run_staff_digest(p_frequency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_url text; v_key text; v_secret text;
BEGIN
  IF p_frequency NOT IN ('daily', 'weekly') THEN RAISE EXCEPTION 'Unknown frequency'; END IF;
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public.app_settings WHERE key = 'supabase_anon_key';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'staff_digest_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_key, '') = '' OR coalesce(v_secret, '') = '' THEN
    RAISE NOTICE 'Digest not sent: supabase_url, supabase_anon_key or staff_digest_secret is missing in app_settings.';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url || '/functions/v1/staff-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key, 'x-digest-secret', v_secret),
    body := jsonb_build_object('frequency', p_frequency));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Digest call failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.run_staff_digest(text) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not enabled: nothing scheduled. Enable it, then run this file again.';
    RETURN;
  END IF;
  BEGIN
    PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname IN ('staff-digest-daily', 'staff-digest-weekly', 'staff-behaviour-scan');
    PERFORM cron.schedule('staff-behaviour-scan', '40 * * * *', $cron$SELECT public.scan_staff_behaviour('schedule');$cron$);
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      PERFORM cron.schedule('staff-digest-daily',  '30 2 * * *', $cron$SELECT public.run_staff_digest('daily');$cron$);
      PERFORM cron.schedule('staff-digest-weekly', '30 2 * * 1', $cron$SELECT public.run_staff_digest('weekly');$cron$);
    ELSE
      RAISE NOTICE 'pg_net is not enabled: the Staff Watch check is scheduled, the digests are not. Enable pg_net and run this file again.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule (%).', SQLERRM;
  END;
END $$;
