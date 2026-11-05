-- PART GI-7: fix the Digests list for super admins (run after part GI-5; safe to run again).
-- WHY: staff_digest_recipients() read cron.job directly. Where pg_cron is not installed the whole function failed to plan, the catch-all handler
--      swallowed it and the list was always empty ("Nobody has opted in yet") even when staff had opted in. The same handler also hid the
--      "Only super admins" refusal. Now the cron check is dynamic and isolated, and the refusal is raised for real.
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'staff_digest_recipients';
-- POST-CHECK  (read only): a super admin opens Digests and sees opted-in staff; a non-super-admin gets "Only super admins can see this".
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.staff_digest_recipients()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_sched boolean := false; v_list jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can see this' USING ERRCODE = '42501'; END IF;
  BEGIN
    EXECUTE $q$ SELECT EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname LIKE 'staff-digest-%') $q$ INTO v_sched;
  EXCEPTION WHEN OTHERS THEN v_sched := false;
  END;
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'name', COALESCE(p.full_name, p.username, 'Staff member'),
                      'rank', public.staff_rank(d.user_id), 'frequency', d.frequency, 'last_sent_at', d.last_sent_at) ORDER BY d.frequency, COALESCE(p.full_name, p.username)), '[]'::jsonb)
      INTO v_list FROM public.staff_digest_prefs d LEFT JOIN public.profiles p ON p.id = d.user_id WHERE d.frequency <> 'off';
  EXCEPTION WHEN undefined_table THEN v_list := '[]'::jsonb;
  END;
  RETURN jsonb_build_object('scheduled', COALESCE(v_sched, false), 'recipients', v_list);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_digest_recipients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_digest_recipients() TO authenticated;
