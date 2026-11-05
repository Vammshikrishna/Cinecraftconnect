-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bu: closes the gaps found in the admin console
--
--   1. Audited-access requests can finally be approved or rejected from a screen. The approvers are told when a
--      request is waiting, the requester is told the outcome, and an approval gives a fresh 2 hours from the
--      moment it is approved (it used to run from the moment of the request, so a late approval could arrive already
--      expired).
--   2. Legal requests desk            (super admin)   list, log, update, with an audit line for every change
--   3. Risk and linked accounts       (admin)         risk profiles, accounts that share a device or address, fraud networks
--   4. Platform rules editor          (super admin)   change a rule's value with the old value kept in the audit ledger
--   5. Staff security                 two-step sign-in setting for staff, idle and maximum session length, and a
--                                     periodic review of who holds which staff role
--
-- Everything is a function that checks the staff rank itself, so it does not depend on which table policies
-- your database currently has. Run after part_bp, bq and bt. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── staff security settings (used by several functions below) ───────────────────────────────────
-- Stored in platform_settings: require_staff_mfa (true/false), staff_idle_minutes, staff_max_session_hours.
-- Two-step sign-in is OFF until a super admin switches it on, so nobody is locked out before they have enrolled.
CREATE OR REPLACE FUNCTION public.staff_mfa_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'require_staff_mfa'), false)
         OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
REVOKE ALL ON FUNCTION public.staff_mfa_ok() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_mfa_ok() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_security_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  RETURN jsonb_build_object(
    'require_mfa', COALESCE((SELECT s.value = 'true'::jsonb FROM public.platform_settings s WHERE s.key = 'require_staff_mfa'), false),
    'idle_minutes', COALESCE((SELECT (s.value #>> '{}')::int FROM public.platform_settings s WHERE s.key = 'staff_idle_minutes'), 30),
    'max_session_hours', COALESCE((SELECT (s.value #>> '{}')::int FROM public.platform_settings s WHERE s.key = 'staff_max_session_hours'), 12)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_security_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_security_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_security_settings(p_require_mfa boolean, p_idle_minutes integer, p_max_session_hours integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change staff security settings';
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
$$;
REVOKE ALL ON FUNCTION public.staff_set_security_settings(boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_security_settings(boolean, integer, integer) TO authenticated;


-- ── 1. audited-access requests: queue, approve, reject, notify ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_list_access_requests(p_status text DEFAULT 'pending')
RETURNS TABLE (
  id uuid, requester_id uuid, requester_name text, requester_rank integer,
  target_type text, target_id text, target_title text,
  reason_category text, reason_details text, status text, emergency_override boolean,
  created_at timestamptz, expires_at timestamptz, approver_name text, can_approve boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see access requests';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;

  RETURN QUERY
  SELECT r.id, r.requester_id,
         COALESCE(rp.full_name, rp.username, 'Staff member'),
         public.staff_rank(r.requester_id),
         r.target_type, r.target_id,
         CASE r.target_type
           WHEN 'room' THEN (SELECT dr.title FROM public.discussion_rooms dr WHERE dr.id::text = r.target_id)
           WHEN 'project_space' THEN (SELECT COALESCE(pj.title, 'Project space')
                                        FROM public.project_spaces ps
                                        LEFT JOIN public.projects pj ON pj.id = ps.project_id
                                       WHERE ps.id::text = r.target_id)
           ELSE 'Direct message'
         END,
         r.reason_category, r.reason_details, r.status, r.emergency_override,
         r.created_at, r.expires_at,
         COALESCE(ap.full_name, ap.username),
         (r.status = 'pending' AND r.expires_at > now() AND r.requester_id <> auth.uid()
          AND (public.staff_rank(r.requester_id) < 3 OR public.staff_rank(auth.uid()) = 3))
  FROM public.space_access_requests r
  LEFT JOIN public.profiles rp ON rp.id = r.requester_id
  LEFT JOIN public.profiles ap ON ap.id = r.approver_id
  WHERE p_status = 'all' OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_access_requests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_access_requests(text) TO authenticated;

-- where the requester lands once approved
CREATE OR REPLACE FUNCTION public.access_target_url(p_target_type text, p_target_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_target_type
    WHEN 'room' THEN '/discussion-rooms/' || p_target_id
    WHEN 'project_space' THEN COALESCE((SELECT '/projects/' || ps.project_id::text || '/space' FROM public.project_spaces ps WHERE ps.id::text = p_target_id), '/projects')
    ELSE '/admin'
  END;
$$;

-- approve: same rules as before (nobody approves their own request, ranks are respected), plus the checks and
-- notices described at the top of this file
CREATE OR REPLACE FUNCTION public.approve_space_access(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_approver_rank integer := public.staff_rank(auth.uid());
  v_requester_rank integer;
  v_expires timestamptz := now() + interval '2 hours';
BEGIN
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;

  SELECT * INTO v_request FROM public.space_access_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is already processed.';
  END IF;
  IF v_request.expires_at <= now() THEN
    UPDATE public.space_access_requests SET status = 'expired' WHERE id = p_request_id;
    RAISE EXCEPTION 'This request has expired. Ask for a new one.';
  END IF;
  IF v_request.requester_id = auth.uid() THEN
    RAISE EXCEPTION 'Dual-Control Violation: Requester cannot approve their own request.';
  END IF;

  v_requester_rank := public.staff_rank(v_request.requester_id);
  IF v_approver_rank < 2 THEN
    RAISE EXCEPTION 'Only Admins and Super Admins can approve access requests.';
  END IF;
  IF v_requester_rank >= 3 AND v_approver_rank < 3 THEN
    RAISE EXCEPTION 'Only another Super Admin can approve Super Admin requests.';
  END IF;

  UPDATE public.space_access_requests
     SET status = 'approved', approver_id = auth.uid(), expires_at = v_expires
   WHERE id = p_request_id;

  INSERT INTO public.space_access_grants (request_id, user_id, target_type, target_id, expires_at)
  VALUES (p_request_id, v_request.requester_id, v_request.target_type, v_request.target_id, v_expires);

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('chat.approve_access', auth.uid(), v_request.target_id, v_request.target_type,
          'Approved access request for user: ' || v_request.requester_id::text,
          jsonb_build_object('request_id', p_request_id, 'reason_details', v_request.reason_details, 'expires_at', v_expires));

  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  VALUES (v_request.requester_id, 'Audited access approved',
          'You can open the space now. Access is read only and lasts 2 hours.', 'access_approved', 'high',
          public.access_target_url(v_request.target_type, v_request.target_id));
END;
$$;
REVOKE ALL ON FUNCTION public.approve_space_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_space_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_space_access(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_approver_rank integer := public.staff_rank(auth.uid());
BEGIN
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF v_approver_rank < 2 THEN
    RAISE EXCEPTION 'Only Admins and Super Admins can reject access requests.';
  END IF;

  SELECT * INTO v_request FROM public.space_access_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is already processed.';
  END IF;
  IF v_request.requester_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot reject your own request. Withdraw it by ending access instead.';
  END IF;
  IF public.staff_rank(v_request.requester_id) >= 3 AND v_approver_rank < 3 THEN
    RAISE EXCEPTION 'Only another Super Admin can decide Super Admin requests.';
  END IF;

  UPDATE public.space_access_requests SET status = 'rejected', approver_id = auth.uid() WHERE id = p_request_id;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('chat.reject_access', auth.uid(), v_request.target_id, v_request.target_type,
          'Rejected access request for user: ' || v_request.requester_id::text,
          jsonb_build_object('request_id', p_request_id, 'note', p_note));

  INSERT INTO public.notifications (user_id, title, message, type, priority, action_url)
  VALUES (v_request.requester_id, 'Audited access not approved',
          COALESCE(NULLIF(left(p_note, 200), ''), 'Your request was not approved.'), 'access_rejected', 'high', '/admin');
END;
$$;
REVOKE ALL ON FUNCTION public.reject_space_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_space_access(uuid, text) TO authenticated;

-- the approvers are told when a request is waiting (a super admin's request goes to the other super admins)
CREATE OR REPLACE FUNCTION public.alert_staff_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.notify_staff(
      'Audited access requested',
      left(NEW.reason_details, 140),
      '/admin?tab=access',
      CASE WHEN public.staff_rank(NEW.requester_id) >= 3 THEN 3 ELSE 2 END,
      NEW.requester_id
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS alert_staff_access_request ON public.space_access_requests;
CREATE TRIGGER alert_staff_access_request
AFTER INSERT ON public.space_access_requests
FOR EACH ROW EXECUTE FUNCTION public.alert_staff_access_request();


-- ── 2. legal requests desk (super admin) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_list_legal_requests(p_status text DEFAULT 'all')
RETURNS TABLE (
  id uuid, request_id text, requester_name text, requester_entity text, request_type text,
  target_user_id uuid, target_user_name text, target_content_id text, status text, evidence_url text,
  internal_notes text, deadline_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see legal requests';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT l.id, l.request_id, l.requester_name, l.requester_entity, l.request_type,
         l.target_user_id, COALESCE(tp.full_name, tp.username), l.target_content_id, l.status, l.evidence_url,
         l.internal_notes, l.deadline_at, l.created_at
  FROM public.legal_requests l
  LEFT JOIN public.profiles tp ON tp.id = l.target_user_id
  WHERE p_status = 'all' OR l.status = p_status
  ORDER BY (l.status IN ('pending', 'under_review')) DESC, l.deadline_at NULLS LAST, l.created_at DESC
  LIMIT 300;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_legal_requests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_legal_requests(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_log_legal_request(
  p_requester_name text, p_requester_entity text, p_request_type text,
  p_target_user uuid DEFAULT NULL, p_target_content text DEFAULT NULL,
  p_deadline timestamptz DEFAULT NULL, p_evidence_url text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ref text;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can log legal requests';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_requester_name), '') = '' OR COALESCE(trim(p_requester_entity), '') = '' OR COALESCE(trim(p_request_type), '') = '' THEN
    RAISE EXCEPTION 'Requester, organisation and type are required';
  END IF;

  v_ref := 'LR-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
  INSERT INTO public.legal_requests (request_id, requester_name, requester_entity, request_type, target_user_id,
                                     target_content_id, deadline_at, evidence_url, internal_notes)
  VALUES (v_ref, trim(p_requester_name), trim(p_requester_entity), trim(p_request_type), p_target_user,
          NULLIF(trim(COALESCE(p_target_content, '')), ''), p_deadline, NULLIF(trim(COALESCE(p_evidence_url, '')), ''), p_notes)
  RETURNING id INTO v_id;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('legal.logged', auth.uid(), v_id::text, 'legal_request', 'Legal request logged: ' || v_ref,
          jsonb_build_object('type', p_request_type, 'entity', p_requester_entity));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_log_legal_request(text, text, text, uuid, text, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_log_legal_request(text, text, text, uuid, text, timestamptz, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_update_legal_request(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before text;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can update legal requests';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF p_status NOT IN ('pending', 'under_review', 'fulfilled', 'rejected', 'legal_hold') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;

  SELECT status INTO v_before FROM public.legal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  UPDATE public.legal_requests
     SET status = p_status,
         internal_notes = CASE WHEN COALESCE(trim(p_note), '') = '' THEN internal_notes
                               ELSE COALESCE(internal_notes || E'\n', '') || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' ' || trim(p_note) END
   WHERE id = p_id;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('legal.updated', auth.uid(), p_id::text, 'legal_request', COALESCE(left(p_note, 200), 'Status changed'),
          jsonb_build_object('before', v_before, 'after', p_status));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_update_legal_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_legal_request(uuid, text, text) TO authenticated;


-- ── 3. risk profiles, linked accounts, fraud networks (admin) ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_risk_devices ON public.user_risk_profiles USING gin (device_hashes);
CREATE INDEX IF NOT EXISTS idx_risk_ips ON public.user_risk_profiles USING gin (known_ips);

CREATE OR REPLACE FUNCTION public.staff_list_risk_profiles(p_min_score integer DEFAULT 0)
RETURNS TABLE (
  user_id uuid, full_name text, username text, ip_risk_score integer, is_vpn_detected boolean, is_proxy_detected boolean,
  device_count integer, ip_count integer, linked_accounts integer, is_banned boolean, last_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see risk profiles';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT me.user_id, p.full_name, p.username, COALESCE(me.ip_risk_score, 0),
         COALESCE(me.is_vpn_detected, false), COALESCE(me.is_proxy_detected, false),
         COALESCE(cardinality(me.device_hashes), 0), COALESCE(cardinality(me.known_ips), 0),
         (SELECT count(*)::int FROM public.user_risk_profiles o
           WHERE o.user_id <> me.user_id AND (o.device_hashes && me.device_hashes OR o.known_ips && me.known_ips)),
         EXISTS (SELECT 1 FROM public.user_bans b WHERE b.user_id = me.user_id AND b.is_active),
         me.last_updated_at
  FROM public.user_risk_profiles me
  LEFT JOIN public.profiles p ON p.id = me.user_id
  WHERE COALESCE(me.ip_risk_score, 0) >= p_min_score
  ORDER BY COALESCE(me.ip_risk_score, 0) DESC, me.last_updated_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_risk_profiles(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_risk_profiles(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_linked_accounts(p_user uuid)
RETURNS TABLE (user_id uuid, full_name text, username text, shared_devices integer, shared_ips integer, is_banned boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see linked accounts';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT o.user_id, p.full_name, p.username,
         (SELECT count(*)::int FROM unnest(o.device_hashes) d WHERE d = ANY (me.device_hashes)),
         (SELECT count(*)::int FROM unnest(o.known_ips) i WHERE i = ANY (me.known_ips)),
         EXISTS (SELECT 1 FROM public.user_bans b WHERE b.user_id = o.user_id AND b.is_active)
  FROM public.user_risk_profiles me
  JOIN public.user_risk_profiles o ON o.user_id <> me.user_id AND (o.device_hashes && me.device_hashes OR o.known_ips && me.known_ips)
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE me.user_id = p_user
  ORDER BY 4 DESC, 5 DESC
  LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_linked_accounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_linked_accounts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_fraud_networks()
RETURNS TABLE (id uuid, name text, description text, risk_level text, associated_user_ids uuid[], associated_ips text[], updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can see fraud networks';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT f.id, f.name, f.description, f.risk_level, COALESCE(f.associated_user_ids, '{}'), COALESCE(f.associated_ips, '{}'),
         COALESCE(f.updated_at, f.created_at)
  FROM public.fraud_networks f
  ORDER BY CASE f.risk_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, f.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_fraud_networks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_fraud_networks() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_save_fraud_network(
  p_id uuid, p_name text, p_description text, p_risk_level text, p_users uuid[], p_ips text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can change fraud networks';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'A name is required';
  END IF;
  IF p_risk_level NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Unknown risk level';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.fraud_networks (name, description, risk_level, associated_user_ids, associated_ips)
    VALUES (trim(p_name), p_description, p_risk_level, COALESCE(p_users, '{}'), COALESCE(p_ips, '{}'))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.fraud_networks
       SET name = trim(p_name), description = p_description, risk_level = p_risk_level,
           associated_user_ids = COALESCE(p_users, '{}'), associated_ips = COALESCE(p_ips, '{}'), updated_at = now()
     WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Network not found';
    END IF;
  END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (CASE WHEN p_id IS NULL THEN 'risk.network_created' ELSE 'risk.network_updated' END, auth.uid(), v_id::text,
          'fraud_network', 'Fraud network ' || trim(p_name),
          jsonb_build_object('risk_level', p_risk_level, 'users', COALESCE(cardinality(p_users), 0), 'ips', COALESCE(cardinality(p_ips), 0)));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_save_fraud_network(uuid, text, text, text, uuid[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_save_fraud_network(uuid, text, text, text, uuid[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_delete_fraud_network(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Only admins can delete fraud networks';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  DELETE FROM public.fraud_networks WHERE id = p_id;
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('risk.network_deleted', auth.uid(), p_id::text, 'fraud_network', 'Fraud network removed', '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_delete_fraud_network(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_delete_fraud_network(uuid) TO authenticated;


-- ── 4. platform rules editor (super admin) ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_list_platform_rules()
RETURNS TABLE (id uuid, key text, value jsonb, category text, description text, updated_at timestamptz, updated_by_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can see platform rules';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT r.id, r.key, r.value, r.category, r.description, r.updated_at, COALESCE(p.full_name, p.username)
  FROM public.platform_rules r
  LEFT JOIN public.profiles p ON p.id = r.updated_by
  ORDER BY r.category, r.key;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_platform_rules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_platform_rules() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_platform_rule(p_key text, p_value jsonb, p_description text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can change platform rules';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT r.value INTO v_before FROM public.platform_rules r WHERE r.key = p_key;

  IF v_before IS NULL AND NOT EXISTS (SELECT 1 FROM public.platform_rules r WHERE r.key = p_key) THEN
    INSERT INTO public.platform_rules (key, value, description, updated_by) VALUES (p_key, p_value, p_description, auth.uid());
  ELSE
    UPDATE public.platform_rules
       SET value = p_value, description = COALESCE(p_description, description), updated_by = auth.uid(), updated_at = now()
     WHERE key = p_key;
  END IF;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('system.rule_changed', auth.uid(), p_key, 'platform_rule', left(p_reason, 300),
          jsonb_build_object('before', v_before, 'after', p_value));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_platform_rule(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_platform_rule(text, jsonb, text, text) TO authenticated;


-- ── 5. staff role review: who holds which role, and when it was last confirmed ─────────────────
CREATE TABLE IF NOT EXISTS public.staff_role_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL,
  role        text NOT NULL,
  note        text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_role_reviews_user ON public.staff_role_reviews (user_id, reviewed_at DESC);
ALTER TABLE public.staff_role_reviews ENABLE ROW LEVEL SECURITY;
-- no policies: only the functions below read or write it

CREATE OR REPLACE FUNCTION public.staff_roles_for_review(p_days integer DEFAULT 90)
RETURNS TABLE (user_id uuid, full_name text, username text, role text, last_reviewed_at timestamptz, reviewed_by_name text, is_due boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can review staff roles';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, p.full_name, p.username, ur.role::text,
         lr.reviewed_at, COALESCE(rp.full_name, rp.username),
         (lr.reviewed_at IS NULL OR lr.reviewed_at < now() - make_interval(days => p_days))
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  LEFT JOIN LATERAL (
    SELECT r.reviewed_at, r.reviewed_by FROM public.staff_role_reviews r
     WHERE r.user_id = ur.user_id ORDER BY r.reviewed_at DESC LIMIT 1
  ) lr ON true
  LEFT JOIN public.profiles rp ON rp.id = lr.reviewed_by
  WHERE ur.role IN ('moderator'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role)
  ORDER BY (lr.reviewed_at IS NULL OR lr.reviewed_at < now() - make_interval(days => p_days)) DESC,
           public.staff_rank(ur.user_id) DESC, p.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_roles_for_review(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_roles_for_review(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_confirm_role(p_user uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN
    RAISE EXCEPTION 'Only a super admin can confirm staff roles';
  END IF;
  IF NOT public.staff_mfa_ok() THEN
    RAISE EXCEPTION 'Two-step sign-in is required for this action';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot confirm your own role. Another super admin has to.';
  END IF;

  SELECT ur.role::text INTO v_role FROM public.user_roles ur
   WHERE ur.user_id = p_user AND ur.role IN ('moderator'::public.app_role, 'admin'::public.app_role, 'super_admin'::public.app_role)
   LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'That account does not hold a staff role';
  END IF;

  INSERT INTO public.staff_role_reviews (user_id, reviewed_by, role, note) VALUES (p_user, auth.uid(), v_role, p_note);
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('staff.role_confirmed', auth.uid(), p_user::text, 'user', COALESCE(left(p_note, 200), 'Role confirmed in the periodic review'),
          jsonb_build_object('role', v_role));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_confirm_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_confirm_role(uuid, text) TO authenticated;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- 1. As a staff account request audited access to a room; as a different admin open /admin → Access: the request is there
--    with Approve and Reject. A super admin's request only shows Approve to another super admin.
-- 2. Approve it: the requester gets "Audited access approved" and can open the space for 2 hours from now.
-- 3. SELECT * FROM staff_security_settings();   -- require_mfa false until a super admin switches it on
