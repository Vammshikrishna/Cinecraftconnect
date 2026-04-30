-- ============================================================
-- 26_unsuspend_user_rpc.sql
-- CineCraft Connect — User Suspension Management
-- ============================================================

-- Function to lift a user ban
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
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'lift_ban', 'user', _target_user_id::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
