-- ============================================================
-- 16_admin_governance_layer.sql
-- CineCraft Connect — Platform Governance & Admin Layer
-- ============================================================

-- ── 1. Identity & RBAC Foundations ──────────────────────────

-- App Role Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Ensure super_admin value is present if enum already existed
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN others THEN null;
END $$;

-- User Roles Table (Mapping users to roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now()
);

-- RBAC Check Function
CREATE OR REPLACE FUNCTION public.has_role(
  _role public.app_role,
  _user_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Content Reports (Layer 5 — Moderator Input) ──────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'user', 'job', 'listing', 'room', 'message')),
  target_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'hate_speech', 'misinformation',
    'explicit_content', 'impersonation', 'fraud', 'other'
  )),
  details text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  resolution_note text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── 3. Verification Requests (Layer 9) ──────────────────────
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('creator', 'professional', 'public_figure', 'company')),
  full_legal_name text NOT NULL,
  government_id_url text,
  supporting_doc_url text,
  social_links jsonb,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'revoked')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ── 4. Audit Log (Layer 11 — All privileged actions) ────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,           -- e.g. 'ban_user', 'approve_verification', 'delete_post'
  target_type text,               -- e.g. 'user', 'post', 'verification_request'
  target_id text,
  metadata jsonb,                 -- before/after state, reason, etc.
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── 5. Platform Feature Flags (Layer 7 — Super Admin) ───────
CREATE TABLE IF NOT EXISTS public.platform_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,       -- e.g. 'marketplace_enabled', 'new_user_registration'
  value boolean DEFAULT true,
  description text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Seed default flags
INSERT INTO public.platform_flags (key, value, description) VALUES
  ('user_registration_enabled', true, 'Allow new users to register on the platform'),
  ('marketplace_enabled', true, 'Enable the Equipment & Location Marketplace'),
  ('job_posting_enabled', true, 'Allow users to post new job listings'),
  ('verification_requests_enabled', true, 'Allow users to submit verification requests'),
  ('discussion_rooms_enabled', true, 'Enable Discussion Rooms feature'),
  ('creator_monetization_enabled', false, 'Enable creator subscription monetization (UI only)')
ON CONFLICT (key) DO NOTHING;

-- ── 6. User Ban / Suspension Table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  ban_type text DEFAULT 'temporary' CHECK (ban_type IN ('temporary', 'permanent')),
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  lifted_at timestamp with time zone,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ── 7. RLS Policies ─────────────────────────────────────────

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role('super_admin'::public.app_role, auth.uid()));

-- content_reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
CREATE POLICY "Users can create reports" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Moderators can view all reports" ON public.content_reports;
CREATE POLICY "Moderators can view all reports" ON public.content_reports
  FOR SELECT USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

DROP POLICY IF EXISTS "Moderators can update reports" ON public.content_reports;
CREATE POLICY "Moderators can update reports" ON public.content_reports
  FOR UPDATE USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- verification_requests
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create own verification request" ON public.verification_requests;
CREATE POLICY "Users can create own verification request" ON public.verification_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own verification requests" ON public.verification_requests;
CREATE POLICY "Users can view own verification requests" ON public.verification_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;
CREATE POLICY "Admins can update verification requests" ON public.verification_requests
  FOR UPDATE USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- platform_flags
ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read platform flags" ON public.platform_flags;
CREATE POLICY "Anyone can read platform flags" ON public.platform_flags
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only super_admin can modify flags" ON public.platform_flags;
CREATE POLICY "Only super_admin can modify flags" ON public.platform_flags
  FOR ALL USING (public.has_role('super_admin'::public.app_role, auth.uid()));

-- user_bans
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage bans" ON public.user_bans;
CREATE POLICY "Admins can manage bans" ON public.user_bans
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

DROP POLICY IF EXISTS "Users can view own ban status" ON public.user_bans;
CREATE POLICY "Users can view own ban status" ON public.user_bans
  FOR SELECT USING (auth.uid() = user_id);

-- ── 8. RPC Functions ─────────────────────────────────────────

-- Grant a role to a user (super_admin only)
CREATE OR REPLACE FUNCTION public.assign_user_role(
  _target_user_id uuid,
  _role public.app_role
)
RETURNS void AS $$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super_admin can assign roles';
  END IF;
  
  -- Remove existing role for this user first
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = _role;
  
  -- Audit log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'super_admin', 'assign_role', 'user', _target_user_id::text,
    jsonb_build_object('new_role', _role::text)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke a role (revert to regular user)
CREATE OR REPLACE FUNCTION public.revoke_user_role(_target_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super_admin can revoke roles';
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'super_admin', 'revoke_role', 'user', _target_user_id::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Emergency / First Setup: Claim Super Admin (only works if system has 0 super admins)
CREATE OR REPLACE FUNCTION public.claim_admin_access()
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'A Super Admin already exists. Access denied.';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'::public.app_role;

  -- Audit log for the first admin
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'super_admin', 'claim_initial_admin', 'user', auth.uid()::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ban a user
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
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'ban_user', 'user', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'ban_type', _ban_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve a verification request
CREATE OR REPLACE FUNCTION public.approve_verification(
  _request_id uuid,
  _note text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  UPDATE public.verification_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), verified_at = now()
  WHERE id = _request_id;
  
  -- Mark profile as verified
  UPDATE public.profiles SET is_verified = true
  WHERE id = (SELECT user_id FROM public.verification_requests WHERE id = _request_id);
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'approve_verification', 'verification_request', _request_id::text,
    jsonb_build_object('note', _note)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a verification request
CREATE OR REPLACE FUNCTION public.reject_verification(
  _request_id uuid,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  UPDATE public.verification_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
  WHERE id = _request_id;
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'reject_verification', 'verification_request', _request_id::text,
    jsonb_build_object('reason', _reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve a content report
CREATE OR REPLACE FUNCTION public.resolve_report(
  _report_id uuid,
  _status text,
  _note text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  UPDATE public.content_reports
  SET status = _status, reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = _note
  WHERE id = _report_id;
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'moderator', 'resolve_report', 'content_report', _report_id::text,
    jsonb_build_object('resolution', _status, 'note', _note)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. Add is_verified to profiles if not present ───────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- ── 10. Unique constraint on user_roles ─────────────────────
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_unique;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- ── 11. HOW TO CREATE THE FIRST SUPER ADMIN ─────────────────
-- Run the following in the Supabase SQL Editor after deploying:
--
-- Step 1: Find the user ID of the account to promote
--   SELECT id, username, full_name FROM profiles WHERE username = 'your_username';
--
-- Step 2: Insert their super_admin role directly
--   INSERT INTO user_roles (user_id, role)
--   VALUES ('<paste-user-uuid-here>', 'super_admin')
--   ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
--
-- Only super_admin can then promote others via the Super Admin Dashboard.
-- ─────────────────────────────────────────────────────────────
