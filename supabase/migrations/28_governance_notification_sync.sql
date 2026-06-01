-- ============================================================
-- 28_governance_notification_sync.sql
-- CineCraft Connect — Governance Notification Integration
-- ============================================================

-- Refined Ban User Function with Notifications
CREATE OR REPLACE FUNCTION public.ban_user(
  _target_user_id uuid,
  _reason text,
  _ban_type text DEFAULT 'permanent',
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
  
  -- Insert into user_bans
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at, is_active)
  VALUES (_target_user_id, auth.uid(), _reason, _ban_type, _expires_at, true);
  
  -- Update profile status
  UPDATE public.profiles SET is_banned = true WHERE id = _target_user_id;
  
  -- Send Real-time Notification
  PERFORM public.send_governance_notification(_target_user_id, 'ban', _reason);
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'ban_user', 'user', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'ban_type', _ban_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Refined Lift Ban Function with Notifications
CREATE OR REPLACE FUNCTION public.lift_ban(
  _target_user_id uuid
)
RETURNS void AS $$
BEGIN
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to lift bans';
  END IF;
  
  -- Deactivate active bans for the user
  UPDATE public.user_bans
  SET is_active = false, lifted_at = now(), lifted_by = auth.uid()
  WHERE user_id = _target_user_id AND is_active = true;
  
  -- Update profile status
  UPDATE public.profiles SET is_banned = false WHERE id = _target_user_id;
  
  -- Send Real-time Notification
  PERFORM public.send_governance_notification(_target_user_id, 'governance', 'Your account access has been fully restored. Welcome back to the platform.');
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'lift_ban', 'user', _target_user_id::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
