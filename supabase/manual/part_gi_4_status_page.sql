-- PART GI-4 - public status page (/status): current status and recent incidents, plus staff tools to open and update an incident. Safe to run more than once.
--
-- WHY: when something is wrong people need one place that says so. system_incidents is NOT readable by anonymous visitors (part ET revoked it on purpose,
-- the table also holds internal impact notes), so the page reads ONE narrow function instead.
-- WHAT IT ADDS:
--   public.incident_updates              : the public wording of each update (written by staff on purpose for the public)
--   public_status()                      : anyone, signed in or not. Returns overall status (operational / degraded / outage) and incidents of the last 30 days:
--                                          title, severity, status, started / resolved times and the public updates. NEVER the internal impact notes.
--   staff_list_incidents()               : staff, the same plus the internal note, for the console
--   staff_open_incident(title, severity, public_message)     : admin and super admin
--   staff_post_incident_update(id, status, public_message)   : admin and super admin; status 'resolved' also stamps resolved_at
--   Every staff change is audit-logged.
-- Overall status: outage = an open incident of severity high or critical; degraded = any other open incident; operational = none open.
--
-- PREFLIGHT (read only): select proname from pg_proc where proname = 'public_status';      -- 0 rows before
-- POST-CHECK  (read only): open /status while signed out: it shows the status and the list. select * from public.incident_updates is refused for anon.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.incident_updates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES public.system_incidents(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message      text NOT NULL CHECK (length(btrim(message)) BETWEEN 5 AND 1000),
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON public.incident_updates (incident_id, created_at DESC);
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incident_updates FROM PUBLIC, anon, authenticated;     -- no direct access: only the functions below

CREATE OR REPLACE FUNCTION public.public_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'generated_at', now(),
    'status', CASE
      WHEN EXISTS (SELECT 1 FROM public.system_incidents WHERE resolved_at IS NULL AND severity IN ('high', 'critical')) THEN 'outage'
      WHEN EXISTS (SELECT 1 FROM public.system_incidents WHERE resolved_at IS NULL) THEN 'degraded'
      ELSE 'operational' END,
    'incidents', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'severity', i.severity, 'status', i.status, 'started_at', i.started_at, 'resolved_at', i.resolved_at,
        'updates', (SELECT COALESCE(jsonb_agg(jsonb_build_object('status', u.status, 'message', u.message, 'at', u.created_at) ORDER BY u.created_at DESC), '[]'::jsonb)
                      FROM public.incident_updates u WHERE u.incident_id = i.id))
        ORDER BY i.started_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.system_incidents WHERE resolved_at IS NULL OR started_at > now() - interval '30 days' ORDER BY started_at DESC LIMIT 30) i));
$$;
REVOKE ALL ON FUNCTION public.public_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_incidents()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'title', i.title, 'severity', i.severity, 'status', i.status, 'internal_note', i.impact_description,
      'started_at', i.started_at, 'resolved_at', i.resolved_at,
      'updates', (SELECT COALESCE(jsonb_agg(jsonb_build_object('status', u.status, 'message', u.message, 'at', u.created_at) ORDER BY u.created_at DESC), '[]'::jsonb)
                    FROM public.incident_updates u WHERE u.incident_id = i.id)) ORDER BY i.started_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.system_incidents ORDER BY (resolved_at IS NULL) DESC, started_at DESC LIMIT 30) i);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_incidents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_incidents() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_open_incident(p_title text, p_severity text, p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins and super admins can open an incident' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_title, ''))) < 5 OR length(p_title) > 120 THEN RAISE EXCEPTION 'The title needs 5 to 120 characters'; END IF;
  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN RAISE EXCEPTION 'Unknown severity'; END IF;
  IF length(btrim(coalesce(p_message, ''))) < 5 THEN RAISE EXCEPTION 'Write the first public update (at least 5 characters)'; END IF;
  INSERT INTO public.system_incidents (title, severity, status, started_at) VALUES (btrim(p_title), p_severity, 'investigating', now()) RETURNING id INTO v_id;
  INSERT INTO public.incident_updates (incident_id, status, message, created_by) VALUES (v_id, 'investigating', btrim(p_message), auth.uid());
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' ELSE 'admin' END, 'incident_opened', 'system_incident', v_id::text,
          jsonb_build_object('title', btrim(p_title), 'severity', p_severity));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_open_incident(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_open_incident(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_post_incident_update(p_id uuid, p_status text, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins and super admins can update an incident' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('investigating', 'identified', 'monitoring', 'resolved') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  IF length(btrim(coalesce(p_message, ''))) < 5 THEN RAISE EXCEPTION 'Write the public update (at least 5 characters)'; END IF;
  UPDATE public.system_incidents SET status = p_status, resolved_at = CASE WHEN p_status = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;
  INSERT INTO public.incident_updates (incident_id, status, message, created_by) VALUES (p_id, p_status, btrim(p_message), auth.uid());
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE public.staff_rank(auth.uid()) WHEN 3 THEN 'super_admin' ELSE 'admin' END, 'incident_updated', 'system_incident', p_id::text,
          jsonb_build_object('status', p_status));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_post_incident_update(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_post_incident_update(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
