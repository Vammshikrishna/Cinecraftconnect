-- PART GB (exports): CSV-ready lists for the admin team, with a date filter, each one written to the audit log. Safe to run more than once.
--
-- WHAT IT ADDS (admins and super admins only, and only after two-step sign-in when that is switched on)
--   * staff_export_users_summary(from, to)       one row per person who joined in the range: handle, name, account type, verified, suspended,
--                                                 joined, last active, active strikes. NO email, phone, address or date of birth.
--   * staff_export_tickets(from, to)             one row per support ticket opened in the range: category, priority, status, owner, first reply,
--                                                 resolved, rating. NO message text.
--   * staff_export_verification_queue(from, to)  one row per verification request in the range: handle, type, status, reviewer, decision date,
--                                                 the reason given on a rejection. NO legal name, ID or document links.
-- Each call checks the dates (to is not before from, at most 366 days), returns at most 10 000 rows and writes one audit entry
-- (who, which export, the dates and how many rows). The app builds the CSV file in the browser from these rows.
-- The web app keeps working before this is applied: the Export buttons show a short note.
--
-- PREFLIGHT (read only):  select proname from pg_proc where proname like 'staff_export_%';   -- 0 rows before
-- POST-CHECK  (read only): sign in as an admin, open Admin > Audit Log > Exports, pick a range, press Export: a file downloads and
--   the audit log gets an "export_tickets" (or "export_users_summary", "export_verification_queue") line. A moderator is refused.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- one place for the checks every export shares
CREATE OR REPLACE FUNCTION public.staff_export_check(p_from date, p_to date)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'Choose a start and an end date';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'The end date is before the start date';
  END IF;
  IF p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Choose a range of one year or less';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_export_check(date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_export_audit(p_what text, p_from date, p_to date, p_rows integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' ELSE 'admin' END,
          'export_' || p_what, 'export', p_what,
          jsonb_build_object('from', p_from, 'to', p_to, 'rows', p_rows));
$$;
REVOKE ALL ON FUNCTION public.staff_export_audit(text, date, date, integer) FROM PUBLIC, anon, authenticated;

-- ── people ────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_export_users_summary(p_from date, p_to date)
RETURNS TABLE (username text, full_name text, account_type text, is_verified boolean, is_suspended boolean, joined_at timestamptz, last_active_at timestamptz, active_strikes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM public.staff_export_check(p_from, p_to);
  RETURN QUERY
  SELECT p.username, p.full_name, p.account_type, COALESCE(p.is_verified, false), COALESCE(p.is_banned, false),
         u.created_at, u.last_sign_in_at,
         COALESCE((SELECT count(*) FROM public.user_strikes k WHERE k.user_id = p.id AND k.revoked_at IS NULL AND k.expires_at > now()), 0)::integer
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
   WHERE u.created_at >= p_from::timestamptz AND u.created_at < (p_to + 1)::timestamptz
   ORDER BY u.created_at
   LIMIT 10000;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.staff_export_audit('users_summary', p_from, p_to, v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_export_users_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_export_users_summary(date, date) TO authenticated;

-- ── support tickets ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_export_tickets(p_from date, p_to date)
RETURNS TABLE (ticket text, created_at timestamptz, requester text, category text, priority text, status text, owner text, first_reply_at timestamptz, first_reply_minutes integer, resolved_at timestamptz, rating smallint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM public.staff_export_check(p_from, p_to);
  RETURN QUERY
  SELECT left(t.id::text, 8), t.created_at, rq.username, t.category, t.priority, t.status, ow.username,
         t.first_response_at,
         CASE WHEN t.first_response_at IS NULL THEN NULL ELSE GREATEST(0, round(extract(epoch FROM (t.first_response_at - t.created_at)) / 60))::integer END,
         t.resolved_at, t.csat_rating
    FROM public.support_tickets t
    LEFT JOIN public.profiles rq ON rq.id = t.user_id
    LEFT JOIN public.profiles ow ON ow.id = t.assigned_to
   WHERE t.created_at >= p_from::timestamptz AND t.created_at < (p_to + 1)::timestamptz
   ORDER BY t.created_at
   LIMIT 10000;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.staff_export_audit('tickets', p_from, p_to, v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_export_tickets(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_export_tickets(date, date) TO authenticated;

-- ── verification queue ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_export_verification_queue(p_from date, p_to date)
RETURNS TABLE (request text, created_at timestamptz, username text, request_type text, status text, reviewed_by text, reviewed_at timestamptz, rejection_reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM public.staff_export_check(p_from, p_to);
  RETURN QUERY
  SELECT left(v.id::text, 8), v.created_at, p.username, v.request_type, v.status, rv.username, v.reviewed_at, v.rejection_reason
    FROM public.verification_requests v
    LEFT JOIN public.profiles p ON p.id = v.user_id
    LEFT JOIN public.profiles rv ON rv.id = v.reviewed_by
   WHERE v.created_at >= p_from::timestamptz AND v.created_at < (p_to + 1)::timestamptz
   ORDER BY v.created_at
   LIMIT 10000;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.staff_export_audit('verification_queue', p_from, p_to, v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_export_verification_queue(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_export_verification_queue(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
