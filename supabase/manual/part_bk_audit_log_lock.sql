-- PART BK: the audit log can only be written by the database, and never changed.
--  * The policy "System can insert audit logs" (WITH CHECK true) let ANY signed-in person add rows, so anyone could forge
--    "an admin did X". Only our own functions write audit_logs now.
--  * Rows cannot be edited or deleted by signed-in people.
--  * Indexes so the Audit Log screen stays fast.
-- Run after part BJ. Safe to run twice.
BEGIN;

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_logs_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- background jobs and the service role have no signed-in person; everyone else may only add rows (through our functions)
  IF auth.uid() IS NOT NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'The audit log cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_type, target_id, created_at DESC);

COMMIT;
