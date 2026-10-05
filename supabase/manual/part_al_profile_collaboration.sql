-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AL – Profile: working together
--   1. hold my dates: a request for someone's dates (accept / decline / counter); accepted dates become Tentative
--      in their availability calendar
--   2. invite to project: a personal invitation to a project space (the person says yes or no)
--   3. recommendations: a connection writes a few lines about working with you; you approve before it shows
--   4. crew shortlists: private lists of people with a note each
-- Run after part AK, then deploy the new web + mobile builds.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ════════════════ 1. date holds ═══════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.date_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  role text NOT NULL CHECK (char_length(btrim(role)) BETWEEN 1 AND 80),
  rate_amount integer CHECK (rate_amount IS NULL OR rate_amount >= 0),
  rate_currency text NOT NULL DEFAULT 'INR',
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  project_title text CHECK (project_title IS NULL OR char_length(project_title) <= 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered', 'cancelled')),
  counter_rate integer CHECK (counter_rate IS NULL OR counter_rate >= 0),
  counter_note text CHECK (counter_note IS NULL OR char_length(counter_note) <= 300),
  availability_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> target_id AND end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_date_holds_target ON public.date_holds (target_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_date_holds_requester ON public.date_holds (requester_id, created_at DESC);

ALTER TABLE public.date_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS date_holds_select ON public.date_holds;
CREATE POLICY date_holds_select ON public.date_holds FOR SELECT TO authenticated USING (requester_id = auth.uid() OR target_id = auth.uid());
REVOKE ALL ON public.date_holds FROM anon, PUBLIC;
GRANT SELECT ON public.date_holds TO authenticated;
-- writes only through the functions below

-- keeps the calendar entry for an accepted hold
CREATE OR REPLACE FUNCTION public._hold_to_calendar(p_hold public.date_holds)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text;
  v_id uuid;
BEGIN
  SELECT COALESCE(full_name, username, 'someone') INTO v_name FROM public.profiles WHERE id = p_hold.requester_id;
  INSERT INTO public.user_availability (user_id, start_date, end_date, status, notes)
  VALUES (p_hold.target_id, p_hold.start_date, p_hold.end_date, 'tentative',
          left('Hold: ' || p_hold.role || ' for ' || v_name || COALESCE(' (' || p_hold.project_title || ')', ''), 200))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public._hold_to_calendar(public.date_holds) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_date_hold(
  p_target uuid, p_start date, p_end date, p_role text,
  p_rate integer DEFAULT NULL, p_currency text DEFAULT 'INR', p_note text DEFAULT NULL, p_project_title text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_name text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF p_target IS NULL OR p_target = v_me THEN
    RAISE EXCEPTION 'Invalid request' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE((SELECT account_type FROM public.profiles WHERE id = v_me), 'fan') = 'fan'
     OR COALESCE((SELECT account_type FROM public.profiles WHERE id = p_target), 'fan') = 'fan' THEN
    RAISE EXCEPTION 'Date requests are between creators and studios' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id = p_target) OR (b.user_id = p_target AND b.blocked_user_id = v_me)) THEN
    RAISE EXCEPTION 'You cannot send this request' USING ERRCODE = 'P0001';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start < current_date OR p_end < p_start OR p_end - p_start > 90 THEN
    RAISE EXCEPTION 'Choose dates from today onwards, up to 90 days long' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(COALESCE(p_role, ''))) < 1 THEN
    RAISE EXCEPTION 'Say which role you need' USING ERRCODE = 'P0001';
  END IF;
  IF p_rate IS NOT NULL AND p_rate < 0 THEN
    RAISE EXCEPTION 'The rate cannot be negative' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.date_holds WHERE requester_id = v_me AND target_id = p_target AND status IN ('pending', 'countered')
              AND start_date <= p_end AND end_date >= p_start) THEN
    RAISE EXCEPTION 'You already have a request open for these dates' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.date_holds WHERE requester_id = v_me AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'You have sent a lot of date requests today. Please try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.date_holds (requester_id, target_id, start_date, end_date, role, rate_amount, rate_currency, note, project_title)
  VALUES (v_me, p_target, p_start, p_end, left(btrim(p_role), 80), p_rate, left(upper(COALESCE(NULLIF(btrim(p_currency), ''), 'INR')), 3),
          left(NULLIF(btrim(COALESCE(p_note, '')), ''), 500), left(NULLIF(btrim(COALESCE(p_project_title, '')), ''), 120))
  RETURNING id INTO v_id;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_target, v_me, 'date_hold_request', 'Date request',
          v_name || ' wants to hold ' || to_char(p_start, 'DD Mon') || CASE WHEN p_end <> p_start THEN ' - ' || to_char(p_end, 'DD Mon') ELSE '' END || ' for ' || left(btrim(p_role), 60),
          '/network', v_id, false);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.request_date_hold(uuid, date, date, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_date_hold(uuid, date, date, text, integer, text, text, text) TO authenticated;

-- the person asked: accept / decline / counter
CREATE OR REPLACE FUNCTION public.respond_date_hold(p_id uuid, p_action text, p_rate integer DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  h public.date_holds%ROWTYPE;
  v_name text;
  v_cal uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO h FROM public.date_holds WHERE id = p_id AND target_id = v_me AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;

  IF p_action = 'accept' THEN
    v_cal := public._hold_to_calendar(h);
    UPDATE public.date_holds SET status = 'accepted', responded_at = now(), availability_id = v_cal WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.requester_id, v_me, 'date_hold_accepted', 'Dates held', v_name || ' accepted your date request', '/profile/' || v_me::text, p_id, false);
  ELSIF p_action = 'decline' THEN
    UPDATE public.date_holds SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.requester_id, v_me, 'date_hold_declined', 'Date request', v_name || ' cannot take these dates', '/network', p_id, false);
  ELSIF p_action = 'counter' THEN
    IF p_rate IS NULL AND NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Add a rate or a note for your counter offer' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.date_holds SET status = 'countered', responded_at = now(), counter_rate = p_rate,
           counter_note = left(NULLIF(btrim(COALESCE(p_note, '')), ''), 300) WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.requester_id, v_me, 'date_hold_countered', 'Counter offer', v_name || ' sent a counter offer for your dates', '/network', p_id, false);
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_date_hold(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_date_hold(uuid, text, integer, text) TO authenticated;

-- the requester answers a counter offer
CREATE OR REPLACE FUNCTION public.respond_hold_counter(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  h public.date_holds%ROWTYPE;
  v_name text;
  v_cal uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO h FROM public.date_holds WHERE id = p_id AND requester_id = v_me AND status = 'countered' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  IF COALESCE(p_accept, false) THEN
    v_cal := public._hold_to_calendar(h);
    UPDATE public.date_holds SET status = 'accepted', responded_at = now(), availability_id = v_cal,
           rate_amount = COALESCE(counter_rate, rate_amount) WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.target_id, v_me, 'date_hold_accepted', 'Dates held', v_name || ' accepted your counter offer', '/network', p_id, false);
  ELSE
    UPDATE public.date_holds SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.target_id, v_me, 'date_hold_declined', 'Date request', v_name || ' declined your counter offer', '/network', p_id, false);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_hold_counter(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_hold_counter(uuid, boolean) TO authenticated;

-- the requester withdraws (an accepted hold also frees the calendar days)
CREATE OR REPLACE FUNCTION public.cancel_date_hold(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  h public.date_holds%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO h FROM public.date_holds WHERE id = p_id AND requester_id = v_me AND status IN ('pending', 'countered', 'accepted') FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  IF h.availability_id IS NOT NULL THEN
    DELETE FROM public.user_availability WHERE id = h.availability_id;
  END IF;
  UPDATE public.date_holds SET status = 'cancelled', responded_at = now(), availability_id = NULL WHERE id = p_id;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (h.target_id, v_me, 'date_hold_cancelled', 'Date request withdrawn', v_name || ' withdrew a date request', '/network', p_id, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_date_hold(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_date_hold(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_date_holds()
RETURNS TABLE (
  id uuid, direction text, status text, start_date date, end_date date, role text, rate_amount integer, rate_currency text,
  note text, project_title text, counter_rate integer, counter_note text, created_at timestamptz,
  other_id uuid, other_name text, other_avatar text, other_craft text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT h.id, CASE WHEN h.target_id = auth.uid() THEN 'incoming' ELSE 'outgoing' END, h.status, h.start_date, h.end_date, h.role,
         h.rate_amount, h.rate_currency, h.note, h.project_title, h.counter_rate, h.counter_note, h.created_at,
         o.id, COALESCE(o.full_name, o.username), o.avatar_url, o.craft
    FROM public.date_holds h
    JOIN public.profiles o ON o.id = CASE WHEN h.target_id = auth.uid() THEN h.requester_id ELSE h.target_id END
   WHERE (h.target_id = auth.uid() OR h.requester_id = auth.uid())
     AND (h.status IN ('pending', 'countered') OR (h.status = 'accepted' AND h.end_date >= current_date) OR h.created_at > now() - interval '30 days')
   ORDER BY (h.status IN ('pending', 'countered')) DESC, h.created_at DESC
   LIMIT 60;
$$;
REVOKE ALL ON FUNCTION public.list_date_holds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_date_holds() TO authenticated;

-- ════════════════ 2. invite to project ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_person_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crew_role text CHECK (crew_role IS NULL OR char_length(crew_role) <= 80),
  message text CHECK (message IS NULL OR char_length(message) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (inviter_id <> invitee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS project_person_invites_pending ON public.project_person_invites (project_space_id, invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS project_person_invites_invitee ON public.project_person_invites (invitee_id, status);
ALTER TABLE public.project_person_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_person_invites_select ON public.project_person_invites;
CREATE POLICY project_person_invites_select ON public.project_person_invites FOR SELECT TO authenticated USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
REVOKE ALL ON public.project_person_invites FROM anon, PUBLIC;
GRANT SELECT ON public.project_person_invites TO authenticated;

-- project spaces I can invite people to (I created it, or I am an owner / admin / manager of it)
CREATE OR REPLACE FUNCTION public.my_invitable_projects()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.id, s.name FROM public.project_spaces s
   WHERE s.creator_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.project_space_members m
                  WHERE m.project_space_id = s.id AND m.user_id = auth.uid() AND lower(COALESCE(m.role, '')) IN ('owner', 'admin', 'manager', 'creator'))
   ORDER BY s.last_activity_at DESC NULLS LAST, s.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.my_invitable_projects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invitable_projects() TO authenticated;

CREATE OR REPLACE FUNCTION public.invite_to_project(p_space uuid, p_invitee uuid, p_crew_role text DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_space_name text;
  v_name text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF p_invitee IS NULL OR p_invitee = v_me THEN
    RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_space_name FROM public.my_invitable_projects() WHERE id = p_space;
  IF v_space_name IS NULL THEN
    RAISE EXCEPTION 'You cannot invite people to this project' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE((SELECT account_type FROM public.profiles WHERE id = p_invitee), 'fan') = 'fan' THEN
    RAISE EXCEPTION 'Only creators and studios can be invited to a project' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = p_space AND user_id = p_invitee)
     OR EXISTS (SELECT 1 FROM public.project_spaces WHERE id = p_space AND creator_id = p_invitee) THEN
    RAISE EXCEPTION 'They are already in this project' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users b
              WHERE (b.user_id = v_me AND b.blocked_user_id = p_invitee) OR (b.user_id = p_invitee AND b.blocked_user_id = v_me)) THEN
    RAISE EXCEPTION 'You cannot invite this person' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.project_person_invites WHERE inviter_id = v_me AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'You have sent a lot of invitations today. Please try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO public.project_person_invites (project_space_id, inviter_id, invitee_id, crew_role, message)
    VALUES (p_space, v_me, p_invitee, left(NULLIF(btrim(COALESCE(p_crew_role, '')), ''), 80), left(NULLIF(btrim(COALESCE(p_message, '')), ''), 300))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'They already have an invitation to this project' USING ERRCODE = 'P0001';
  END;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_invitee, v_me, 'project_invitation', 'Project invitation',
          v_name || ' invited you to ' || v_space_name || COALESCE(' as ' || NULLIF(btrim(COALESCE(p_crew_role, '')), ''), ''), '/network', v_id, false);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.invite_to_project(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_to_project(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_project_invite(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  i public.project_person_invites%ROWTYPE;
  v_name text;
  v_space_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO i FROM public.project_person_invites WHERE id = p_id AND invitee_id = v_me AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_space_name FROM public.project_spaces WHERE id = i.project_space_id;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;

  IF COALESCE(p_accept, false) THEN
    INSERT INTO public.project_space_members (project_space_id, user_id, role)
    SELECT i.project_space_id, v_me, 'member'
     WHERE NOT EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = i.project_space_id AND user_id = v_me);
    UPDATE public.project_person_invites SET status = 'accepted', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (i.inviter_id, v_me, 'project_invitation_accepted', 'Invitation accepted', v_name || ' joined ' || COALESCE(v_space_name, 'your project'), '/projects/' || i.project_space_id::text, p_id, false);
  ELSE
    UPDATE public.project_person_invites SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (i.inviter_id, v_me, 'project_invitation_declined', 'Invitation', v_name || ' cannot join ' || COALESCE(v_space_name, 'your project') || ' right now', '/network', p_id, false);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_project_invite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_project_invite(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_project_invites()
RETURNS TABLE (
  id uuid, direction text, status text, project_space_id uuid, project_name text, crew_role text, message text, created_at timestamptz,
  other_id uuid, other_name text, other_avatar text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.id, CASE WHEN i.invitee_id = auth.uid() THEN 'incoming' ELSE 'outgoing' END, i.status, i.project_space_id, s.name,
         i.crew_role, i.message, i.created_at, o.id, COALESCE(o.full_name, o.username), o.avatar_url
    FROM public.project_person_invites i
    JOIN public.project_spaces s ON s.id = i.project_space_id
    JOIN public.profiles o ON o.id = CASE WHEN i.invitee_id = auth.uid() THEN i.inviter_id ELSE i.invitee_id END
   WHERE (i.invitee_id = auth.uid() AND i.status = 'pending')
      OR (i.inviter_id = auth.uid() AND i.created_at > now() - interval '30 days')
   ORDER BY i.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.list_project_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_invites() TO authenticated;

-- ════════════════ 3. recommendations ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profile_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('worked_with', 'managed', 'hired', 'mentored')),
  project_title text CHECK (project_title IS NULL OR char_length(project_title) <= 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, subject_id),
  CHECK (author_id <> subject_id)
);
CREATE INDEX IF NOT EXISTS idx_profile_recommendations_subject ON public.profile_recommendations (subject_id, status, created_at DESC);
ALTER TABLE public.profile_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_recommendations_select ON public.profile_recommendations;
DROP POLICY IF EXISTS profile_recommendations_delete ON public.profile_recommendations;
CREATE POLICY profile_recommendations_select ON public.profile_recommendations FOR SELECT
  USING (author_id = auth.uid() OR subject_id = auth.uid() OR (status = 'approved' AND public.can_view_profile_extras(subject_id)));
CREATE POLICY profile_recommendations_delete ON public.profile_recommendations FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR subject_id = auth.uid());
REVOKE ALL ON public.profile_recommendations FROM PUBLIC;
GRANT SELECT ON public.profile_recommendations TO anon, authenticated;
GRANT DELETE ON public.profile_recommendations TO authenticated;
-- writes only through write_recommendation / respond_recommendation

CREATE OR REPLACE FUNCTION public.write_recommendation(p_subject uuid, p_relationship text, p_body text, p_project_title text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_body text := btrim(COALESCE(p_body, ''));
  v_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  IF p_subject IS NULL OR p_subject = v_me THEN
    RAISE EXCEPTION 'You cannot recommend yourself' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_connections WHERE status = 'accepted'
                  AND ((follower_id = v_me AND following_id = p_subject) OR (follower_id = p_subject AND following_id = v_me))) THEN
    RAISE EXCEPTION 'You can only recommend your connections' USING ERRCODE = 'P0001';
  END IF;
  IF p_relationship NOT IN ('worked_with', 'managed', 'hired', 'mentored') THEN
    RAISE EXCEPTION 'Choose how you know them' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_body) < 20 OR char_length(v_body) > 600 THEN
    RAISE EXCEPTION 'A recommendation is 20 to 600 characters' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.profile_recommendations WHERE author_id = v_me AND updated_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You have written a lot of recommendations today. Please try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profile_recommendations (author_id, subject_id, relationship, project_title, body)
  VALUES (v_me, p_subject, p_relationship, left(NULLIF(btrim(COALESCE(p_project_title, '')), ''), 120), v_body)
  ON CONFLICT (author_id, subject_id) DO UPDATE
    SET relationship = EXCLUDED.relationship, project_title = EXCLUDED.project_title, body = EXCLUDED.body,
        status = 'pending', updated_at = now();   -- an edited recommendation needs approval again

  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
  VALUES (p_subject, v_me, 'recommendation', 'New recommendation', v_name || ' wrote you a recommendation. Approve it to show it on your profile.', '/profile?tab=recommendations', NULL, false);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.write_recommendation(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_recommendation(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_recommendation(p_id uuid, p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.profile_recommendations
     SET status = CASE WHEN COALESCE(p_approve, false) THEN 'approved' ELSE 'declined' END, updated_at = now()
   WHERE id = p_id AND subject_id = auth.uid() AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Recommendation not found' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_recommendation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_recommendation(uuid, boolean) TO authenticated;

-- recommendations for one profile with the author's name (approved ones, plus pending ones for the person themself)
CREATE OR REPLACE FUNCTION public.list_recommendations(p_subject uuid)
RETURNS TABLE (
  id uuid, status text, relationship text, project_title text, body text, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_craft text, is_mine boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.status, r.relationship, r.project_title, r.body, r.created_at,
         a.id, COALESCE(a.full_name, a.username), a.avatar_url, a.craft, (r.author_id = auth.uid())
    FROM public.profile_recommendations r
    JOIN public.profiles a ON a.id = r.author_id
   WHERE r.subject_id = p_subject
     AND COALESCE(a.is_banned, false) = false
     AND (r.author_id = auth.uid()
          OR (r.status = 'approved' AND public.can_view_profile_extras(p_subject))
          OR (r.subject_id = auth.uid() AND r.status IN ('pending', 'approved')))
   ORDER BY (r.status = 'pending') DESC, r.created_at DESC
   LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.list_recommendations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recommendations(uuid) TO anon, authenticated;

-- ════════════════ 4. crew shortlists ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crew_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crew_shortlists_owner ON public.crew_shortlists (owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.crew_shortlist_members (
  shortlist_id uuid NOT NULL REFERENCES public.crew_shortlists(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shortlist_id, person_id)
);
ALTER TABLE public.crew_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_shortlist_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crew_shortlists_own ON public.crew_shortlists;
DROP POLICY IF EXISTS crew_shortlist_members_own ON public.crew_shortlist_members;
CREATE POLICY crew_shortlists_own ON public.crew_shortlists FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY crew_shortlist_members_own ON public.crew_shortlist_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crew_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crew_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()));
REVOKE ALL ON public.crew_shortlists, public.crew_shortlist_members FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_shortlists, public.crew_shortlist_members TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_crew_shortlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'crew_shortlists' THEN
    NEW.name := btrim(NEW.name);
    IF TG_OP = 'INSERT' THEN
      IF (SELECT count(*) FROM public.crew_shortlists WHERE owner_id = NEW.owner_id) >= 30 THEN
        RAISE EXCEPTION 'You can have up to 30 shortlists' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      NEW.owner_id := OLD.owner_id;
      NEW.updated_at := now();
    END IF;
  ELSE
    IF NEW.person_id = (SELECT owner_id FROM public.crew_shortlists WHERE id = NEW.shortlist_id) THEN
      RAISE EXCEPTION 'You cannot add yourself' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.crew_shortlist_members WHERE shortlist_id = NEW.shortlist_id) >= 100 THEN
      RAISE EXCEPTION 'A shortlist can hold up to 100 people' USING ERRCODE = 'P0001';
    END IF;
    NEW.note := left(NULLIF(btrim(COALESCE(NEW.note, '')), ''), 300);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_crew_shortlists ON public.crew_shortlists;
CREATE TRIGGER trg_guard_crew_shortlists BEFORE INSERT OR UPDATE ON public.crew_shortlists FOR EACH ROW EXECUTE FUNCTION public.guard_crew_shortlist();
DROP TRIGGER IF EXISTS trg_guard_crew_shortlist_members ON public.crew_shortlist_members;
CREATE TRIGGER trg_guard_crew_shortlist_members BEFORE INSERT OR UPDATE ON public.crew_shortlist_members FOR EACH ROW EXECUTE FUNCTION public.guard_crew_shortlist();

-- all my shortlists with their people (profile bits + current availability as I may see it)
CREATE OR REPLACE FUNCTION public.my_shortlists()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name,
           'members', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id', p.id, 'full_name', COALESCE(p.full_name, p.username), 'avatar_url', p.avatar_url, 'craft', p.craft,
                      'location', p.location, 'note', m.note,
                      'availability', CASE WHEN av.user_id IS NOT NULL AND public.can_see_availability(av.user_id, av.visibility)
                                           THEN public.effective_availability_status(av.user_id, av.status, av.booked_until) ELSE NULL END)
                    ORDER BY m.added_at DESC)
               FROM public.crew_shortlist_members m
               JOIN public.profiles p ON p.id = m.person_id AND COALESCE(p.is_banned, false) = false
               LEFT JOIN public.profile_availability av ON av.user_id = p.id
              WHERE m.shortlist_id = s.id), '[]'::jsonb)
         ) ORDER BY s.updated_at DESC), '[]'::jsonb)
    FROM public.crew_shortlists s WHERE s.owner_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_shortlists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_shortlists() TO authenticated;

COMMIT;
