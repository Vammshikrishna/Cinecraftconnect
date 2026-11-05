-- PART GI-3 - on-call rota: who is the primary and the backup on each day, and "who is on call now". Safe to run more than once.
--
-- WHY: when something breaks at night nobody knows whom to call. The owner team asked for a weekly rota and a visible "on call now".
-- WHAT IT ADDS: public.oncall_rota (one primary and one backup per day, days are UTC dates), and
--   oncall_week(p_from)  : the seven days from p_from, staff only (moderator and above)
--   oncall_now()         : today's primary and backup, staff only
--   oncall_set(day, slot, user) : admin and super admin set or clear a slot; only staff accounts can be put on the rota; every change is audit-logged
-- No contact details are stored or returned: only the staff member's display name and role.
--
-- PREFLIGHT (read only): select to_regclass('public.oncall_rota');      -- null before
-- POST-CHECK  (read only): Admin or Super admin > On call lets you fill a week; the staff header shows "On call now".

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.oncall_rota (
  day         date NOT NULL,
  slot        text NOT NULL CHECK (slot IN ('primary', 'backup')),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_by      uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, slot)
);
ALTER TABLE public.oncall_rota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oncall_rota FROM PUBLIC, anon, authenticated;     -- no direct access: only the functions below

CREATE OR REPLACE FUNCTION public.oncall_week(p_from date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'can_edit', public.staff_rank(auth.uid()) >= 2,
    'today', (now() AT TIME ZONE 'utc')::date,
    'rows', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', o.day, 'slot', o.slot, 'user_id', o.user_id,
                  'name', COALESCE(p.full_name, p.username, 'Staff member')) ORDER BY o.day, o.slot), '[]'::jsonb)
             FROM public.oncall_rota o LEFT JOIN public.profiles p ON p.id = o.user_id
             WHERE o.day >= p_from AND o.day < p_from + 7),
    'staff', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.user_id, 'name', COALESCE(p.full_name, p.username, 'Staff member'), 'rank', s.rk) ORDER BY COALESCE(p.full_name, p.username)), '[]'::jsonb)
              FROM (SELECT user_id, public.staff_rank(user_id) AS rk FROM public.user_roles GROUP BY user_id) s
              LEFT JOIN public.profiles p ON p.id = s.user_id WHERE s.rk >= 1 AND public.staff_rank(auth.uid()) >= 2));
END;
$$;
REVOKE ALL ON FUNCTION public.oncall_week(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oncall_week(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.oncall_now()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'day', (now() AT TIME ZONE 'utc')::date,
    'primary', (SELECT COALESCE(p.full_name, p.username, 'Staff member') FROM public.oncall_rota o LEFT JOIN public.profiles p ON p.id = o.user_id
                 WHERE o.day = (now() AT TIME ZONE 'utc')::date AND o.slot = 'primary'),
    'backup',  (SELECT COALESCE(p.full_name, p.username, 'Staff member') FROM public.oncall_rota o LEFT JOIN public.profiles p ON p.id = o.user_id
                 WHERE o.day = (now() AT TIME ZONE 'utc')::date AND o.slot = 'backup'));
END;
$$;
REVOKE ALL ON FUNCTION public.oncall_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oncall_now() TO authenticated;

-- p_user = NULL clears the slot
CREATE OR REPLACE FUNCTION public.oncall_set(p_day date, p_slot text, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old uuid;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins and super admins can change the rota' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_slot NOT IN ('primary', 'backup') THEN RAISE EXCEPTION 'Choose primary or backup'; END IF;
  IF p_day IS NULL OR p_day < (now() AT TIME ZONE 'utc')::date - 1 OR p_day > (now() AT TIME ZONE 'utc')::date + 120 THEN RAISE EXCEPTION 'Pick a day within the next 120 days'; END IF;
  IF p_user IS NOT NULL AND public.staff_rank(p_user) < 1 THEN RAISE EXCEPTION 'Only staff accounts can be on call'; END IF;
  SELECT user_id INTO v_old FROM public.oncall_rota WHERE day = p_day AND slot = p_slot;
  IF p_user IS NULL THEN
    DELETE FROM public.oncall_rota WHERE day = p_day AND slot = p_slot;
  ELSE
    INSERT INTO public.oncall_rota (day, slot, user_id, set_by, updated_at) VALUES (p_day, p_slot, p_user, auth.uid(), now())
    ON CONFLICT (day, slot) DO UPDATE SET user_id = EXCLUDED.user_id, set_by = auth.uid(), updated_at = now();
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' ELSE 'admin' END, 'oncall_rota_set', 'oncall_rota', p_day::text || ':' || p_slot,
          jsonb_build_object('day', p_day, 'slot', p_slot, 'from_user', v_old, 'to_user', p_user));
END;
$$;
REVOKE ALL ON FUNCTION public.oncall_set(date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oncall_set(date, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
