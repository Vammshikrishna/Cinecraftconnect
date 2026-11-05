-- PART GE (2) - per-person Mute and Pin for direct chats. Safe to run more than once.
--
-- WHAT THIS ADDS: table conversation_prefs (one row per person and chat partner: muted, pinned). Each person can only see and change their own rows.
-- The website works before this part is run: Mute and Pin are then remembered in this browser only.
--
-- PREFLIGHT (read only): select to_regclass('public.conversation_prefs');   -- null before
-- POST-CHECK  (read only): same query -> conversation_prefs; select policyname from pg_policies where tablename = 'conversation_prefs';   -- 1 row

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.conversation_prefs (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted      boolean NOT NULL DEFAULT false,
  pinned     boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS conversation_prefs_partner_idx ON public.conversation_prefs (partner_id);

ALTER TABLE public.conversation_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_prefs FROM anon;

DROP POLICY IF EXISTS "Own conversation prefs" ON public.conversation_prefs;
CREATE POLICY "Own conversation prefs" ON public.conversation_prefs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- at most 3 pinned chats per person
CREATE OR REPLACE FUNCTION public.conversation_prefs_pin_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.pinned AND (SELECT count(*) FROM public.conversation_prefs
                     WHERE user_id = NEW.user_id AND pinned AND partner_id <> NEW.partner_id) >= 3 THEN
    RAISE EXCEPTION 'You can pin up to 3 chats' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.conversation_prefs_pin_limit() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_conversation_prefs_pin_limit ON public.conversation_prefs;
CREATE TRIGGER trg_conversation_prefs_pin_limit BEFORE INSERT OR UPDATE ON public.conversation_prefs
  FOR EACH ROW EXECUTE FUNCTION public.conversation_prefs_pin_limit();

NOTIFY pgrst, 'reload schema';
