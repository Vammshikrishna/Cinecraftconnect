-- Migration: 51_update_gov_audit_ledger_schema.sql
-- Purpose: Align gov_audit_ledger schema with GovernanceService.ts attributes & fix RLS write permissions

-- 1. Add before_state, after_state and scope columns to gov_audit_ledger if they don't exist
ALTER TABLE public.gov_audit_ledger 
ADD COLUMN IF NOT EXISTS before_state JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS after_state JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS scope JSONB DEFAULT '{"global": true}'::jsonb;

-- 2. Drop existing policies to prevent naming conflicts
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.gov_audit_ledger;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.gov_audit_ledger;
DROP POLICY IF EXISTS "Staff can manage approval queue" ON public.gov_approval_queue;
DROP POLICY IF EXISTS "Staff can view relationship data" ON public.gov_entity_relationships;

-- 3. Create the corrected RLS policies using public.user_roles (enabling both read & write for authorized staff)
CREATE POLICY "Staff can view audit logs" ON public.gov_audit_ledger
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can insert audit logs" ON public.gov_audit_ledger
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can manage approval queue" ON public.gov_approval_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can view relationship data" ON public.gov_entity_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );
