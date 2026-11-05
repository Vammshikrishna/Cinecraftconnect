-- PART DK - verified-badge applications: Creator accounts only (auth/account finding AUTH-F-05, AUTH-F-06).
-- Safe to run more than once. Product decision: Fan and Studio accounts have no verified badge; Creator accounts can apply.
--
-- What it does:
--   1. request_type may only be creator | professional | public_figure ('company' is gone).
--      Added NOT VALID so old rows (for example an old 'company' request) do not block this script; new and updated rows are checked.
--   2. One insert policy replaces the two older, looser ones: a user may only insert a request for himself,
--      only as a Creator (account_type creator, or empty / legacy 'talent', which the apps also treat as creator),
--      only with status 'pending', and with no reviewer / decision fields filled in.
--   3. A trigger refuses a second open (pending or under_review) request for the same user, and repeats the
--      account-type and status checks so they hold even if another insert policy is added later.
--   4. A partial unique index backs the "one open request" rule against two requests sent at the same moment
--      (skipped with a notice if old duplicate open requests exist; the trigger still protects new inserts).
-- Staff decisions go through the existing approve / reject functions and UPDATE policies, which are not changed.

-- 1. request types
ALTER TABLE public.verification_requests DROP CONSTRAINT IF EXISTS verification_requests_request_type_check;
ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_request_type_check
  CHECK (request_type = ANY (ARRAY['creator'::text, 'professional'::text, 'public_figure'::text])) NOT VALID;

-- 2. insert policy: replace both older ones
DROP POLICY IF EXISTS "Users can create own verification request" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Creators can request verification" ON public.verification_requests;
CREATE POLICY "Creators can request verification" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND COALESCE(status, 'pending') = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND verified_at IS NULL
    AND rejection_reason IS NULL
    AND COALESCE((SELECT p.account_type FROM public.profiles p WHERE p.id = auth.uid()), 'creator') IN ('creator', 'talent')
  );

-- 3. trigger: creator only, valid first status, one open request per user
CREATE OR REPLACE FUNCTION public.guard_verification_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  -- service role / SQL editor inserts (no signed-in user) are left alone
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT account_type INTO v_type FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(v_type, 'creator') NOT IN ('creator', 'talent') THEN
    RAISE EXCEPTION 'Only Creator accounts can apply for a verified badge.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.status, 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'A new verification request must start as pending.' USING ERRCODE = '42501';
  END IF;
  NEW.status := 'pending';

  IF EXISTS (
    SELECT 1 FROM public.verification_requests r
    WHERE r.user_id = NEW.user_id AND r.status IN ('pending', 'under_review')
  ) THEN
    RAISE EXCEPTION 'You already have a verification request in progress.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_verification_request_insert ON public.verification_requests;
CREATE TRIGGER guard_verification_request_insert
  BEFORE INSERT ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_request_insert();

-- 4. race-proof backstop
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_one_open_request
    ON public.verification_requests (user_id) WHERE status IN ('pending', 'under_review');
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Some users already have more than one open verification request; unique index skipped. Close the duplicates and run this part again.';
END $$;
