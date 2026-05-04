-- CineCraft Connect: Governance Operating System (G-OS)
-- Physical Database Schema Provisioning
-- Target Environment: Supabase PostgreSQL

-- 1. Forensic Audit Ledger (Immutable History)
-- Records every administrative action with Before/After snapshots
CREATE TABLE IF NOT EXISTS public.gov_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    reason TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    prev_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb
);

-- 2. Approval Queue (Maker-Checker System)
-- Staging area for high-risk actions requiring dual-control verification
CREATE TABLE IF NOT EXISTS public.gov_approval_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    maker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    checker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    reason TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 3. Relationship Intelligence (IP/Device Mapping)
-- Maps connections to detect coordinated abuse clusters
CREATE TABLE IF NOT EXISTS public.gov_entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address TEXT,
    device_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Extend Profiles for Trust Intelligence
-- Injects reputation and enforcement state into the user entity
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 5. Security Policies (RLS)
-- HARDENING: Only Staff (Moderators/Admins) can access governance infrastructure
ALTER TABLE public.gov_audit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_entity_relationships ENABLE ROW LEVEL SECURITY;

-- Policy: Audit Log Visibility
CREATE POLICY "Staff can view audit logs" ON public.gov_audit_ledger
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

-- Policy: Approval Queue Management
CREATE POLICY "Staff can manage approval queue" ON public.gov_approval_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

-- Policy: Relationship Mapping (Internal Only)
CREATE POLICY "Staff can view relationship data" ON public.gov_entity_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- 6. Indices for Performance
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.gov_audit_ledger(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.gov_audit_ledger(target_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON public.gov_approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_rel_ip ON public.gov_entity_relationships(ip_address);
CREATE INDEX IF NOT EXISTS idx_rel_device ON public.gov_entity_relationships(device_id);
