-- Private profile data must not live in the publicly readable `profiles` table.
--
--  * phone               -> moved to profile_private (owner + staff read only)
--  * push_token          -> legacy fallback; user_push_tokens (owner-only RLS) is the source of truth
--  * encrypted_private_key -> unused on profiles (backups live in key_backups)
--
-- Deploy the matching app/edge-function changes before or together with this migration.

CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read own private profile" ON public.profile_private;
CREATE POLICY "Owner can read own private profile" ON public.profile_private
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_current_user_internal());

DROP POLICY IF EXISTS "Owner can insert own private profile" ON public.profile_private;
CREATE POLICY "Owner can insert own private profile" ON public.profile_private
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update own private profile" ON public.profile_private;
CREATE POLICY "Owner can update own private profile" ON public.profile_private
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.profile_private FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

-- Preserve existing data.
INSERT INTO public.profile_private (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL AND phone <> ''
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone;

INSERT INTO public.user_push_tokens (user_id, token, platform)
SELECT id, push_token, 'android' FROM public.profiles
WHERE push_token IS NOT NULL AND push_token <> ''
ON CONFLICT (user_id, token) DO NOTHING;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS push_token,
  DROP COLUMN IF EXISTS encrypted_private_key;
