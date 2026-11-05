-- PART DS - old verification requests with request_type 'company' (follow-up to part_dk). Safe to run more than once.
-- RUN AFTER part_dk_verification_creators_only.sql.
--
-- Why: part_dk limits verification_requests.request_type to creator | professional | public_figure and adds that check
-- as NOT VALID so old 'company' rows did not block it. A NOT VALID check still fires when such a row is updated, so a
-- later staff UPDATE (for example changing its status) would fail. This part cleans those rows and then VALIDATEs the
-- constraint, so it is fully enforced on every row.
--
-- What it does:
--   1. Converts old rows whose request_type is 'company' (any letter case / spaces) to 'professional', the closest valid
--      type. Status, dates, reviewer and every other column are kept, so the history stays. (Any other invalid value is
--      converted the same way, otherwise VALIDATE below would fail. The original type is not stored anywhere after this;
--      save the preflight result first if you need it.)
--   2. Rows of that kind that are still 'pending' or 'under_review' become 'rejected' with the rejection_reason
--      "Verification is not offered for studio accounts". reviewed_at is set; reviewed_by stays empty (no staff member
--      decided). NOTHING is notified: no notification rows are inserted and no email / push is sent.
--   3. profiles.is_verified is NOT touched. A badge that was already granted stays until staff decide to remove it
--      (use the normal revoke flow); this part does not take anything away from any account.
--   4. ALTER TABLE ... VALIDATE CONSTRAINT, so the check is enforced on all rows.
--
-- PREFLIGHT (read-only; run this SELECT alone first if you want the numbers, nothing is changed by it):
--   SELECT request_type, status, count(*)
--   FROM public.verification_requests
--   WHERE request_type IS DISTINCT FROM ALL (ARRAY['creator','professional','public_figure'])
--   GROUP BY request_type, status ORDER BY 1, 2;
-- The DO block below prints the same totals as NOTICE lines before it changes anything.

DO $$
DECLARE
  v_company int;
  v_invalid int;
  v_open    int;
BEGIN
  IF to_regclass('public.verification_requests') IS NULL THEN
    RAISE EXCEPTION 'public.verification_requests does not exist; nothing to do.';
  END IF;

  SELECT count(*) INTO v_company FROM public.verification_requests WHERE lower(btrim(request_type)) = 'company';
  SELECT count(*) INTO v_invalid FROM public.verification_requests
    WHERE request_type IS NULL OR request_type NOT IN ('creator', 'professional', 'public_figure');
  SELECT count(*) INTO v_open FROM public.verification_requests
    WHERE (request_type IS NULL OR request_type NOT IN ('creator', 'professional', 'public_figure'))
      AND status IN ('pending', 'under_review');

  RAISE NOTICE 'verification_requests preflight: company rows = %, rows with any invalid request_type = %, of those still pending/under_review = %',
    v_company, v_invalid, v_open;
END $$;

-- 1 + 2. one statement: open requests are rejected, every such row gets a valid type
UPDATE public.verification_requests
SET request_type = 'professional',
    status = CASE WHEN status IN ('pending', 'under_review') THEN 'rejected' ELSE status END,
    rejection_reason = CASE WHEN status IN ('pending', 'under_review')
                            THEN 'Verification is not offered for studio accounts'
                            ELSE rejection_reason END,
    reviewed_at = CASE WHEN status IN ('pending', 'under_review') THEN now() ELSE reviewed_at END,
    updated_at = now()
WHERE request_type IS NULL
   OR request_type NOT IN ('creator', 'professional', 'public_figure');

-- 3. profiles.is_verified is intentionally not updated here.

-- 4. fully enforce the constraint (part_dk created it NOT VALID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_requests_request_type_check'
      AND conrelid = 'public.verification_requests'::regclass
  ) THEN
    ALTER TABLE public.verification_requests VALIDATE CONSTRAINT verification_requests_request_type_check;
  ELSE
    RAISE EXCEPTION 'verification_requests_request_type_check is missing: run part_dk_verification_creators_only.sql first, then this part again.';
  END IF;
END $$;
