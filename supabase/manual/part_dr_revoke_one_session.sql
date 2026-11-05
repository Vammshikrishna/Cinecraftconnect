-- PART DR - revoke ONE device session (auth finding AUTH-F-10). Safe to run more than once.
--
-- PREFLIGHT (read-only, run first if you like; changes nothing):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_sessions' and column_name = 'auth_session_id';
--   select count(*) as my_auth_sessions from auth.sessions;        -- the auth.sessions table must exist
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname = 'revoke_my_session';    -- shows whether this part ran before
--
-- Why this is needed: the "Where you are logged in" list is public.user_sessions, a table of the app's own. Its id is NOT an
-- auth.sessions id; it is keyed by device_id and a SHA-256 hash of the refresh token. Supabase's admin API can only sign out
-- "others" (all of them), so one device could not be targeted. This part lets the signed-in user delete exactly one of their
-- own rows in auth.sessions (its refresh tokens are removed by the cascade, so that device can no longer refresh and is signed
-- out once its access token expires; the app's realtime monitor also signs it out at once because revoked_at is set).
--
-- Mapping used by revoke_my_session(p_session_id):
--   p_session_id is the id of the row in public.user_sessions (what the Sessions screen lists).
--   1. If the row has auth_session_id (new column, filled in by the web app from the access token's session_id claim), that is used.
--   2. Otherwise (rows created before this part) the auth session is found by matching the row's refresh_token_hash with
--      sha256(auth.refresh_tokens.token) of the caller's own sessions.
--   If neither finds an auth session, the function returns an error and changes nothing, so the user can use
--   "sign out everywhere else" instead.

-- 1. Column that links the app's row to the real auth session.
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS auth_session_id uuid;
CREATE INDEX IF NOT EXISTS idx_user_sessions_auth_session_id ON public.user_sessions (auth_session_id);

-- 2. The RPC.
CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id uuid, p_allow_current boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_sessions%ROWTYPE;
  v_target uuid;
  v_current uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required' USING ERRCODE = '22023';
  END IF;

  -- Only a row that belongs to the caller.
  SELECT * INTO v_row FROM public.user_sessions WHERE id = p_session_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  -- Resolve the real auth session (and make sure it is the caller's).
  v_target := v_row.auth_session_id;
  IF v_target IS NOT NULL THEN
    PERFORM 1 FROM auth.sessions s WHERE s.id = v_target AND s.user_id = v_uid;
    IF NOT FOUND THEN v_target := NULL; END IF;
  END IF;
  IF v_target IS NULL THEN
    SELECT s.id INTO v_target
      FROM auth.refresh_tokens rt
      JOIN auth.sessions s ON s.id = rt.session_id
     WHERE s.user_id = v_uid
       AND encode(sha256(convert_to(rt.token, 'UTF8')), 'hex') = v_row.refresh_token_hash
     LIMIT 1;
  END IF;

  IF v_target IS NULL THEN
    -- Already gone from auth (expired / signed out): just retire the app row.
    UPDATE public.user_sessions SET revoked_at = now(), is_current = false
     WHERE id = v_row.id AND revoked_at IS NULL;
    RAISE EXCEPTION 'This device is no longer signed in, or could not be matched to a login. Use "sign out everywhere else" if needed.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Refuse the caller's own current session unless explicitly allowed.
  BEGIN
    v_current := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  EXCEPTION WHEN others THEN
    v_current := NULL;
  END;
  IF v_current IS NOT NULL AND v_current = v_target AND NOT coalesce(p_allow_current, false) THEN
    RAISE EXCEPTION 'This is the session you are using now. Sign out normally instead.' USING ERRCODE = '42501';
  END IF;

  -- Delete only this session; refresh tokens cascade.
  DELETE FROM auth.sessions WHERE id = v_target AND user_id = v_uid;

  UPDATE public.user_sessions SET revoked_at = now(), is_current = false
   WHERE id = v_row.id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'revoked_session', p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_my_session(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_my_session(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(uuid, boolean) TO authenticated;
