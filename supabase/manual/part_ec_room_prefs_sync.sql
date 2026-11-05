-- PART EC: per-user discussion-room notification prefs (mute room etc.) synced across devices.
-- Run once by hand in the Supabase SQL editor. Safe to re-run.
--
-- READ-ONLY PREFLIGHT (run these first, they change nothing):
--   select to_regclass('public.discussion_rooms') as rooms_table;           -- must not be null
--   select to_regclass('public.user_room_prefs')  as prefs_table;           -- null before the first run
--   select data_type from information_schema.columns
--     where table_schema='public' and table_name='discussion_rooms' and column_name='id';   -- expect uuid
--
-- Shape of prefs: {"muteRoom": bool, "mentionsOnly": bool, "soundAlerts": bool}. Unknown keys, non-boolean
-- values and anything over 256 bytes are rejected. updated_at is always set by the server (clients use it
-- for "newest write wins", so device clock skew does not matter).

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_room_prefs (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES public.discussion_rooms(id) ON DELETE CASCADE,
  prefs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- Key whitelist, boolean values, size cap.
ALTER TABLE public.user_room_prefs DROP CONSTRAINT IF EXISTS user_room_prefs_prefs_valid;
ALTER TABLE public.user_room_prefs ADD CONSTRAINT user_room_prefs_prefs_valid CHECK (
  jsonb_typeof(prefs) = 'object'
  AND octet_length(prefs::text) <= 256
  AND (prefs - 'muteRoom' - 'mentionsOnly' - 'soundAlerts') = '{}'::jsonb
  AND (NOT (prefs ? 'muteRoom')     OR jsonb_typeof(prefs->'muteRoom')     = 'boolean')
  AND (NOT (prefs ? 'mentionsOnly') OR jsonb_typeof(prefs->'mentionsOnly') = 'boolean')
  AND (NOT (prefs ? 'soundAlerts')  OR jsonb_typeof(prefs->'soundAlerts')  = 'boolean')
);

-- The server owns the timestamp.
CREATE OR REPLACE FUNCTION public.user_room_prefs_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_room_prefs_touch ON public.user_room_prefs;
CREATE TRIGGER trg_user_room_prefs_touch
  BEFORE INSERT OR UPDATE ON public.user_room_prefs
  FOR EACH ROW EXECUTE FUNCTION public.user_room_prefs_touch();

-- Lookup by room (used by push-delivery, service role) .
CREATE INDEX IF NOT EXISTS user_room_prefs_room_idx ON public.user_room_prefs (room_id);

ALTER TABLE public.user_room_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_room_prefs_select_own ON public.user_room_prefs;
DROP POLICY IF EXISTS user_room_prefs_insert_own ON public.user_room_prefs;
DROP POLICY IF EXISTS user_room_prefs_update_own ON public.user_room_prefs;
DROP POLICY IF EXISTS user_room_prefs_delete_own ON public.user_room_prefs;

CREATE POLICY user_room_prefs_select_own ON public.user_room_prefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_room_prefs_insert_own ON public.user_room_prefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_room_prefs_update_own ON public.user_room_prefs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_room_prefs_delete_own ON public.user_room_prefs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.user_room_prefs FROM PUBLIC;
REVOKE ALL ON public.user_room_prefs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_room_prefs TO authenticated;
-- service_role bypasses RLS and keeps its default privileges (needed by push-delivery).

COMMIT;
