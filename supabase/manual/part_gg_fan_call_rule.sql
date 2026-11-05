-- PART GG - fan accounts cannot START calls. Safe to run more than once.
--
-- WHAT THIS ADDS: a trigger on calls. A signed-in person whose profile account_type is 'fan' cannot create a call (direct, project or discussion; video, audio or audio space), whichever
-- way it is created (the create_or_start_call function or a direct insert). Fans can still be rung, answer and join calls other people started: joining adds a call_participants row,
-- not a calls row. Staff and server code (no signed-in person) are not affected. Profiles with no account_type count as creators, like the website does.
-- No edge function change is needed: livekit-token only hands out a token for a call that already exists.
-- The website works before this part is run (the buttons are hidden for fans, the server just does not enforce it yet).
--
-- PREFLIGHT (read only): select tgname from pg_trigger where tgrelid = 'public.calls'::regclass and tgname = 'trg_calls_fan_cannot_start';   -- 0 rows before
-- POST-CHECK  (read only): same query -> 1 row. With a fan test account, starting a call must fail with "Calls are available on creator and studio accounts".

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.calls_fan_cannot_start()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.account_type::text = 'fan') THEN
    RAISE EXCEPTION 'Calls are available on creator and studio accounts' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.calls_fan_cannot_start() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_calls_fan_cannot_start ON public.calls;
CREATE TRIGGER trg_calls_fan_cannot_start
  BEFORE INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.calls_fan_cannot_start();

NOTIFY pgrst, 'reload schema';
