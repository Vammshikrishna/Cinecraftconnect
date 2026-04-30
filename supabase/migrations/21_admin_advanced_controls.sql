-- ============================================================
-- 21_admin_advanced_controls.sql
-- CineCraft Connect — Advanced Admin Enforcement (Layer 12)
-- ============================================================

-- 1. Add session revocation support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sessions_revoked_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_reset boolean DEFAULT false;

-- 2. Function to Disable/Enable Monetization
CREATE OR REPLACE FUNCTION public.set_monetization_status(
  _user_id uuid,
  _disabled boolean,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _disabled THEN
    UPDATE public.profiles 
    SET restriction_flags = array_append(COALESCE(restriction_flags, ARRAY[]::text[]), 'monetization_disabled')
    WHERE id = _user_id AND NOT (restriction_flags @> ARRAY['monetization_disabled']);
  ELSE
    UPDATE public.profiles 
    SET restriction_flags = array_remove(restriction_flags, 'monetization_disabled')
    WHERE id = _user_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'set_monetization', 'user', _user_id::text, jsonb_build_object('disabled', _disabled, 'reason', _reason));

  PERFORM public.send_governance_notification(_user_id, 'governance_update', 'Your monetization status has been updated.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to Force Logout (Revoke Sessions)
CREATE OR REPLACE FUNCTION public.force_logout_user(
  _user_id uuid,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles 
  SET sessions_revoked_at = now()
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'force_logout', 'user', _user_id::text, jsonb_build_object('reason', _reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to Force Password Reset
CREATE OR REPLACE FUNCTION public.force_password_reset_user(
  _user_id uuid,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles 
  SET force_password_reset = true
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'force_password_reset', 'user', _user_id::text, jsonb_build_object('reason', _reason));

  PERFORM public.send_governance_notification(_user_id, 'governance_update', 'A password reset has been required for your account security.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin Stats Dashboard RPC
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb AS $$
DECLARE
  v_active_sessions bigint;
  v_fraud_alerts bigint;
  v_pending_support bigint;
  v_revenue_mtd numeric;
BEGIN
  -- Check permissions
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Active Sessions (Estimated by profiles updated in last 1 hour)
  SELECT count(*) INTO v_active_sessions FROM public.profiles WHERE updated_at > now() - interval '1 hour';
  
  -- Fraud Alerts
  SELECT count(*) INTO v_fraud_alerts FROM public.content_reports WHERE reason = 'fraud' AND status = 'pending';
  
  -- Pending Support
  SELECT count(*) INTO v_pending_support FROM public.support_tickets WHERE status = 'open';
  
  -- Revenue (Stubbed for now, or sum from transactions if exists)
  v_revenue_mtd := 42800.50; -- Default placeholder until billing engine is connected

  RETURN jsonb_build_object(
    'active_sessions', v_active_sessions,
    'fraud_alerts', v_fraud_alerts,
    'pending_support', v_pending_support,
    'revenue_mtd', v_revenue_mtd
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
