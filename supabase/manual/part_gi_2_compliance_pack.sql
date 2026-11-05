-- PART GI-2 - compliance pack (DPDP / GDPR): a user's data bundle on request, and a tracked list of erasure requests. Safe to run more than once.
--
-- WHY: a person can ask "what do you hold about me" or "delete me". The owner team needs a controlled, recorded way to answer, and a 30-day clock.
-- WHAT IT ADDS (super admins only, two-factor sign-in required where the team has switched it on, every step is written to the audit log):
--   public.compliance_export_requests  : one row per data-export request. One super admin asks, a DIFFERENT super admin approves.
--   public.compliance_erasure_requests : one row per erasure request, with a due date 30 days after it was received.
--   compliance_overview(), compliance_request_export(), compliance_decide_export(), compliance_build_export(),
--   compliance_log_erasure(), compliance_decide_erasure()
-- WHAT THE BUNDLE HOLDS: account (email, sign-up date), profile, posts, jobs posted, job applications, reports the person filed, support tickets.
-- WHAT IT NEVER HOLDS: message content (end-to-end encrypted chats are not readable by the platform), password, encryption keys, push tokens, sessions.
-- ERASURE IS TRACK AND APPROVE ONLY: nothing here deletes a user. "Completed" is recorded by a super admin AFTER the deletion was done by hand.
--   The first super admin logs the request, a different one approves or rejects it, then "completed" can be marked.
--
-- PREFLIGHT (read only): select to_regclass('public.compliance_export_requests');      -- null before
-- POST-CHECK  (read only): Super admin > Compliance shows the two lists. As any other account the calls are refused.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.compliance_export_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user  uuid NOT NULL,                 -- no foreign key on purpose: the record must survive a later deletion
  requested_by  uuid NOT NULL,
  reason        text NOT NULL CHECK (length(btrim(reason)) >= 5),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delivered')),
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.compliance_erasure_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user  uuid,
  subject_label text,                          -- how the person was named in the request (email or username), for the record
  source        text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'email', 'legal', 'regulator', 'other')),
  received_at   timestamptz NOT NULL DEFAULT now(),
  due_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status        text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'approved', 'rejected', 'completed')),
  logged_by     uuid NOT NULL,
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_export_status ON public.compliance_export_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_erasure_status ON public.compliance_erasure_requests (status, due_at);

ALTER TABLE public.compliance_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_erasure_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compliance_export_requests FROM PUBLIC, anon, authenticated;     -- no direct access: only the functions below
REVOKE ALL ON public.compliance_erasure_requests FROM PUBLIC, anon, authenticated;

-- one gate for every function below
CREATE OR REPLACE FUNCTION public._compliance_gate()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only super admins can do this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._compliance_gate() FROM PUBLIC, anon, authenticated;

-- one section of the bundle, read in its own protected block (a differing column gives an empty section, not an error)
CREATE OR REPLACE FUNCTION public._compliance_rows(p_sql text, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j jsonb;
BEGIN
  EXECUTE 'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (' || p_sql || ') x' INTO j USING p_user;
  RETURN j;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('unavailable', true);
END;
$$;
REVOKE ALL ON FUNCTION public._compliance_rows(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compliance_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public._compliance_gate();
  RETURN jsonb_build_object(
    'me', auth.uid(),
    'exports', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id, 'subject_user', e.subject_user, 'subject_name', COALESCE(p.username, p.full_name, 'Removed account'),
        'requested_by', e.requested_by, 'reason', e.reason, 'status', e.status, 'decided_by', e.decided_by,
        'decided_at', e.decided_at, 'decision_note', e.decision_note, 'delivered_at', e.delivered_at, 'created_at', e.created_at)
        ORDER BY e.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.compliance_export_requests ORDER BY created_at DESC LIMIT 100) e
      LEFT JOIN public.profiles p ON p.id = e.subject_user),
    'erasures', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id, 'subject_user', r.subject_user, 'subject_label', COALESCE(r.subject_label, p.username, 'Unknown'), 'source', r.source,
        'received_at', r.received_at, 'due_at', r.due_at, 'status', r.status, 'logged_by', r.logged_by, 'decided_by', r.decided_by,
        'decided_at', r.decided_at, 'decision_note', r.decision_note, 'completed_at', r.completed_at,
        'days_left', CASE WHEN r.status IN ('received', 'approved') THEN ceil(extract(epoch from (r.due_at - now())) / 86400)::int ELSE NULL END)
        ORDER BY (r.status IN ('received', 'approved')) DESC, r.due_at ASC), '[]'::jsonb)
      FROM (SELECT * FROM public.compliance_erasure_requests ORDER BY created_at DESC LIMIT 200) r
      LEFT JOIN public.profiles p ON p.id = r.subject_user));
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.compliance_request_export(p_user uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._compliance_gate();
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN RAISE EXCEPTION 'That account was not found'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Please give a reason (at least 5 characters)'; END IF;
  INSERT INTO public.compliance_export_requests (subject_user, requested_by, reason) VALUES (p_user, auth.uid(), btrim(p_reason)) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'compliance_export_requested', 'user', p_user::text, jsonb_build_object('request_id', v_id, 'reason', btrim(p_reason)));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_request_export(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_request_export(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.compliance_decide_export(p_id uuid, p_approve boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_subject uuid;
BEGIN
  PERFORM public._compliance_gate();
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please give a note (at least 5 characters)'; END IF;
  UPDATE public.compliance_export_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = auth.uid(), decided_at = now(), decision_note = btrim(p_note)
   WHERE id = p_id AND status = 'pending' AND requested_by <> auth.uid()      -- two people: the asker can never approve
   RETURNING subject_user INTO v_subject;
  IF v_subject IS NULL THEN RAISE EXCEPTION 'Request not found, already decided, or asked by you (a different super admin must decide)'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', CASE WHEN p_approve THEN 'compliance_export_approved' ELSE 'compliance_export_rejected' END, 'user', v_subject::text,
          jsonb_build_object('request_id', p_id, 'note', btrim(p_note)));
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_decide_export(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_decide_export(uuid, boolean, text) TO authenticated;

-- builds the bundle for an APPROVED request (valid for 7 days after approval); every build is audit-logged
CREATE OR REPLACE FUNCTION public.compliance_build_export(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r public.compliance_export_requests%ROWTYPE;
  v_account jsonb;
  v_profile jsonb;
BEGIN
  PERFORM public._compliance_gate();
  SELECT * INTO r FROM public.compliance_export_requests WHERE id = p_id;
  IF NOT FOUND OR r.status NOT IN ('approved', 'delivered') THEN RAISE EXCEPTION 'This request is not approved'; END IF;
  IF r.decided_at < now() - interval '7 days' THEN RAISE EXCEPTION 'The approval expired (7 days). Ask again.'; END IF;

  SELECT jsonb_build_object('id', u.id, 'email', u.email, 'phone', u.phone, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
    INTO v_account FROM auth.users u WHERE u.id = r.subject_user;
  SELECT to_jsonb(p) - 'encrypted_private_key' - 'key_salt' - 'push_token' - 'sessions_revoked_at' - 'force_password_reset'
    INTO v_profile FROM public.profiles p WHERE p.id = r.subject_user;

  UPDATE public.compliance_export_requests SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()) WHERE id = p_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'compliance_export_built', 'user', r.subject_user::text, jsonb_build_object('request_id', p_id));

  RETURN jsonb_build_object(
    'generated_at', now(),
    'request_id', p_id,
    'subject_user', r.subject_user,
    'notice', 'Private chat messages are end-to-end encrypted and are not part of this bundle. Passwords, encryption keys and push tokens are never included.',
    'account', COALESCE(v_account, '{}'::jsonb),
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'posts', public._compliance_rows('select id, content, media_type, media_url, tags, created_at from public.posts where author_id = $1 order by created_at desc limit 5000', r.subject_user),
    'jobs_posted', public._compliance_rows('select id, title, company, location, type, description, is_active, created_at from public.jobs where posted_by = $1 order by created_at desc limit 5000', r.subject_user),
    'job_applications', public._compliance_rows('select id, job_id, cover_letter, resume_url, showreel_url, status, created_at from public.job_applications where applicant_id = $1 order by created_at desc limit 5000', r.subject_user),
    'reports_filed', public._compliance_rows('select id, target_type, target_id, reason, details, status, created_at from public.content_reports where reported_by = $1 order by created_at desc limit 5000', r.subject_user),
    'support_tickets', public._compliance_rows('select id, subject, message, category, priority, status, created_at from public.support_tickets where user_id = $1 order by created_at desc limit 5000', r.subject_user)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_build_export(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_build_export(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.compliance_log_erasure(p_user uuid, p_label text, p_source text, p_received timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_recv timestamptz := LEAST(COALESCE(p_received, now()), now());
BEGIN
  PERFORM public._compliance_gate();
  IF p_user IS NULL AND length(btrim(coalesce(p_label, ''))) < 3 THEN RAISE EXCEPTION 'Name the person (account or email)'; END IF;
  IF p_source NOT IN ('user', 'email', 'legal', 'regulator', 'other') THEN RAISE EXCEPTION 'Unknown source'; END IF;
  INSERT INTO public.compliance_erasure_requests (subject_user, subject_label, source, received_at, due_at, logged_by)
  VALUES (p_user, NULLIF(btrim(coalesce(p_label, '')), ''), p_source, v_recv, v_recv + interval '30 days', auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'compliance_erasure_logged', 'user', COALESCE(p_user::text, 'unknown'), jsonb_build_object('request_id', v_id, 'source', p_source));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_log_erasure(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_log_erasure(uuid, text, text, timestamptz) TO authenticated;

-- approve / reject (a DIFFERENT super admin than the one who logged it), or mark completed once the deletion was done by hand
CREATE OR REPLACE FUNCTION public.compliance_decide_erasure(p_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_subject uuid; v_found boolean;
BEGIN
  PERFORM public._compliance_gate();
  IF p_status NOT IN ('approved', 'rejected', 'completed') THEN RAISE EXCEPTION 'Choose approved, rejected or completed'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Please give a note (at least 5 characters)'; END IF;
  IF p_status = 'completed' THEN
    UPDATE public.compliance_erasure_requests SET status = 'completed', completed_at = now(), decision_note = COALESCE(decision_note || E'\n', '') || btrim(p_note)
     WHERE id = p_id AND status = 'approved' RETURNING subject_user, true INTO v_subject, v_found;
  ELSE
    UPDATE public.compliance_erasure_requests SET status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = btrim(p_note)
     WHERE id = p_id AND status = 'received' AND logged_by <> auth.uid() RETURNING subject_user, true INTO v_subject, v_found;
  END IF;
  IF v_found IS NOT TRUE THEN RAISE EXCEPTION 'Request not found, in the wrong state, or logged by you (a different super admin must decide)'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'compliance_erasure_' || p_status, 'user', COALESCE(v_subject::text, 'unknown'), jsonb_build_object('request_id', p_id, 'note', btrim(p_note)));
END;
$$;
REVOKE ALL ON FUNCTION public.compliance_decide_erasure(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compliance_decide_erasure(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
