-- PART GD - staff security: two-step sign-in switch that needs a second super admin, hidden /setup-admin, forced password change. Safe to run more than once.
--
-- WHY
--   * Two-step sign-in (TOTP) for staff already exists in the app (part BU) but a single super admin could flip it, and flipping it
--     while someone had not enrolled would lock that person out. It ships OFF and stays off until everybody is enrolled.
--   * /setup-admin (the first-super-admin page) must not be reachable once a super admin exists.
--   * Newly created staff accounts (and accounts a super admin resets) must choose their own password before anything opens.
--
-- WHAT IT ADDS
--   setup_admin_available()                      true only while no super admin exists (any signed-in person may ask)
--   staff_mfa_enrollment()                       super admin only: who has set up two-step sign-in, plus the pending request if there is one
--   staff_request_mfa_requirement(reason)        super admin: ask to switch the requirement ON. Refused while any staff account is not enrolled.
--                                                It then waits in the approval queue for a DIFFERENT super admin (same queue as role changes).
--   staff_mfa_queue_execute()  (trigger)         when the second super admin approves, re-checks that everybody is still enrolled, then switches it on
--   staff_set_security_settings(...)             REPLACED: still sets the idle / session limits and can switch the requirement OFF at once,
--                                                but can no longer switch it ON (that only happens through the approval above)
--   staff_require_password_change(user, reason)  super admin: the person must choose a new password at next sign-in (cannot target self or a super admin)
--   clear_my_password_reset()                    the person calls this after they have set the new password
--
-- It does NOT enrol or change two-step sign-in for any account, and it does not change the flag: require_staff_mfa stays as it is (OFF by default).
--
-- RUN AFTER part_bu_admin_console_gaps.sql and part_bi_governance_actions.sql (it replaces staff_set_security_settings from part BU).
-- PREFLIGHT (read only):  select proname from pg_proc where proname in ('setup_admin_available','staff_mfa_enrollment');   -- 0 rows before
--                         select value from platform_settings where key = 'require_staff_mfa';                            -- empty or false
-- POST-CHECK  (read only): select public.setup_admin_available();    -- false once a super admin exists
--
-- BREAK-GLASS if the requirement is ever on and a person loses their authenticator (run in the SQL editor, as owner):
--   update public.platform_settings set value = 'false'::jsonb where key = 'require_staff_mfa';
--   (then remove their old factor in Authentication > Users so they can enrol a new one)

SET lock_timeout = '5s';

-- ── 1. /setup-admin: only while no super admin exists ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setup_admin_available()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role::text = 'super_admin');
$$;
REVOKE ALL ON FUNCTION public.setup_admin_available() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setup_admin_available() TO authenticated;

-- ── 2. who has set up two-step sign-in ──────────────────────────────────────────────────────────────
-- staff roles = moderator, admin, super_admin and finance (compared as text so this file also runs before the finance role exists)
CREATE OR REPLACE FUNCTION public._staff_mfa_missing()
RETURNS TABLE (user_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (ur.user_id) ur.user_id, ur.role::text
    FROM public.user_roles ur
   WHERE ur.role::text IN ('moderator', 'admin', 'super_admin', 'finance')
     AND NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = ur.user_id AND f.factor_type = 'totp' AND f.status = 'verified')
   ORDER BY ur.user_id;
$$;
REVOKE ALL ON FUNCTION public._staff_mfa_missing() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_mfa_enrollment()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_people jsonb;
  v_pending jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see this' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'role' DESC, x->>'name'), '[]'::jsonb) INTO v_people
    FROM (
      SELECT jsonb_build_object(
               'user_id', s.user_id,
               'name', COALESCE(p.full_name, p.username, 'Unknown'),
               'username', p.username,
               'email', u.email,
               'role', s.role,
               'enrolled', EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = s.user_id AND f.factor_type = 'totp' AND f.status = 'verified'),
               'enrolled_at', (SELECT min(f.created_at) FROM auth.mfa_factors f WHERE f.user_id = s.user_id AND f.factor_type = 'totp' AND f.status = 'verified')
             ) AS x
        FROM (SELECT DISTINCT ON (ur.user_id) ur.user_id, ur.role::text AS role
                FROM public.user_roles ur
               WHERE ur.role::text IN ('moderator', 'admin', 'super_admin', 'finance')
               ORDER BY ur.user_id) s
        LEFT JOIN public.profiles p ON p.id = s.user_id
        LEFT JOIN auth.users u ON u.id = s.user_id
    ) q;

  SELECT jsonb_build_object('id', q.id, 'requested_at', q.created_at, 'maker_id', q.maker_id,
                            'maker_name', COALESCE(p.full_name, p.username), 'mine', q.maker_id = auth.uid())
    INTO v_pending
    FROM public.gov_approval_queue q LEFT JOIN public.profiles p ON p.id = q.maker_id
   WHERE q.status = 'pending' AND q.action = 'staff.mfa_required'
   ORDER BY q.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'require_mfa', COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'require_staff_mfa'), false),
    'super_admins', (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.role::text = 'super_admin'),
    'total', jsonb_array_length(v_people),
    'missing', (SELECT count(*) FROM public._staff_mfa_missing()),
    'pending_request', v_pending,
    'people', v_people
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_mfa_enrollment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_mfa_enrollment() TO authenticated;

-- ── 3. switching the requirement ON needs a second super admin ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_request_mfa_requirement(p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing integer;
  v_names text;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can ask for this' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Please give a reason of at least 5 characters';
  END IF;
  IF COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'require_staff_mfa'), false) THEN
    RAISE EXCEPTION 'Two-step sign-in is already required';
  END IF;
  IF (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.role::text = 'super_admin') < 2 THEN
    RAISE EXCEPTION 'A second super admin is needed to approve this, and there is only one';
  END IF;

  SELECT count(*), string_agg(COALESCE(p.username, m.user_id::text), ', ') INTO v_missing, v_names
    FROM public._staff_mfa_missing() m LEFT JOIN public.profiles p ON p.id = m.user_id;
  IF v_missing > 0 THEN
    RAISE EXCEPTION '% staff account(s) have not set up two-step sign-in yet (%). They would be locked out. Ask them to set it up first.', v_missing, v_names;
  END IF;

  IF EXISTS (SELECT 1 FROM public.gov_approval_queue WHERE status = 'pending' AND action = 'staff.mfa_required') THEN
    RAISE EXCEPTION 'This is already waiting for a second super admin';
  END IF;

  INSERT INTO public.gov_approval_queue (maker_id, action, target_id, target_type, reason, payload, status)
  VALUES (auth.uid(), 'staff.mfa_required', 'require_staff_mfa', 'setting', left(btrim(p_reason), 500), '{}'::jsonb, 'pending');

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('staff.mfa_required_requested', auth.uid(), 'require_staff_mfa', 'setting', left(btrim(p_reason), 300), '{}'::jsonb);

  PERFORM public.notify_staff('Two-step sign-in waiting for approval', left(btrim(p_reason), 120), '/super-admin?tab=approvals', 3, auth.uid());
  RETURN jsonb_build_object('success', true, 'queued', true);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_request_mfa_requirement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_request_mfa_requirement(text) TO authenticated;

-- when the second super admin approves, the database switches it on (and checks again that nobody would be locked out)
CREATE OR REPLACE FUNCTION public.staff_mfa_queue_execute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing integer;
BEGIN
  IF NEW.action IS DISTINCT FROM 'staff.mfa_required' OR OLD.status IS DISTINCT FROM 'pending' OR NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NULL;
  END IF;
  IF NEW.checker_id IS NULL OR public.staff_rank(NEW.checker_id) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can approve this';
  END IF;
  IF NEW.checker_id IS NOT DISTINCT FROM NEW.maker_id THEN
    RAISE EXCEPTION 'A different super admin has to approve this';
  END IF;
  SELECT count(*) INTO v_missing FROM public._staff_mfa_missing();
  IF v_missing > 0 THEN
    RAISE EXCEPTION '% staff account(s) have not set up two-step sign-in yet, so it cannot be switched on', v_missing;
  END IF;

  INSERT INTO public.platform_settings (key, value) VALUES ('require_staff_mfa', 'true'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('staff.mfa_required_enabled', NEW.checker_id, 'require_staff_mfa', 'setting', COALESCE(NEW.reason, 'Two-step sign-in required for all staff'),
          jsonb_build_object('maker_id', NEW.maker_id, 'checker_id', NEW.checker_id, 'queue_id', NEW.id));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_mfa_queue_execute() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS staff_mfa_queue_execute ON public.gov_approval_queue;
CREATE TRIGGER staff_mfa_queue_execute
  AFTER UPDATE ON public.gov_approval_queue
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.action = 'staff.mfa_required')
  EXECUTE FUNCTION public.staff_mfa_queue_execute();

-- the old single-person switch can no longer turn the requirement ON (turning it OFF, and the two limits, still work at once)
CREATE OR REPLACE FUNCTION public.staff_set_security_settings(p_require_mfa boolean, p_idle_minutes integer, p_max_session_hours integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_was boolean;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change staff security settings';
  END IF;
  IF p_idle_minutes < 5 OR p_idle_minutes > 240 OR p_max_session_hours < 1 OR p_max_session_hours > 72 THEN
    RAISE EXCEPTION 'Idle time must be 5 to 240 minutes and the session limit 1 to 72 hours';
  END IF;

  v_was := COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'require_staff_mfa'), false);
  IF p_require_mfa AND NOT v_was THEN
    RAISE EXCEPTION 'Turning two-step sign-in on needs a second super admin to approve it. Use "Ask for approval".';
  END IF;

  v_before := public.staff_security_settings();

  INSERT INTO public.platform_settings (key, value) VALUES ('require_staff_mfa', to_jsonb(p_require_mfa))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.platform_settings (key, value) VALUES ('staff_idle_minutes', to_jsonb(p_idle_minutes))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.platform_settings (key, value) VALUES ('staff_max_session_hours', to_jsonb(p_max_session_hours))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('system.staff_security', auth.uid(), 'staff_security', 'settings', 'Staff security settings changed',
          jsonb_build_object('before', v_before, 'after', public.staff_security_settings()));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_security_settings(boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_security_settings(boolean, integer, integer) TO authenticated;

-- ── 4. forced password change ───────────────────────────────────────────────────────────────────────
-- profiles.force_password_reset is locked against direct edits (parts AG / CZ), so only these functions change it.
CREATE OR REPLACE FUNCTION public.staff_require_password_change(p_user uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can do this' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot do this to your own account';
  END IF;
  IF public.staff_rank(p_user) >= 3 THEN
    RAISE EXCEPTION 'You cannot do this to another super admin';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Please give a reason of at least 5 characters';
  END IF;

  UPDATE public.profiles SET force_password_reset = true WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'That account does not exist'; END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('staff.password_change_required', auth.uid(), p_user::text, 'user', left(btrim(p_reason), 300), '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_require_password_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_require_password_change(uuid, text) TO authenticated;

-- called by the app right after the person has set their new password
CREATE OR REPLACE FUNCTION public.clear_my_password_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles SET force_password_reset = false WHERE id = auth.uid() AND force_password_reset IS TRUE;
  IF FOUND THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES ('staff.password_changed', auth.uid(), auth.uid()::text, 'user', 'Chose a new password after a required change', '{}'::jsonb);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_my_password_reset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_my_password_reset() TO authenticated;

NOTIFY pgrst, 'reload schema';
