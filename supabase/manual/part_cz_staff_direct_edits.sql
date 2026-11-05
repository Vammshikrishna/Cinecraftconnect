-- PART CZ - staff and moderator direct-edit holes (audit step 12). Based on the live state read in audit_step12_preflight.sql.
-- Run in the SQL editor. If a staff screen starts failing with "permission denied for table ...", tell me which one:
-- every staff action in the app goes through a database function (they all run with the owner's rights), so none should.
--
-- What was open (live):
--   * content_reports / flagged_messages: any moderator could UPDATE rows directly (close child-safety cases, move a case
--     out of "pending" so the overdue alert stops), skipping the rules inside the staff functions.
--   * profiles: the trigger that protects ban / shadowban / verified / sessions / trust fields let ANY staff member
--     (a moderator editing even their own row) through, and "Admins can manage all profiles" let an admin edit or DELETE
--     any profile row directly.
--   * space_access_requests / platform_settings: signed-in clients held write privileges (blocked only by the lack of a
--     policy), and the privileges TRUNCATE / TRIGGER / REFERENCES were open on all of these tables.
--   * emergency access (request_space_access) and switching staff two-step sign-in off (staff_set_security_settings)
--     never checked that the staff session had passed the two-step check.
-- (Direct writes to space_access_grants were already closed live: no INSERT/UPDATE privilege.)

-- 1. content_reports / flagged_messages: no direct edits; people may still file reports; staff use the functions.
REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.content_reports FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.flagged_messages FROM anon, authenticated;
REVOKE INSERT ON public.content_reports FROM anon;
REVOKE INSERT ON public.flagged_messages FROM anon;
DROP POLICY IF EXISTS "Moderators can update reports" ON public.content_reports;
DROP POLICY IF EXISTS "Staff can update flags" ON public.flagged_messages;

-- 2. space_access_requests / space_access_grants / platform_settings: only the functions write these.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.space_access_requests FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.space_access_grants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.platform_settings FROM anon, authenticated;
REVOKE SELECT, DELETE ON public.space_access_grants FROM anon;
DROP POLICY IF EXISTS "Staff can create space access requests" ON public.space_access_requests;
DROP POLICY IF EXISTS "Staff can update space access requests" ON public.space_access_requests;
-- (staff may still delete their OWN grant, see the policy "Staff can delete their own space access grants")

-- 3. profiles: a direct edit never changes the protected fields, whoever you are. Only database functions can.
--    The trigger function is now SECURITY INVOKER, so "who is running" is visible: a direct request from the app runs as
--    the role "authenticated"; a staff function runs as its owner.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- No end-user JWT (service_role key, background jobs, auth triggers, migrations): allow.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Trusted database code (a staff function or trigger running with its owner's rights) may change the fields.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified          := false;
    NEW.is_banned            := false;
    NEW.is_internal          := false;
    NEW.is_official_team     := false;
    NEW.trust_score          := 100;
    NEW.restriction_flags    := '{}'::text[];
    NEW.shadow_banned_at     := NULL;
    NEW.is_shadowbanned      := false;
    NEW.force_password_reset := false;
    NEW.sessions_revoked_at  := NULL;
    NEW.last_muted_at        := NULL;
    NEW.mute_expires_at      := NULL;
    RETURN NEW;
  END IF;

  NEW.is_verified          := OLD.is_verified;
  NEW.is_banned            := OLD.is_banned;
  NEW.is_internal          := OLD.is_internal;
  NEW.is_official_team     := OLD.is_official_team;
  NEW.trust_score          := OLD.trust_score;
  NEW.restriction_flags    := OLD.restriction_flags;
  NEW.shadow_banned_at     := OLD.shadow_banned_at;
  NEW.is_shadowbanned      := OLD.is_shadowbanned;
  NEW.force_password_reset := OLD.force_password_reset;
  NEW.sessions_revoked_at  := OLD.sessions_revoked_at;
  NEW.last_muted_at        := OLD.last_muted_at;
  NEW.mute_expires_at      := OLD.mute_expires_at;
  RETURN NEW;
END;
$function$;

-- Admins no longer edit or delete any profile row directly (they use the governance functions).
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 4. Two-step sign-in must hold on the emergency path and on switching the setting off.
CREATE OR REPLACE FUNCTION public.request_space_access(p_target_type text, p_target_id text, p_reason_category text, p_reason_details text, p_emergency boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request_id uuid;
  v_role public.app_role;
  v_expires timestamp with time zone;
BEGIN
  -- Check requester role
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'user'::public.app_role THEN
    RAISE EXCEPTION 'Only staff members can request space access.';
  END IF;

  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;

  -- Enforce scope boundaries
  IF v_role = 'moderator'::public.app_role AND p_target_type != 'room' THEN
    RAISE EXCEPTION 'Moderators can only request access to Discussion Rooms.';
  END IF;
  IF v_role = 'admin'::public.app_role AND p_target_type = 'dm' THEN
    RAISE EXCEPTION 'Admins cannot request access to Direct Messages.';
  END IF;

  v_expires := now() + interval '2 hours';

  IF p_emergency THEN
    IF v_role NOT IN ('admin'::public.app_role, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only Admins and Super Admins can use Emergency Override.';
    END IF;

    INSERT INTO public.space_access_requests (
      requester_id, approver_id, target_type, target_id,
      reason_category, reason_details, status, emergency_override, expires_at
    ) VALUES (
      auth.uid(), auth.uid(), p_target_type, p_target_id,
      p_reason_category, p_reason_details, 'approved', true, v_expires
    ) RETURNING id INTO v_request_id;

    INSERT INTO public.space_access_grants (
      request_id, user_id, target_type, target_id, expires_at
    ) VALUES (
      v_request_id, auth.uid(), p_target_type, p_target_id, v_expires
    );

    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'chat.emergency_access', auth.uid(), p_target_id, p_target_type,
      'EMERGENCY OVERRIDE: ' || p_reason_details,
      jsonb_build_object('reason_category', p_reason_category, 'request_id', v_request_id)
    );

  ELSE
    INSERT INTO public.space_access_requests (
      requester_id, target_type, target_id,
      reason_category, reason_details, status, emergency_override, expires_at
    ) VALUES (
      auth.uid(), p_target_type, p_target_id,
      p_reason_category, p_reason_details, 'pending', false, v_expires
    ) RETURNING id INTO v_request_id;

    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'chat.request_access', auth.uid(), p_target_id, p_target_type,
      'Requested access: ' || p_reason_details,
      jsonb_build_object('reason_category', p_reason_category, 'request_id', v_request_id)
    );
  END IF;

  RETURN v_request_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.request_space_access(text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_space_access(text, text, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_set_security_settings(p_require_mfa boolean, p_idle_minutes integer, p_max_session_hours integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_before jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change staff security settings';
  END IF;
  -- when two-step sign-in is currently required, turning it off (or changing anything) needs a two-step session
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501';
  END IF;
  IF p_idle_minutes < 5 OR p_idle_minutes > 240 OR p_max_session_hours < 1 OR p_max_session_hours > 72 THEN
    RAISE EXCEPTION 'Idle time must be 5 to 240 minutes and the session limit 1 to 72 hours';
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
$function$;

-- Rollback (only if a staff screen breaks and cannot wait):
--   GRANT UPDATE ON public.content_reports, public.flagged_messages TO authenticated;
--   (the dropped policies "Moderators can update reports" / "Staff can update flags" would also need re-creating)
