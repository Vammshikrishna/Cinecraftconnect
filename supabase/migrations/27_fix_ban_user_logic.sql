-- ============================================================
-- 27_fix_ban_user_logic.sql
-- CineCraft Connect — User Suspension Logic Fix
-- ============================================================

-- Improved Ban User Function
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
  
  -- Update profile status (Critical for UI consistency)
  UPDATE public.profiles SET is_banned = true WHERE id = _target_user_id;
  
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
