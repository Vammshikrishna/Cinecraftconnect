-- ============================================================
-- 30_rename_lift_ban_rpc.sql
-- CineCraft Connect — Account Restoration RPC Rename
-- ============================================================

-- New function with unique name to avoid any signature conflicts
CREATE OR REPLACE FUNCTION public.restore_user_access(
  target_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to restore access';
  END IF;
  
  -- 1. Deactivate all active bans for this user
  UPDATE public.user_bans
  SET 
    is_active = false, 
    lifted_at = now(), 
    lifted_by = auth.uid()
  WHERE user_id = target_user_id AND is_active = true;
  
  -- 2. Clear the ban flag on the profile
  UPDATE public.profiles 
  SET is_banned = false 
  WHERE id = target_user_id;
  
  -- 3. Send real-time notification
  PERFORM public.send_governance_notification(target_user_id, 'governance', 'Welcome back! Your account access has been fully restored.');
  
  -- 4. Audit Log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'restore_access', 'user', target_user_id::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
