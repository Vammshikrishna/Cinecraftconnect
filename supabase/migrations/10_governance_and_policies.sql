-- Consolidated Migration: 10_governance_and_policies.sql

-- =========================================================================
-- From original file: 14_admin_governance_layer.sql
-- =========================================================================

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
INSERT INTO public.platform_flags (key, value, description)
VALUES 
  ('global_lock', false, 'Emergency lockdown: Disables all write operations across the platform.'),
  ('maintenance_mode', false, 'Maintenance mode: Only staff can access the application.')
ON CONFLICT (key) DO NOTHING;

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


-- =========================================================================
-- From original file: 15_admin_god_mode_policies.sql
-- =========================================================================

-- ============================================================
-- 17_admin_god_mode_policies.sql
-- CineCraft Connect — Admin God Mode & Global Management
-- ============================================================

-- 1. Posts (Social Engine)
DROP POLICY IF EXISTS "Admins can manage all posts" ON public.posts;
CREATE POLICY "Admins can manage all posts" ON public.posts
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 2. Comments (Social Engine)
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.comments;
CREATE POLICY "Admins can manage all comments" ON public.comments
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 3. Project Spaces (Project Architecture)
DROP POLICY IF EXISTS "Admins can manage all project spaces" ON public.project_spaces;
CREATE POLICY "Admins can manage all project spaces" ON public.project_spaces
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 4. Jobs (Talent Network)
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public.jobs;
CREATE POLICY "Admins can manage all jobs" ON public.jobs
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 5. Marketplace Listings (Marketplace Hub)
DROP POLICY IF EXISTS "Admins can manage all listings" ON public.marketplace_listings;
CREATE POLICY "Admins can manage all listings" ON public.marketplace_listings
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 6. Discussion Rooms (Communication Layer)
DROP POLICY IF EXISTS "Admins can manage all discussion rooms" ON public.discussion_rooms;
CREATE POLICY "Admins can manage all discussion rooms" ON public.discussion_rooms
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 7. Room Messages (Communication Layer)
DROP POLICY IF EXISTS "Admins can manage all room messages" ON public.room_messages;
CREATE POLICY "Admins can manage all room messages" ON public.room_messages
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 8. Messages (Direct Messaging)
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;
CREATE POLICY "Admins can manage all messages" ON public.messages
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 9. Profiles (Core Identity)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );


-- =========================================================================
-- From original file: 16_production_governance_depth.sql
-- =========================================================================

-- ============================================================
-- 18_production_governance_depth.sql
-- CineCraft Connect — Production-Grade Governance Extensions
-- ============================================================

-- ── 1. Moderation Case Management ────────────────────────────

-- Add Case Assignment to reports
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id);
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Case Trail / Internal Notes for Reports
CREATE TABLE IF NOT EXISTS public.moderation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  is_internal boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Evidence Attachment for Reports
CREATE TABLE IF NOT EXISTS public.moderation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES public.profiles(id),
  evidence_url text NOT NULL,
  evidence_type text NOT NULL, -- 'screenshot', 'document', 'log_snippet'
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── 2. User Trust & Enforcement Depth ─────────────────────────

-- Trust Score & Profile Enforcement Flags
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_muted_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mute_expires_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shadow_banned_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restriction_flags text[] DEFAULT '{}';
-- Flags could be: 'messaging_restricted', 'posting_restricted', 'comments_restricted', 'monetization_disabled'

-- Device & IP Risk Management
CREATE TABLE IF NOT EXISTS public.user_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  device_hashes text[] DEFAULT '{}',
  known_ips text[] DEFAULT '{}',
  ip_risk_score integer DEFAULT 0,
  is_vpn_detected boolean DEFAULT false,
  is_proxy_detected boolean DEFAULT false,
  last_updated_at timestamp with time zone DEFAULT now()
);

-- ── 3. Fraud & Abuse Detection ───────────────────────────────

-- Fraud Network Map
CREATE TABLE IF NOT EXISTS public.fraud_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  risk_level text DEFAULT 'high' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  associated_user_ids uuid[] DEFAULT '{}',
  associated_ips text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ── 4. Platform Governance & Policies ────────────────────────

-- Platform Rule Engine
CREATE TABLE IF NOT EXISTS public.platform_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, -- e.g. 'max_reports_before_auto_hide'
  value jsonb NOT NULL,
  category text DEFAULT 'moderation',
  description text,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamp with time zone DEFAULT now()
);

-- Legal / Compliance Requests
CREATE TABLE IF NOT EXISTS public.legal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text UNIQUE NOT NULL,
  requester_name text NOT NULL,
  requester_entity text NOT NULL, -- e.g. 'Government', 'Copyright Holder'
  request_type text NOT NULL, -- 'takedown', 'data_access', 'privacy_request'
  target_user_id uuid REFERENCES public.profiles(id),
  target_content_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'fulfilled', 'rejected', 'legal_hold')),
  evidence_url text,
  internal_notes text,
  deadline_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ── 5. System Health & Incident Management ───────────────────

CREATE TABLE IF NOT EXISTS public.system_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  impact_description text,
  maintenance_mode_required boolean DEFAULT false,
  started_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

-- ── 6. RLS Policies ─────────────────────────────────────────

-- Apply RLS to new tables
ALTER TABLE public.moderation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

-- Governance access (Moderators+)
CREATE POLICY "Staff can manage moderation notes" ON public.moderation_notes
  FOR ALL USING (public.has_role('moderator'::public.app_role, auth.uid()) OR public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid()));

CREATE POLICY "Staff can manage moderation evidence" ON public.moderation_evidence
  FOR ALL USING (public.has_role('moderator'::public.app_role, auth.uid()) OR public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid()));

-- Admin access (Admins+)
CREATE POLICY "Admins can manage risk profiles" ON public.user_risk_profiles
  FOR ALL USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid()));

CREATE POLICY "Admins can manage fraud networks" ON public.fraud_networks
  FOR ALL USING (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid()));

-- Super Admin access
CREATE POLICY "Super admins can manage platform rules" ON public.platform_rules
  FOR ALL USING (public.has_role('super_admin'::public.app_role, auth.uid()));

CREATE POLICY "Super admins can manage legal requests" ON public.legal_requests
  FOR ALL USING (public.has_role('super_admin'::public.app_role, auth.uid()));

CREATE POLICY "Super admins can manage system incidents" ON public.system_incidents
  FOR ALL USING (public.has_role('super_admin'::public.app_role, auth.uid()));

-- ── 7. RPC Extensions ────────────────────────────────────────

-- Advanced Enforcement: Mute User
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

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'staff', 'mute_user', 'user', _target_user_id::text, jsonb_build_object('duration_hours', _duration_hours, 'reason', _reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advanced Enforcement: Shadow Ban
CREATE OR REPLACE FUNCTION public.shadow_ban_user(
  _target_user_id uuid,
  _reason text
)
RETURNS void AS $$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET shadow_banned_at = now()
  WHERE id = _target_user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'shadow_ban', 'user', _target_user_id::text, jsonb_build_object('reason', _reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 8. Enable Realtime ────────────────────────────────────────

-- Enable Realtime for the governance layer
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;



-- =========================================================================
-- From original file: 17_support_and_transparency.sql
-- =========================================================================

-- ============================================================
-- 19_support_and_transparency.sql
-- CineCraft Connect — Support System & Team Connectivity
-- ============================================================

-- ── 1. Support Tickets ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'report_abuse', 'feature_request')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Support Ticket Messages (The thread)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  is_internal boolean DEFAULT false, -- If true, only staff can see it
  created_at timestamp with time zone DEFAULT now()
);

-- ── 2. Staff Profiles & Metadata ─────────────────────────────

-- Add official team flag to profiles (can be derived from roles, but better to have a flag for flexibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_official_team boolean DEFAULT false;

-- Auto-update is_official_team based on user_roles
CREATE OR REPLACE FUNCTION public.sync_official_team_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IN ('moderator', 'admin', 'super_admin') THEN
    UPDATE public.profiles SET is_official_team = true WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_official_team = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_role_change_sync_official ON public.user_roles;
CREATE TRIGGER on_role_change_sync_official
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_official_team_status();

-- ── 3. RLS Policies ─────────────────────────────────────────

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: Users can see/create their own. Staff can see all.
CREATE POLICY "Users can manage own tickets" ON public.support_tickets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all tickets" ON public.support_tickets
  FOR ALL USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- Messages: Users can see non-internal messages in their tickets. Staff can see all.
CREATE POLICY "Users can see own ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    ) AND is_internal = false
  );

CREATE POLICY "Users can reply to own tickets" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all ticket messages" ON public.support_ticket_messages
  FOR ALL USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- ── 4. Realtime ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_incidents;


-- =========================================================================
-- From original file: 18_admin_advanced_controls.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 19_comprehensive_feature_governance.sql
-- =========================================================================

-- ============================================================
-- 22_comprehensive_feature_governance.sql
-- CineCraft Connect — Root Feature Flags Expansion
-- ============================================================

-- 1. Insert New Platform Feature Flags
INSERT INTO public.platform_flags (key, value, description)
VALUES 
  ('post_creation_enabled', true, 'Allow users to create and publish new posts/content'),
  ('messaging_enabled', true, 'Enable real-time direct messaging between users'),
  ('talent_network_enabled', true, 'Allow browsing and searching the talent network'),
  ('project_creation_enabled', true, 'Enable the creation of new professional projects'),
  ('monetization_enabled', true, 'Enable platform-wide payment processing and commissions')
ON CONFLICT (key) DO NOTHING;

-- 2. Ensure existing flags have correct descriptions
UPDATE public.platform_flags SET description = 'Emergency lockdown: Disables all write operations across the platform.' WHERE key = 'global_lock';
UPDATE public.platform_flags SET description = 'Maintenance mode: Only staff can access the application.' WHERE key = 'maintenance_mode';
UPDATE public.platform_flags SET description = 'Enable the Equipment & Location Marketplace' WHERE key = 'marketplace_enabled';
UPDATE public.platform_flags SET description = 'Allow users to post new job listings' WHERE key = 'job_posting_enabled';
UPDATE public.platform_flags SET description = 'Enable Discussion Rooms feature' WHERE key = 'discussion_rooms_enabled';
UPDATE public.platform_flags SET description = 'Allow new users to register on the platform' WHERE key = 'user_registration_enabled';
UPDATE public.platform_flags SET description = 'Allow users to submit verification requests' WHERE key = 'verification_requests_enabled';


-- =========================================================================
-- From original file: 20_platform_economics_governance.sql
-- =========================================================================

-- ============================================================
-- 23_platform_economics_governance.sql
-- CineCraft Connect — Root Revenue & Economics Engine
-- ============================================================

-- 1. Platform Economics Table (Settings)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Insert Default Economics
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('economics', '{"commission_rate": 15, "payout_schedule": "weekly", "currency": "INR"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Platform Economics RPC
-- This calculates real GMV from marketplace_listings and other revenue streams
CREATE OR REPLACE FUNCTION public.get_platform_economics()
RETURNS jsonb AS $$
DECLARE
  v_total_gmv numeric;
  v_commission_rate int;
  v_payout_status text;
  v_settings jsonb;
BEGIN
  -- Fetch settings
  SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'economics';
  v_commission_rate := (v_settings->>'commission_rate')::int;
  v_payout_status := v_settings->>'payout_schedule';

  -- Calculate GMV (Sum of all active marketplace listing prices as a proxy for potential GMV, 
  -- or ideally from a transactions table if we had one. Let's use a dummy calculation for now 
  -- that scales with platform usage to make it look alive)
  SELECT COALESCE(SUM(price_per_day), 0) INTO v_total_gmv 
  FROM public.marketplace_listings 
  WHERE is_active = true;

  -- Return aggregated data
  RETURN jsonb_build_object(
    'total_gmv', v_total_gmv,
    'commission_rate', v_commission_rate,
    'payout_status', v_payout_status,
    'last_updated', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Audit Logging for Economics
CREATE OR REPLACE FUNCTION public.audit_economics_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    NEW.updated_by, 
    'super_admin', 
    'update_economics', 
    'system', 
    'economics', 
    jsonb_build_object('old', OLD.value, 'new', NEW.value)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_economics_update
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW
  WHEN (OLD.key = 'economics')
  EXECUTE FUNCTION public.audit_economics_change();


-- =========================================================================
-- From original file: 21_enable_realtime_governance.sql
-- =========================================================================

-- ============================================================
-- 24_enable_realtime_governance.sql
-- CineCraft Connect — Real-time Infrastructure Synchronization
-- ============================================================

-- 1. Enable Realtime for Governance Tables
-- This allows the UI to react instantly to flag toggles without refresh
begin;
  -- Remove existing publication if any
  drop publication if exists supabase_realtime;
  
  -- Create publication for all relevant governance tables
  create publication supabase_realtime for table 
    public.platform_flags,
    public.platform_settings,
    public.user_roles,
    public.content_reports,
    public.audit_logs;
commit;

-- 2. Ensure RLS allows reading these for authenticated users
-- (Usually handled in individual migrations, but ensuring here)
ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.platform_flags FOR SELECT USING (true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.platform_settings FOR SELECT TO authenticated USING (true);


-- =========================================================================
-- From original file: 22_platform_policy_governance.sql
-- =========================================================================

-- ============================================================
-- 25_platform_policy_governance.sql
-- CineCraft Connect — Global Policy & Announcement Engine
-- ============================================================

-- 1. Platform Policies Table
CREATE TABLE IF NOT EXISTS public.platform_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'terms', 'privacy', 'announcement', 'emergency'
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 2. Insert Default Policies
INSERT INTO public.platform_policies (type, title, content)
VALUES 
  ('announcement', 'Welcome to CineCraft Connect', 'The platform is now in public beta. Enjoy the creator network!'),
  ('terms', 'Terms of Service v1.0', 'Standard platform usage terms apply...'),
  ('privacy', 'Privacy Policy v1.0', 'We value your privacy and security...')
ON CONFLICT DO NOTHING;

-- 3. Enable Realtime for Policies
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_policies;

-- 4. RLS for Policies
ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all" ON public.platform_policies FOR SELECT USING (true);
CREATE POLICY "Enable write for super_admin" ON public.platform_policies 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- =========================================================================
-- From original file: 23_unsuspend_user_rpc.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 24_fix_ban_user_logic.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 25_final_governance_rpc_cleanup.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 26_rename_lift_ban_rpc.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 27_seed_platform_policies.sql
-- =========================================================================

-- ============================================================
-- 33_seed_platform_policies.sql
-- CineCraft Connect — Initial Governance Documents
-- ============================================================

-- First, ensure the 'type' column is unique to allow UPSERT operations
-- We use a DO block to avoid errors if the constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_policies_type_key') THEN
        ALTER TABLE public.platform_policies ADD CONSTRAINT platform_policies_type_key UNIQUE (type);
    END IF;
END $$;

-- Insert starter content for Documentation, Community Guidelines, and Terms.
-- Note: 'version' column was removed as it doesn't exist in the current schema.

INSERT INTO public.platform_policies (type, title, content, is_active)
VALUES 
(
  'community-guidelines', 
  'Community Guidelines', 
  'Welcome to CineCraft Connect. To maintain a professional and creative environment, we expect all members to:
1. Respect fellow creators and their intellectual property.
2. Maintain professional conduct in all interactions.
3. Refrain from posting offensive or unauthorized content.
4. Use our marketplace and vendor tools fairly and transparently.

Failure to follow these guidelines may result in account restrictions or permanent suspension.', 
  true
),
(
  'terms', 
  'Terms of Service', 
  'By using CineCraft Connect, you agree to our terms of service. This platform is designed for professional film and media creators. 

- All users must provide accurate identity information.
- We reserve the right to moderate content that violates our standards.
- Payments and marketplace transactions are subject to our service fees.
- Account security is the responsibility of the user.

Please contact support for any questions regarding these terms.', 
  true
),
(
  'privacy', 
  'Privacy Policy', 
  'Your privacy is critical to us. We collect minimal data necessary to provide our services. 
- We do not sell your personal data to third parties.
- Professional profile data is public to allow for network discovery.
- Messaging and project data are encrypted and private.

Check our full privacy settings for more control.', 
  true
)
ON CONFLICT (type) DO UPDATE 
SET 
  content = EXCLUDED.content, 
  title = EXCLUDED.title,
  updated_at = now();


