-- PART DO: who may submit a pitch (findings F-03 / F-04, docs/testing/03-collaboration-business.md). Safe to re-run.
--
-- part_av's pitch_submission_insert_guard checks ownership, closed calls, blocks, daily limit and NDA, but never looks at the
-- account type, so a Fan could insert a submission through the API (the apps hide it and web redirects Fans from /pitch).
-- This adds a small separate BEFORE INSERT trigger: Fan accounts and staff / internal accounts cannot submit.
-- Creator and Studio are NOT restricted here: the "Studio needs a writer-side craft" rule is a UI hint (free-text craft),
-- not something the database can judge, so it stays in the apps (canSubmitPitch in packages/core/src/pitch.ts).
--
-- PREFLIGHT (read-only, changes nothing). Existing submissions from fans / staff (they stay; only new inserts are checked):
--   SELECT count(*) FROM public.pitch_submissions s JOIN public.profiles p ON p.id = s.submitter_id
--    WHERE p.account_type = 'fan' OR COALESCE(p.is_internal, false);
--
-- Rollback: DROP TRIGGER IF EXISTS pitch_submission_account_guard ON public.pitch_submissions;

BEGIN;

CREATE OR REPLACE FUNCTION public.pitch_submission_account_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() THEN
    RETURN NEW;  -- server-side work (migrations, service role)
  END IF;
  IF public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Staff accounts cannot submit pitches' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE((SELECT p.account_type FROM public.profiles p WHERE p.id = auth.uid()), '') = 'fan' THEN
    RAISE EXCEPTION 'Fan accounts cannot submit pitches' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pitch_submission_account_guard ON public.pitch_submissions;
CREATE TRIGGER pitch_submission_account_guard BEFORE INSERT ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pitch_submission_account_guard();

COMMIT;
