-- part_dv_staff_console_fixes.sql
-- Staff console fixes (docs/testing/05g findings F-6 and F-14). Safe to re-run. NOT yet applied: run by hand.
--
-- READ-ONLY PREFLIGHT (run first, change nothing):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'gov_approval_queue' AND column_name = 'decision_reason';   -- 0 rows before, 1 after
--   SELECT proname FROM pg_proc WHERE proname IN ('gov_reject_action', 'staff_create_vip_invite');            -- 0 rows before, 2 after
--   SELECT count(*) FROM public.gov_approval_queue WHERE status = 'pending';                                  -- informational
--   SELECT count(*) FROM public.vip_invites WHERE NOT is_used;                                                -- informational
--
-- 1. F-6: rejecting a staged action now carries a written reason, stored with the row.
--    The existing trigger gov_queue_enforce_dual_control still stops the maker from deciding their own request.
ALTER TABLE public.gov_approval_queue ADD COLUMN IF NOT EXISTS decision_reason text;

CREATE OR REPLACE FUNCTION public.gov_reject_action(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Please give a reason of at least 5 characters';
  END IF;
  -- the dual-control trigger raises if the caller is the maker, and records checker_id
  UPDATE public.gov_approval_queue
     SET status = 'rejected', decision_reason = left(btrim(p_reason), 500)
   WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request is not waiting for a decision';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.gov_reject_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gov_reject_action(uuid, text) TO authenticated;

-- 2. F-14: the Pro-granting invite code and the role it grants are decided by the database, not the browser.
CREATE OR REPLACE FUNCTION public.staff_create_vip_invite()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  -- 12 hex characters from gen_random_uuid() (random v4 uuid: 48 bits of entropy per code, single use)
  v_code := 'VIP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.vip_invites (code, created_by, role_granted, expires_at)
  VALUES (v_code, auth.uid(), 'creator_pro', now() + interval '30 days');
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_create_vip_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_create_vip_invite() TO authenticated;

-- Optional hardening (not done here, needs a decision): the policy "Internals can manage invites" still lets any staff
-- row insert a vip_invites row directly with any role_granted. Restrict INSERT to the function above if wanted.
