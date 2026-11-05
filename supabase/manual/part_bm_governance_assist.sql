-- PART BM: governance made easier.
--   * Evidence snapshot: a copy of what was reported is saved with the report, so it can still be judged after the
--     content is edited or deleted.
--   * Automation rules (admins set them): raise priority, or hide a post / comment until staff look, when a report
--     matches. A first rule hides a post or comment that gets 5 reports. Hidden content comes back if the report is
--     dismissed.
--   * Smart assignment: new reports go to a moderator who is on duty and has the fewest open cases.
--   * Reporter reliability: people whose reports are usually upheld are bumped up; people whose reports are nearly
--     always dismissed are not.
--   * The reporter is told the outcome; the person acted on gets a notice that says which rule and which item.
--   * Action bundles (one click = action + wording + optional warning), suggested action from past decisions,
--     one search box for staff, and a "my day" summary.
-- Run after part BL. Safe to run twice.
BEGIN;

-- ── evidence snapshot ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS evidence jsonb;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS auto_actions text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION public._report_snapshot(p_type text, p_target text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v jsonb;
  v_id uuid;
BEGIN
  v_id := p_target::uuid;
  IF p_type = 'post' THEN
    SELECT to_jsonb(p) INTO v FROM public.posts p WHERE p.id = v_id;
  ELSIF p_type = 'comment' THEN
    SELECT to_jsonb(c) INTO v FROM public.post_comments c WHERE c.id = v_id;
  ELSIF p_type = 'user' THEN
    SELECT jsonb_build_object('id', u.id, 'username', u.username, 'full_name', u.full_name, 'bio', u.bio, 'avatar_url', u.avatar_url)
      INTO v FROM public.profiles u WHERE u.id = v_id;
  ELSIF p_type = 'job' THEN
    SELECT to_jsonb(j) INTO v FROM public.jobs j WHERE j.id = v_id;
  ELSIF p_type = 'listing' THEN
    SELECT to_jsonb(l) INTO v FROM public.marketplace_listings l WHERE l.id = v_id;
  ELSIF p_type = 'room' THEN
    SELECT jsonb_build_object('id', r.id, 'title', r.title, 'description', r.description, 'tags', r.tags) INTO v FROM public.discussion_rooms r WHERE r.id = v_id;
  END IF;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._report_snapshot(text, text) FROM PUBLIC, anon, authenticated;

-- who made the reported thing (same rules as the report actions)
CREATE OR REPLACE FUNCTION public._report_target_author(p_type text, p_target text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := p_target::uuid;
  RETURN CASE p_type
    WHEN 'user'    THEN v_id
    WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_id)
    WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_id)
    WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_id)
    WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_id)
    WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_id)
    ELSE NULL END;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._report_target_author(text, text) FROM PUBLIC, anon, authenticated;

-- ── automation rules ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gov_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_rules_name ON public.gov_rules (name);
ALTER TABLE public.gov_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gov_rules_read ON public.gov_rules;
CREATE POLICY gov_rules_read ON public.gov_rules FOR SELECT USING (public.staff_rank(auth.uid()) >= 1);
DROP POLICY IF EXISTS gov_rules_write ON public.gov_rules;
CREATE POLICY gov_rules_write ON public.gov_rules FOR ALL
  USING (public.staff_rank(auth.uid()) >= 2) WITH CHECK (public.staff_rank(auth.uid()) >= 2);

-- conditions: target_types[], reasons[], min_reports (open reports on the same thing, this one included),
--             author_max_age_days, contains[] (words in the reported text), has_link (true/false)
-- actions:    set_priority ('low'..'urgent'), auto_hide (true)
INSERT INTO public.gov_rules (name, conditions, actions) VALUES
  ('Hide at 5 reports', '{"target_types":["post","comment"],"min_reports":5}', '{"auto_hide":true,"set_priority":"high"}'),
  ('New account with a link', '{"target_types":["post","comment"],"author_max_age_days":7,"has_link":true}', '{"set_priority":"high"}')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public._apply_rules(
  p_type text, p_reason text, p_open integer, p_evidence jsonb, p_author uuid,
  OUT o_priority text, OUT o_hide boolean, OUT o_names text[]
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r record;
  v_text text := lower(COALESCE(p_evidence ->> 'content', '') || ' ' || COALESCE(p_evidence ->> 'title', '') || ' '
                       || COALESCE(p_evidence ->> 'description', '') || ' ' || COALESCE(p_evidence ->> 'bio', ''));
  v_age integer;
  v_ok boolean;
  w text;
BEGIN
  o_priority := NULL; o_hide := false; o_names := ARRAY[]::text[];
  SELECT GREATEST(0, (extract(epoch FROM (now() - created_at)) / 86400)::int) INTO v_age FROM public.profiles WHERE id = p_author;
  FOR r IN SELECT * FROM public.gov_rules WHERE enabled ORDER BY created_at LOOP
    v_ok := true;
    IF r.conditions ? 'target_types' AND NOT (p_type = ANY (ARRAY(SELECT jsonb_array_elements_text(r.conditions -> 'target_types')))) THEN v_ok := false; END IF;
    IF v_ok AND r.conditions ? 'reasons' AND NOT (p_reason = ANY (ARRAY(SELECT jsonb_array_elements_text(r.conditions -> 'reasons')))) THEN v_ok := false; END IF;
    IF v_ok AND r.conditions ? 'min_reports' AND p_open < (r.conditions ->> 'min_reports')::int THEN v_ok := false; END IF;
    IF v_ok AND r.conditions ? 'author_max_age_days' AND (v_age IS NULL OR v_age > (r.conditions ->> 'author_max_age_days')::int) THEN v_ok := false; END IF;
    IF v_ok AND r.conditions ? 'has_link' AND ((v_text ~ 'https?://|www\.') IS DISTINCT FROM (r.conditions ->> 'has_link')::boolean) THEN v_ok := false; END IF;
    IF v_ok AND r.conditions ? 'contains' THEN
      v_ok := false;
      FOR w IN SELECT lower(jsonb_array_elements_text(r.conditions -> 'contains')) LOOP
        IF w <> '' AND position(w IN v_text) > 0 THEN v_ok := true; EXIT; END IF;
      END LOOP;
    END IF;
    IF v_ok THEN
      o_names := o_names || r.name;
      IF r.actions ? 'set_priority' AND public.report_priority_rank(r.actions ->> 'set_priority') > public.report_priority_rank(COALESCE(o_priority, 'low')) THEN
        o_priority := r.actions ->> 'set_priority';
      END IF;
      IF COALESCE((r.actions ->> 'auto_hide')::boolean, false) THEN o_hide := true; END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._apply_rules(text, text, integer, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ── before a report is saved: snapshot, reporter reliability, repeats, rules, deadline ───────────
CREATE OR REPLACE FUNCTION public.report_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open integer;
  v_up integer;
  v_dis integer;
  v_rule record;
  v_author uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      NEW.due_at := LEAST(COALESCE(OLD.due_at, 'infinity'::timestamptz), now() + public.report_due_interval(NEW.priority));
    END IF;
    RETURN NEW;
  END IF;

  NEW.evidence := public._report_snapshot(NEW.target_type, NEW.target_id);
  v_author := public._report_target_author(NEW.target_type, NEW.target_id);

  -- how often this reporter's earlier reports were upheld
  SELECT count(*) FILTER (WHERE status = 'resolved')::int, count(*) FILTER (WHERE status = 'dismissed')::int
    INTO v_up, v_dis FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
  IF v_up + v_dis >= 5 AND v_up::numeric / (v_up + v_dis) >= 0.8 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := CASE WHEN NEW.priority = 'low' THEN 'medium' ELSE 'high' END;
    NEW.auto_actions := NEW.auto_actions || 'trusted_reporter';
  ELSIF v_dis >= 8 AND v_up::numeric / GREATEST(v_up + v_dis, 1) <= 0.1 THEN
    NEW.priority := 'low';
    NEW.auto_actions := NEW.auto_actions || 'low_reliability';
  END IF;

  -- other people already reported the same thing
  SELECT count(*)::int + 1 INTO v_open FROM public.content_reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND status IN ('pending', 'reviewing');
  IF v_open >= 5 AND public.report_priority_rank(NEW.priority) < 4 THEN
    NEW.priority := 'urgent';
  ELSIF v_open >= 3 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := 'high';
  END IF;

  -- the admin-set rules
  SELECT * INTO v_rule FROM public._apply_rules(NEW.target_type, NEW.reason, v_open, NEW.evidence, v_author);
  IF v_rule.o_priority IS NOT NULL AND public.report_priority_rank(v_rule.o_priority) > public.report_priority_rank(NEW.priority) THEN
    NEW.priority := v_rule.o_priority;
  END IF;
  IF v_rule.o_hide THEN NEW.auto_actions := NEW.auto_actions || 'hide'; END IF;
  IF array_length(v_rule.o_names, 1) > 0 THEN NEW.auto_actions := NEW.auto_actions || ('rule:' || array_to_string(v_rule.o_names, ', ')); END IF;

  NEW.due_at := now() + public.report_due_interval(NEW.priority);
  RETURN NEW;
END;
$$;

-- ── hiding and showing again ────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS auto_hidden_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS auto_hidden_prev_audience text;

-- while a post is hidden for review its author cannot just make it public again
CREATE OR REPLACE FUNCTION public.guard_post_review_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;
  IF OLD.auto_hidden_at IS NOT NULL AND (NEW.audience IS DISTINCT FROM OLD.audience OR NEW.auto_hidden_at IS DISTINCT FROM OLD.auto_hidden_at) THEN
    RAISE EXCEPTION 'This post is hidden while a report is reviewed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_post_review_hold ON public.posts;
CREATE TRIGGER trg_guard_post_review_hold BEFORE UPDATE OF audience, auto_hidden_at ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_review_hold();

CREATE OR REPLACE FUNCTION public._auto_hide_target(p_type text, p_target text, p_report uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid := public._report_target_author(p_type, p_target);
  v_done boolean := false;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF p_type = 'post' THEN
    UPDATE public.posts SET auto_hidden_prev_audience = audience, audience = 'private', auto_hidden_at = now()
     WHERE id = p_target::uuid AND auto_hidden_at IS NULL AND audience <> 'private';
    v_done := FOUND;
  ELSIF p_type = 'comment' THEN
    UPDATE public.post_comments SET is_hidden = true WHERE id = p_target::uuid AND NOT is_hidden;
    v_done := FOUND;
  END IF;
  IF v_done THEN
    IF v_author IS NOT NULL THEN
      PERFORM public.send_governance_notification(v_author, 'governance',
        'One of your ' || p_type || 's is hidden from others while we review a report. You will be told the result.');
    END IF;
    INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
    VALUES (NULL, 'system', 'auto_hide', p_type, p_target, jsonb_build_object('report_id', p_report));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._auto_hide_target(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._auto_show_target(p_type text, p_target text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  IF p_type = 'post' THEN
    UPDATE public.posts SET audience = COALESCE(auto_hidden_prev_audience, 'public'), auto_hidden_at = NULL, auto_hidden_prev_audience = NULL
     WHERE id = p_target::uuid AND auto_hidden_at IS NOT NULL;
  ELSIF p_type = 'comment' THEN
    UPDATE public.post_comments SET is_hidden = false WHERE id = p_target::uuid AND is_hidden
       AND EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.action = 'auto_hide' AND a.target_type = 'comment' AND a.target_id = p_target);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._auto_show_target(text, text) FROM PUBLIC, anon, authenticated;

-- ── smart assignment ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_duty (
  user_id    uuid PRIMARY KEY,
  on_duty    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_duty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_duty_read ON public.staff_duty;
CREATE POLICY staff_duty_read ON public.staff_duty FOR SELECT USING (public.staff_rank(auth.uid()) >= 1);

CREATE OR REPLACE FUNCTION public.set_on_duty(p_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.staff_duty (user_id, on_duty, updated_at) VALUES (auth.uid(), p_on, now())
    ON CONFLICT (user_id) DO UPDATE SET on_duty = EXCLUDED.on_duty, updated_at = now();
  IF NOT p_on THEN
    -- cases nobody has started go back to the pool
    UPDATE public.content_reports SET assigned_to = NULL WHERE assigned_to = auth.uid() AND status = 'pending';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_on_duty(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_on_duty(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_to uuid;
BEGIN
  -- keep a group of reports about the same thing with the same person
  SELECT assigned_to INTO v_to FROM public.content_reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND id <> NEW.id
     AND assigned_to IS NOT NULL AND status IN ('pending', 'reviewing') LIMIT 1;
  IF v_to IS NULL THEN
    SELECT d.user_id INTO v_to FROM public.staff_duty d
     WHERE d.on_duty AND public.staff_rank(d.user_id) >= 1
     ORDER BY (SELECT count(*) FROM public.content_reports r WHERE r.assigned_to = d.user_id AND r.status IN ('pending', 'reviewing')), random()
     LIMIT 1;
  END IF;
  IF v_to IS NOT NULL THEN
    UPDATE public.content_reports SET assigned_to = v_to WHERE id = NEW.id;
  END IF;
  IF 'hide' = ANY (NEW.auto_actions) THEN
    PERFORM public._auto_hide_target(NEW.target_type, NEW.target_id, NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_report_after_insert ON public.content_reports;
CREATE TRIGGER trg_report_after_insert AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.report_after_insert();

-- anyone may take over a case whose owner is not on duty
CREATE OR REPLACE FUNCTION public.moderator_claim_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.content_reports r
     SET assigned_to = auth.uid(), status = CASE WHEN r.status = 'pending' THEN 'reviewing' ELSE r.status END
   WHERE r.id = p_report_id AND r.status IN ('pending', 'reviewing')
     AND (r.assigned_to IS NULL OR r.assigned_to = auth.uid() OR public.staff_rank(auth.uid()) >= 2
          OR NOT COALESCE((SELECT d.on_duty FROM public.staff_duty d WHERE d.user_id = r.assigned_to), false));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case is closed or being handled by someone who is on duty';
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'moderator', 'report_claim', 'content_report', p_report_id::text);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.moderator_claim_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_claim_report(uuid) TO authenticated;

-- ── when a report closes: show hidden things again, tell the reporter, remind careless reporters ─
CREATE OR REPLACE FUNCTION public.report_after_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_dis integer;
  v_up integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);

  -- anything hidden for review comes back unless other open reports still ask for it to stay hidden
  IF NOT EXISTS (SELECT 1 FROM public.content_reports r
                  WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id
                    AND r.id <> NEW.id AND r.status IN ('pending', 'reviewing') AND 'hide' = ANY (r.auto_actions)) THEN
    PERFORM public._auto_show_target(NEW.target_type, NEW.target_id);
  END IF;

  -- the person who reported hears the result (nothing about who was acted on)
  INSERT INTO public.notifications (user_id, title, message, type, priority)
  VALUES (NEW.reported_by,
          CASE WHEN NEW.status = 'resolved' THEN 'Thanks for your report' ELSE 'We reviewed your report' END,
          CASE WHEN NEW.status = 'resolved'
               THEN 'We looked into it and took action. Thank you for helping keep CineCraft Connect safe.'
               ELSE 'We looked into it and it does not break our rules. You can always report again if something changes.' END,
          'report_outcome', 'medium');

  IF NEW.status = 'dismissed' THEN
    SELECT count(*) FILTER (WHERE status = 'dismissed')::int, count(*) FILTER (WHERE status = 'resolved')::int
      INTO v_dis, v_up FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
    IF v_dis >= 10 AND v_dis % 10 = 0 AND v_up::numeric / (v_up + v_dis) <= 0.2 THEN
      INSERT INTO public.notifications (user_id, title, message, type, priority)
      VALUES (NEW.reported_by, 'A reminder about reporting',
              'Most of your recent reports did not break our rules. Please report only things that do, so we can reach real problems faster.',
              'report_outcome', 'medium');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_report_after_close ON public.content_reports;
CREATE TRIGGER trg_report_after_close AFTER UPDATE OF status ON public.content_reports
  FOR EACH ROW WHEN (NEW.status IN ('resolved', 'dismissed') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.report_after_close();

-- ── notices: what was done, why, and to which item ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('content_removed', 'warning', 'suspension')),
  reason       text,
  item_excerpt text,
  report_id    uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_notices_user ON public.user_notices (user_id, created_at DESC);
ALTER TABLE public.user_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_notices_read ON public.user_notices;
CREATE POLICY user_notices_read ON public.user_notices FOR SELECT USING (user_id = auth.uid() OR public.staff_rank(auth.uid()) >= 1);

CREATE OR REPLACE FUNCTION public.audit_to_user_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
  v_report uuid;
  v_reason text;
  v_item text;
  v_note text;
BEGIN
  v_user := NULLIF(NEW.metadata ->> 'author_id', '')::uuid;
  v_report := NULLIF(NEW.metadata ->> 'report_id', '')::uuid;
  IF v_user IS NULL OR v_report IS NULL THEN RETURN NULL; END IF;
  v_note := NULLIF(btrim(COALESCE(NEW.metadata ->> 'note', '')), '');
  SELECT replace(r.reason, '_', ' '),
         left(COALESCE(r.evidence ->> 'content', r.evidence ->> 'title', r.evidence ->> 'bio', ''), 140)
    INTO v_reason, v_item FROM public.content_reports r WHERE r.id = v_report;
  INSERT INTO public.user_notices (user_id, kind, reason, item_excerpt, report_id)
  VALUES (v_user,
          CASE NEW.action WHEN 'report_takedown' THEN 'content_removed' WHEN 'report_warn' THEN 'warning' ELSE 'suspension' END,
          COALESCE(v_note, v_reason), NULLIF(v_item, ''), v_report);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_to_user_notice ON public.audit_logs;
CREATE TRIGGER trg_audit_to_user_notice AFTER INSERT ON public.audit_logs
  FOR EACH ROW WHEN (NEW.action IN ('report_takedown', 'report_warn', 'report_ban'))
  EXECUTE FUNCTION public.audit_to_user_notice();

-- the standing page now lists these notices too
CREATE OR REPLACE FUNCTION public.get_my_account_standing()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'is_banned', COALESCE(p.is_banned, false),
      'ban', (SELECT jsonb_build_object('reason', b.reason, 'ban_type', b.ban_type, 'expires_at', b.expires_at, 'since', b.created_at)
                FROM public.user_bans b WHERE b.user_id = v_me AND b.is_active ORDER BY b.created_at DESC LIMIT 1),
      'muted_until', CASE WHEN p.mute_expires_at > now() THEN p.mute_expires_at END,
      'strikes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', s.reason, 'created_at', s.created_at, 'expires_at', s.expires_at)
                                            ORDER BY s.created_at DESC), '[]'::jsonb)
                    FROM public.user_strikes s WHERE s.user_id = v_me AND s.revoked_at IS NULL AND s.expires_at > now()),
      'notices', (SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', n.kind, 'reason', n.reason, 'item', n.item_excerpt, 'created_at', n.created_at)
                                            ORDER BY n.created_at DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.user_notices WHERE user_id = v_me ORDER BY created_at DESC LIMIT 20) n),
      'appeal', (SELECT jsonb_build_object('status', a.status, 'created_at', a.created_at, 'decision_note', a.decision_note)
                   FROM public.appeals a WHERE a.user_id = v_me ORDER BY a.created_at DESC LIMIT 1),
      'can_appeal', COALESCE(p.is_banned, false)
                    AND NOT EXISTS (SELECT 1 FROM public.appeals a WHERE a.user_id = v_me AND a.status = 'pending')
    ) FROM public.profiles p WHERE p.id = v_me
  );
END;
$$;

-- ── action bundles ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mod_bundles (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  action    text NOT NULL CHECK (action IN ('dismiss', 'warn', 'takedown', 'shadowban', 'ban')),
  note      text NOT NULL,
  also_warn boolean NOT NULL DEFAULT false,
  position  integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mod_bundles_name ON public.mod_bundles (name);
ALTER TABLE public.mod_bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mod_bundles_read ON public.mod_bundles;
CREATE POLICY mod_bundles_read ON public.mod_bundles FOR SELECT USING (public.staff_rank(auth.uid()) >= 1);
DROP POLICY IF EXISTS mod_bundles_write ON public.mod_bundles;
CREATE POLICY mod_bundles_write ON public.mod_bundles FOR ALL
  USING (public.staff_rank(auth.uid()) >= 2) WITH CHECK (public.staff_rank(auth.uid()) >= 2);

INSERT INTO public.mod_bundles (name, action, note, also_warn, position) VALUES
  ('Not a violation',       'dismiss',  'We reviewed this and found it does not break our rules.', false, 1),
  ('Spam: remove + warn',   'takedown', 'Repeated unwanted or promotional content, which breaks our spam rules.', true, 2),
  ('Harassment: remove + warn', 'takedown', 'Targeting another member with abuse or bullying, which breaks our harassment rules.', true, 3),
  ('Warn only',             'warn',     'This content was borderline. Please read our community guidelines.', false, 4),
  ('Scam: suspend',         'ban',     'An attempt to take money or information under false pretences.', false, 5)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.moderator_apply_bundle(p_report uuid, p_bundle uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_b public.mod_bundles%ROWTYPE;
  v_rep public.content_reports%ROWTYPE;
  v_author uuid;
  v_res jsonb;
  v_warned boolean := false;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_b FROM public.mod_bundles WHERE id = p_bundle;
  IF NOT FOUND THEN RAISE EXCEPTION 'That bundle does not exist'; END IF;
  SELECT * INTO v_rep FROM public.content_reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  IF v_b.also_warn AND v_b.action NOT IN ('dismiss', 'warn') THEN
    v_author := public._report_target_author(v_rep.target_type, v_rep.target_id);
    IF v_author IS NOT NULL AND public.gov_can_act_on(v_author) THEN
      PERFORM public._add_strike(v_author, v_b.note, p_report, auth.uid());
      PERFORM public.send_governance_notification(v_author, 'warn', v_b.note);
      v_warned := true;
    END IF;
  END IF;

  v_res := public.moderator_resolve_report(p_report, v_b.action, v_b.note);
  RETURN v_res || jsonb_build_object('also_warned', v_warned);
END;
$$;
REVOKE ALL ON FUNCTION public.moderator_apply_bundle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_apply_bundle(uuid, uuid) TO authenticated;

-- ── suggested action, from how similar reports were decided ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_report_precedents(p_report uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_type text;
  v_reason text;
  v_total integer;
  v_counts jsonb;
  v_best text;
  v_best_n integer;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  SELECT target_type, reason INTO v_type, v_reason FROM public.content_reports WHERE id = p_report;
  IF v_type IS NULL THEN RETURN NULL; END IF;

  WITH closed AS (
    SELECT r.id, r.status FROM public.content_reports r
     WHERE r.target_type = v_type AND r.reason = v_reason AND r.status IN ('resolved', 'dismissed') AND r.id <> p_report
     ORDER BY r.reviewed_at DESC NULLS LAST LIMIT 50
  ), acts AS (
    SELECT c.id,
           COALESCE((SELECT substring(a.action FROM 8) FROM public.audit_logs a
                      WHERE a.action IN ('report_dismiss', 'report_warn', 'report_takedown', 'report_shadowban', 'report_ban')
                        AND a.metadata ->> 'report_id' = c.id::text ORDER BY a.created_at DESC LIMIT 1),
                    CASE WHEN c.status = 'dismissed' THEN 'dismiss' ELSE 'other' END) AS act
      FROM closed c
  )
  SELECT (SELECT count(*) FROM acts)::int,
         COALESCE((SELECT jsonb_object_agg(act, n) FROM (SELECT act, count(*)::int AS n FROM acts GROUP BY act) g), '{}'::jsonb)
    INTO v_total, v_counts;

  SELECT key, value::int INTO v_best, v_best_n FROM jsonb_each_text(v_counts) WHERE key <> 'other' ORDER BY value::int DESC LIMIT 1;

  RETURN jsonb_build_object(
    'total', v_total, 'counts', v_counts,
    'suggested', CASE WHEN v_total >= 5 AND v_best IS NOT NULL AND v_best_n::numeric / v_total >= 0.5 THEN v_best END,
    'suggested_count', v_best_n
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_report_precedents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_report_precedents(uuid) TO authenticated;

-- ── one search box for staff ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_search(p_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_q text := btrim(COALESCE(p_q, ''));
  v_uuid text;
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  IF length(v_q) < 2 THEN RETURN v_out; END IF;
  v_uuid := (regexp_match(v_q, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'))[1];

  -- people by name, username or id
  v_out := v_out || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', 'user', 'id', u.id, 'label', '@' || COALESCE(u.username, left(u.id::text, 8)), 'sub', COALESCE(u.full_name, '')))
            FROM (SELECT id, username, full_name FROM public.profiles
                   WHERE (v_uuid IS NOT NULL AND id = v_uuid::uuid)
                      OR username ILIKE '%' || replace(v_q, '%', '') || '%' OR full_name ILIKE '%' || replace(v_q, '%', '') || '%'
                   ORDER BY username LIMIT 8) u), '[]'::jsonb);

  -- reports by number (the first characters of the id, or the whole id)
  IF v_q ~ '^#?[0-9a-fA-F]{6,36}$' OR v_uuid IS NOT NULL THEN
    v_out := v_out || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', 'report', 'id', r.id, 'label', 'Report #' || left(r.id::text, 8), 'sub', r.target_type || ' · ' || replace(r.reason, '_', ' ') || ' · ' || r.status))
              FROM (SELECT id, target_type, reason, status FROM public.content_reports
                     WHERE id::text LIKE lower(regexp_replace(COALESCE(v_uuid, v_q), '^#', '')) || '%'
                        OR (v_uuid IS NOT NULL AND target_id = v_uuid)
                     ORDER BY created_at DESC LIMIT 6) r), '[]'::jsonb);
  END IF;

  -- a pasted post link or id
  IF v_uuid IS NOT NULL THEN
    v_out := v_out || COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', 'post', 'id', p.id, 'label', 'Post', 'sub', left(COALESCE(p.content, ''), 80)))
              FROM (SELECT id, content FROM public.posts WHERE id = v_uuid::uuid LIMIT 1) p), '[]'::jsonb);
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_search(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_search(text) TO authenticated;

-- ── my day ──────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_day()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  v_rank integer := public.staff_rank(auth.uid());
BEGIN
  IF v_rank < 1 THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'on_duty', COALESCE((SELECT on_duty FROM public.staff_duty WHERE user_id = v_me), false),
    'assigned', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.due_at NULLS LAST), '[]'::jsonb) FROM (
                   SELECT id, target_type, reason, priority, due_at, status FROM public.content_reports
                    WHERE assigned_to = v_me AND status IN ('pending', 'reviewing') ORDER BY due_at NULLS LAST LIMIT 20) a),
    'overdue', (SELECT count(*) FROM public.content_reports WHERE status IN ('pending', 'reviewing') AND due_at < now()),
    'unassigned', (SELECT count(*) FROM public.content_reports WHERE status = 'pending' AND assigned_to IS NULL),
    'approvals_waiting', (SELECT count(*) FROM public.gov_approval_queue q
                           WHERE q.status = 'pending' AND q.maker_id IS DISTINCT FROM v_me
                             AND v_rank >= CASE WHEN q.action IN ('system.config', 'user.manage_roles', 'user.revoke_role') THEN 3
                                                WHEN q.action IN ('user.ban', 'report.ban', 'appeal.reverse') THEN 2 ELSE 1 END),
    'appeals_pending', CASE WHEN v_rank >= 2 THEN (SELECT count(*) FROM public.appeals WHERE status = 'pending') ELSE NULL END,
    'flagged_messages', (SELECT count(*) FROM public.flagged_messages WHERE status = 'pending')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_day() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_day() TO authenticated;

COMMIT;
