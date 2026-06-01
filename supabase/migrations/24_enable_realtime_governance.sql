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
