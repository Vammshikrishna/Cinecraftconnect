-- PART FW (admin 1) - fix "View record & strikes" in the Admin > User Management menu: the account record opens EMPTY because get_user_record returns
-- 400 "column p.created_at does not exist". Safe to run more than once.
--
-- WHAT WENT WRONG: get_user_record (part BJ) reads profiles.created_at, but the live profiles table has no created_at column (the sign-up date is auth.users.created_at;
-- the same mistake as part FP). So staff cannot see an account's strikes, bans, reports, appeals or staff history.
-- THE FIX: take the sign-up date from auth.users. Same function, same arguments, same permissions. (part_bj_governance_features.sql is corrected too.)
--
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'get_user_record';            -- 1 row
-- POST-CHECK  (read only): in Admin > User Management search a user, "..." > View record & strikes: the record loads with the sign-up date.

CREATE OR REPLACE FUNCTION public.get_user_record(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
                  'account_type', p.account_type, 'is_verified', p.is_verified, 'is_banned', p.is_banned,
                  'is_shadowbanned', p.is_shadowbanned, 'muted_until', p.mute_expires_at,
                  'created_at', (SELECT u.created_at FROM auth.users u WHERE u.id = p.id))
                  FROM public.profiles p WHERE p.id = p_user),
    'rank', public.staff_rank(p_user),
    'strikes', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, reason, created_at, expires_at, revoked_at, revoke_note FROM public.user_strikes
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 30) s),
    'bans', (SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, reason, ban_type, expires_at, is_active, created_at, lifted_at FROM public.user_bans
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 20) b),
    'reports_against', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, target_type, reason, status, created_at, resolution_note FROM public.content_reports c
                   WHERE (c.target_type = 'user' AND c.target_id = p_user::text)
                      OR (c.target_type = 'post' AND c.target_id IN (SELECT po.id::text FROM public.posts po WHERE po.author_id = p_user))
                      OR (c.target_type = 'comment' AND c.target_id IN (SELECT pc.id::text FROM public.post_comments pc WHERE pc.user_id = p_user))
                   ORDER BY c.created_at DESC LIMIT 30) r),
    'reports_filed', (SELECT count(*) FROM public.content_reports WHERE reported_by = p_user),
    'appeals', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb) FROM (
                  SELECT id, message, status, created_at, decided_at, decision_note FROM public.appeals
                   WHERE user_id = p_user ORDER BY created_at DESC LIMIT 10) a),
    'audit', (SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb) FROM (
                  SELECT action, actor_role, created_at, metadata FROM public.audit_logs
                   WHERE target_type = 'user' AND target_id = p_user::text ORDER BY created_at DESC LIMIT 50) l)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_record(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
