-- 1. user_settings: add the columns the mobile app reads/writes but the schema lacked.
--    Without them every upsert that included these keys was rejected by PostgREST, so those
--    settings never persisted server-side.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS allow_incoming_calls     text    DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS call_alert_mode          text    DEFAULT 'fullscreen',
  ADD COLUMN IF NOT EXISTS call_ringtone            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_vibration           boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_pip_enabled         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_mute_mic_on_join    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_video_off_on_join   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_data_saver          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnd_enabled              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnd_start_time           text    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS dnd_end_time             text    DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS read_receipts            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_auto_download      text    DEFAULT 'wifi',
  ADD COLUMN IF NOT EXISTS video_streaming_quality  text    DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_autoplay           text    DEFAULT 'wifi',
  ADD COLUMN IF NOT EXISTS biometric_lock           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS haptic_feedback          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_messages_from      text    DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS profile_visibility       text    DEFAULT 'public';

-- 2. Enforce "who can message me" on the server (it was only a stored preference).
CREATE OR REPLACE FUNCTION public.enforce_dm_privacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref text;
BEGIN
  -- System/service inserts and inserts made on behalf of someone else are not user-to-user DMs.
  IF auth.uid() IS NULL OR auth.uid() <> NEW.sender_id OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  IF public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  SELECT allow_messages_from INTO v_pref FROM public.user_settings WHERE user_id = NEW.receiver_id;
  IF v_pref IS NULL OR v_pref = 'everyone' THEN
    RETURN NEW;
  END IF;

  -- Existing conversation (the receiver has already written to the sender): always allowed.
  IF EXISTS (
    SELECT 1 FROM public.direct_messages
    WHERE sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id
  ) THEN
    RETURN NEW;
  END IF;

  IF v_pref = 'connections' AND EXISTS (
    SELECT 1 FROM public.user_connections
    WHERE status = 'accepted'
      AND ((follower_id = NEW.sender_id AND following_id = NEW.receiver_id)
        OR (follower_id = NEW.receiver_id AND following_id = NEW.sender_id))
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'This user is not accepting messages from you.' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS enforce_dm_privacy ON public.direct_messages;
CREATE TRIGGER enforce_dm_privacy
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dm_privacy();

-- 3. blocked_users: the mobile app inserted into this table but it never existed.
CREATE TABLE IF NOT EXISTS public.blocked_users (
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own blocks" ON public.blocked_users;
CREATE POLICY "Users manage their own blocks" ON public.blocked_users
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.blocked_users FROM anon, PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

-- Blocked users (in either direction) cannot send direct messages.
CREATE OR REPLACE FUNCTION public.enforce_dm_blocks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.sender_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (user_id = NEW.receiver_id AND blocked_user_id = NEW.sender_id)
       OR (user_id = NEW.sender_id AND blocked_user_id = NEW.receiver_id)
  ) THEN
    RAISE EXCEPTION 'You cannot message this user.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_dm_blocks ON public.direct_messages;
CREATE TRIGGER enforce_dm_blocks
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dm_blocks();
