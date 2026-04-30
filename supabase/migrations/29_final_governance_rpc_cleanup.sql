-- ============================================================
-- 29_final_governance_rpc_cleanup.sql
-- CineCraft Connect — Final Governance RPC Hardening
-- ============================================================

-- DROP existing versions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.ban_user(uuid, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.lift_ban(uuid);

-- 1. Hardened Ban User Function
CREATE OR REPLACE FUNCTION public.ban_user(
  _target_user_id uuid,
  _reason text,
  _ban_type text DEFAULT 'permanent',
  _expires_at timestamp with time zone DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Record the ban
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at, is_active)
  VALUES (_target_user_id, auth.uid(), _reason, _ban_type, _expires_at, true);
  
  -- Flag the profile
  UPDATE public.profiles SET is_banned = true WHERE id = _target_user_id;
  
  -- Notify the user
  PERFORM public.send_governance_notification(_target_user_id, 'ban', _reason);
  
  -- Audit the action
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'ban_user', 'user', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'ban_type', _ban_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hardened Lift Ban Function
CREATE OR REPLACE FUNCTION public.lift_ban(
  _target_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Deactivate active bans
  UPDATE public.user_bans
  SET is_active = false, lifted_at = now(), lifted_by = auth.uid()
  WHERE user_id = _target_user_id AND is_active = true;
  
  -- Unflag the profile
  UPDATE public.profiles SET is_banned = false WHERE id = _target_user_id;
  
  -- Notify the user
  PERFORM public.send_governance_notification(_target_user_id, 'governance', 'Access Restored: Your account has been reinstated.');
  
  -- Audit the action
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'lift_ban', 'user', _target_user_id::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
