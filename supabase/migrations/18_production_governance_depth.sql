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
