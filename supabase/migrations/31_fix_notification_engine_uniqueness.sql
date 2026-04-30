-- ============================================================
-- 31_fix_notification_engine_uniqueness.sql
-- CineCraft Connect — Notification Engine Hardening
-- ============================================================

-- 1. Drop all known signatures to resolve the "is not unique" conflict
-- We drop with CASCADE to ensure no dependencies block the cleanup
DROP FUNCTION IF EXISTS public.send_governance_notification(uuid, text, text, boolean, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.send_governance_notification(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.send_governance_notification(uuid, text) CASCADE;

-- 2. Create the ONE authoritative version
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
    WHEN 'governance' THEN
      v_title := 'Governance Update';
      v_message := COALESCE(_reason, 'An administrative action was taken on your account.');
    ELSE
      v_title := 'Governance Notification';
      v_message := COALESCE(_reason, 'Update regarding your account status.');
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
