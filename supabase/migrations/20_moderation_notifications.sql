-- ============================================================
-- 20_moderation_notifications.sql
-- CineCraft Connect — Moderation Notification Logic
-- ============================================================

-- 2. Notification Audit Table for Decision History
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('notified', 'suppressed', 'delayed')),
  disclosure_level text CHECK (disclosure_level IN ('full', 'limited', 'none')),
  suppression_reason text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
-- 3. Unified Governance Notification Engine
CREATE OR REPLACE FUNCTION public.send_governance_notification(
  _target_user_id uuid,
  _action_type text,
  _reason text DEFAULT NULL,
  _notify_user boolean DEFAULT true,
  _disclosure_level text DEFAULT 'full',
  _suppression_reason text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
  v_title text;
  v_message text;
  v_priority text := 'high';
BEGIN
  -- 1. Audit the decision regardless of whether we notify
  INSERT INTO public.notification_logs (
    target_user_id, action_type, decision, disclosure_level, suppression_reason, metadata
  ) VALUES (
    _target_user_id, _action_type, 
    CASE WHEN _notify_user THEN 'notified' ELSE 'suppressed' END,
    _disclosure_level, _suppression_reason, _metadata
  );

  -- 2. Exit if suppressed or level is none
  IF NOT _notify_user OR _disclosure_level = 'none' THEN
    RETURN;
  END IF;

  -- Template Logic
  CASE _action_type
    WHEN 'warn' THEN
      v_title := 'Account Warning';
      v_message := 'Your account has received a warning for: ' || COALESCE(_reason, 'Community guidelines violation') || '. Please review our rules.';
    WHEN 'mute' THEN
      v_title := 'Account Restricted';
      v_message := 'Your account has been temporarily restricted for: ' || COALESCE(_reason, 'Rule violation') || '.';
    WHEN 'ban' THEN
      v_title := 'Account Banned';
      v_message := 'Your account has been permanently suspended for severe violations: ' || COALESCE(_reason, 'Policy breach') || '.';
    WHEN 'verify_approve' THEN
      v_title := 'Identity Verified';
      v_message := 'Congratulations! Your verification request has been approved.';
      v_priority := 'medium';
    WHEN 'verify_reject' THEN
      v_title := 'Verification Update';
      v_message := 'Your verification request was not approved. Reason: ' || COALESCE(_reason, 'Incomplete documentation');
    WHEN 'role_assign' THEN
      v_title := 'Privileges Granted';
      v_message := 'You have been granted ' || COALESCE(_reason, 'staff') || ' privileges. Please check the governance console.';
    WHEN 'role_revoke' THEN
      v_title := 'Privileges Updated';
      v_message := 'Your internal privileges (' || COALESCE(_reason, 'staff') || ') have been revoked.';
    WHEN 'content_removed' THEN
      v_title := 'Content Removed';
      v_message := 'A piece of content you posted was removed for violating policy: ' || COALESCE(_reason, 'Community guidelines');
    WHEN 'monetization_disabled' THEN
      v_title := 'Monetization Update';
      v_message := 'Platform monetization has been disabled for your account. Reason: ' || COALESCE(_reason, 'Policy review');
    ELSE
      v_title := 'Governance Update';
      v_message := COALESCE(_reason, 'An administrative action was taken on your account.');
  END CASE;

  -- Limited disclosure override
  IF _disclosure_level = 'limited' THEN
    v_message := 'An administrative action has been taken on your account regarding ' || _action_type || '. Please contact support for more details.';
  END IF;

  -- 3. Insert into real notifications table
  INSERT INTO public.notifications (
    user_id, title, message, type, priority, metadata
  ) VALUES (
    _target_user_id, v_title, v_message, 'governance', v_priority, 
    _metadata || jsonb_build_object('action', _action_type, 'appealable', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update ban_user to send notification
CREATE OR REPLACE FUNCTION public.ban_user(
  _target_user_id uuid,
  _reason text,
  _ban_type text DEFAULT 'temporary',
  _expires_at timestamp with time zone DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to ban users';
  END IF;
  
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at)
  VALUES (_target_user_id, auth.uid(), _reason, _ban_type, _expires_at);
  
  PERFORM public.send_governance_notification(_target_user_id, 'ban', _reason);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'ban_user', 'user', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'ban_type', _ban_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update mute_user to send notification
CREATE OR REPLACE FUNCTION public.mute_user(
  _target_user_id uuid,
  _duration_hours integer,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (public.has_role('moderator'::public.app_role, auth.uid()) OR public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET 
    last_muted_at = now(),
    mute_expires_at = now() + (_duration_hours * interval '1 hour'),
    restriction_flags = array_append(restriction_flags, 'messaging_restricted')
  WHERE id = _target_user_id;

  PERFORM public.send_governance_notification(_target_user_id, 'mute', _reason);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'staff', 'mute_user', 'user', _target_user_id::text, jsonb_build_object('duration_hours', _duration_hours, 'reason', _reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update verification approval to send notification
DROP FUNCTION IF EXISTS public.approve_verification(uuid);
DROP FUNCTION IF EXISTS public.approve_verification(uuid, text);
CREATE OR REPLACE FUNCTION public.approve_verification(
  _request_id uuid
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT user_id INTO v_user_id FROM public.verification_requests WHERE id = _request_id;

  UPDATE public.verification_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;

  UPDATE public.profiles
  SET is_verified = true, trust_score = trust_score + 20
  WHERE id = v_user_id;

  PERFORM public.send_governance_notification(v_user_id, 'verify_approve');

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'admin', 'approve_verification', 'verification_request', _request_id::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update verification rejection to send notification
DROP FUNCTION IF EXISTS public.reject_verification(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_verification(
  _request_id uuid,
  _reason text
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT user_id INTO v_user_id FROM public.verification_requests WHERE id = _request_id;

  UPDATE public.verification_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
  WHERE id = _request_id;

  PERFORM public.send_governance_notification(v_user_id, 'verify_reject', _reason);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'reject_verification', 'verification_request', _request_id::text, jsonb_build_object('reason', _reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update role assignment to send notification
DROP FUNCTION IF EXISTS public.assign_user_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.assign_user_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS void AS $$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can assign roles';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.send_governance_notification(_user_id, 'role_assign', _role::text);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'assign_role', 'user', _user_id::text, jsonb_build_object('role', _role));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Update role revocation to send notification
DROP FUNCTION IF EXISTS public.revoke_user_role(uuid);
DROP FUNCTION IF EXISTS public.revoke_user_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.revoke_user_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS void AS $$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can revoke roles';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;

  PERFORM public.send_governance_notification(_user_id, 'role_revoke', _role::text);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'revoke_role', 'user', _user_id::text, jsonb_build_object('role', _role));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
