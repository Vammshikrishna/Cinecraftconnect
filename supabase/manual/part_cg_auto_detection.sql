-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART CG: automatic detection.
--   * Screening rules (keywords and patterns, editable by admins) are checked on every new or edited post, comment,
--     marketplace listing and job. A match opens a case in the normal moderation queue (no reporter, "automatic"),
--     with a priority from the rule, and hides a post or comment until a person looks when the rule says so.
--     Nothing is ever removed automatically: a person always decides.
--   * Listing signals: a new account pricing far below similar listings, or copying another seller's text.
--   * Throttles: how many posts, comments, listings and jobs an account can make in an hour or a day, stricter for
--     new accounts. Staff and system jobs are not limited.
-- Run after part CF. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── cases can now come from the system ──────────────────────────────────────────────────────────
ALTER TABLE public.content_reports ALTER COLUMN reported_by DROP NOT NULL;
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS auto_rule text;
DO $$
BEGIN
  ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_source_check;
  ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_source_check CHECK (source IN ('user', 'auto_text', 'auto_signal'));
END $$;
CREATE INDEX IF NOT EXISTS idx_content_reports_auto ON public.content_reports (target_type, target_id) WHERE source <> 'user';

-- closing a case that has no reporter: nobody to thank, but anything hidden still comes back
CREATE OR REPLACE FUNCTION public.report_after_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_dis integer;
  v_up integer;
  v_action text;
  v_what text;
BEGIN
  PERFORM set_config('app.market_system', '1', true);

  IF NOT EXISTS (SELECT 1 FROM public.content_reports r
                  WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id
                    AND r.id <> NEW.id AND r.status IN ('pending', 'reviewing') AND 'hide' = ANY (r.auto_actions)) THEN
    PERFORM public._auto_show_target(NEW.target_type, NEW.target_id);
  END IF;

  IF NEW.reported_by IS NULL THEN RETURN NULL; END IF;

  v_action := COALESCE(current_setting('app.report_action', true), '');
  v_what := CASE v_action
    WHEN 'takedown' THEN 'We removed what you reported.'
    WHEN 'warn'     THEN 'We warned the person responsible.'
    WHEN 'ban'      THEN 'We suspended the account involved.'
    WHEN 'shadowban' THEN 'We limited the reach of the account involved.'
    ELSE 'We took action.' END;

  INSERT INTO public.notifications (user_id, title, message, type, priority)
  VALUES (NEW.reported_by,
          CASE WHEN NEW.status = 'resolved' THEN 'Thanks for your report' ELSE 'We reviewed your report' END,
          'About your report (' || replace(NEW.reason, '_', ' ') || '): ' ||
          CASE WHEN NEW.status = 'resolved'
               THEN v_what || ' Thank you for helping keep CineCraft Connect safe.'
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

-- ── settings ────────────────────────────────────────────────────────────────────────────────────
-- name -> default, lowest, highest, label (all whole numbers, stored in platform_settings)
CREATE OR REPLACE FUNCTION public._safety_setting_meta()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'thr_new_posts_hour',        jsonb_build_array(5, 1, 500, 'Posts an hour, account under 1 day old'),
    'thr_young_posts_hour',      jsonb_build_array(15, 1, 500, 'Posts an hour, account under 7 days old'),
    'thr_posts_hour',            jsonb_build_array(60, 1, 1000, 'Posts an hour, other accounts'),
    'thr_new_comments_hour',     jsonb_build_array(20, 1, 1000, 'Comments an hour, account under 1 day old'),
    'thr_young_comments_hour',   jsonb_build_array(60, 1, 1000, 'Comments an hour, account under 7 days old'),
    'thr_comments_hour',         jsonb_build_array(200, 1, 5000, 'Comments an hour, other accounts'),
    'thr_new_listings_day',      jsonb_build_array(3, 1, 200, 'Marketplace listings a day, account under 7 days old'),
    'thr_listings_day',          jsonb_build_array(20, 1, 500, 'Marketplace listings a day, other accounts'),
    'thr_new_jobs_day',          jsonb_build_array(2, 1, 200, 'Job posts a day, account under 7 days old'),
    'thr_jobs_day',              jsonb_build_array(15, 1, 500, 'Job posts a day, other accounts'),
    'sla_urgent_min',            jsonb_build_array(60, 5, 1440, 'Time to decide an urgent case (minutes)'),
    'sla_high_min',              jsonb_build_array(240, 15, 4320, 'Time to decide a high-priority case (minutes)'),
    'sla_medium_min',            jsonb_build_array(1440, 60, 10080, 'Time to decide a medium case (minutes)'),
    'sla_low_min',               jsonb_build_array(4320, 60, 20160, 'Time to decide a low-priority case (minutes)'),
    'qa_sample_pct',             jsonb_build_array(10, 0, 100, 'Closed cases a second person re-checks (%)'));
$$;

CREATE OR REPLACE FUNCTION public._ss(p_key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.billing_setting_int(p_key, ((public._safety_setting_meta() -> p_key) ->> 0)::integer);
$$;
REVOKE ALL ON FUNCTION public._safety_setting_meta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ss(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_safety_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  k text;
  m jsonb := public._safety_setting_meta();
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  FOR k IN SELECT jsonb_object_keys(m) LOOP
    v_out := v_out || jsonb_build_object('key', k, 'label', (m -> k) ->> 3, 'value', public._ss(k),
                                         'default', ((m -> k) ->> 0)::int, 'min', ((m -> k) ->> 1)::int, 'max', ((m -> k) ->> 2)::int);
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_safety_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_safety_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_safety_setting(p_key text, p_value integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  m jsonb := public._safety_setting_meta() -> p_key;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can change this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF m IS NULL THEN RAISE EXCEPTION 'Unknown setting'; END IF;
  IF p_value < (m ->> 1)::int OR p_value > (m ->> 2)::int THEN
    RAISE EXCEPTION 'The value must be between % and %', m ->> 1, m ->> 2;
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by) VALUES (p_key, to_jsonb(p_value), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'safety_setting', 'platform_setting', p_key, jsonb_build_object('value', p_value));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_safety_setting(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_safety_setting(text, integer) TO authenticated;

-- ── screening rules ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.screen_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('keyword', 'regex')),
  pattern          text NOT NULL CHECK (length(pattern) BETWEEN 2 AND 500),
  reason           text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'misinformation', 'explicit_content', 'impersonation', 'fraud', 'other', 'child_safety')),
  severity         text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  hide             boolean NOT NULL DEFAULT false,
  applies_to       text[] NOT NULL DEFAULT ARRAY['post', 'comment', 'listing', 'job'],
  new_account_days integer CHECK (new_account_days IS NULL OR new_account_days BETWEEN 1 AND 365),
  enabled          boolean NOT NULL DEFAULT true,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_screen_rules_name ON public.screen_rules (name);
ALTER TABLE public.screen_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS screen_rules_read ON public.screen_rules;
CREATE POLICY screen_rules_read ON public.screen_rules FOR SELECT USING (public.staff_rank(auth.uid()) >= 2);
REVOKE INSERT, UPDATE, DELETE ON public.screen_rules FROM anon, authenticated;

INSERT INTO public.screen_rules (name, kind, pattern, reason, severity, hide, applies_to, new_account_days) VALUES
  ('Link shortener from a new account', 'regex', '(^|[^a-z0-9])(bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|is\.gd|t\.ly|shorturl\.at|goo\.gl)/', 'fraud', 'low', false, ARRAY['post', 'comment', 'listing', 'job'], 14),
  ('Asks for an OTP, PIN or password', 'regex', '(send|share|give|tell)( me)?( your| the)? (otp|pin|cvv|password)', 'fraud', 'high', true, ARRAY['post', 'comment', 'listing', 'job'], NULL),
  ('Fee to be cast or hired', 'regex', '(registration|audition|processing|joining|casting|portfolio|membership|security) (fee|fees|charge|charges|amount)|pay (an )?advance|advance payment|deposit to (confirm|secure) (your )?(role|audition|slot)', 'fraud', 'high', false, ARRAY['post', 'comment', 'job'], NULL),
  ('Guaranteed returns', 'regex', '(guaranteed|assured|100%) (returns?|profit|income)|double your money|work from home.{0,40}(earn|income)', 'fraud', 'medium', false, ARRAY['post', 'comment', 'listing', 'job'], NULL),
  ('Betting, casino or crypto signals', 'regex', '(betting|satta|casino|teen patti|rummy|online poker|crypto signals?)', 'spam', 'medium', false, ARRAY['post', 'comment', 'listing', 'job'], 30),
  ('Invite to Telegram or WhatsApp from a new account', 'regex', '(t\.me/|wa\.me/|chat\.whatsapp\.com/|telegram)', 'spam', 'low', false, ARRAY['post', 'comment'], 7),
  ('Explicit solicitation', 'regex', '(nudes?|sex chat|escort service|adult content|onlyfans)', 'explicit_content', 'high', true, ARRAY['post', 'comment', 'listing', 'job'], NULL),
  ('Pretends to be the CineCraft team', 'regex', '((official|admin|support|moderator) (of )?cinecraft|cinecraft (support|team|admin) (will|requires|needs|says))', 'impersonation', 'medium', false, ARRAY['post', 'comment', 'listing', 'job'], NULL)
ON CONFLICT (name) DO NOTHING;

-- the strongest match for a piece of text. p_author may be NULL (the test box), then account age is ignored.
CREATE OR REPLACE FUNCTION public._screen_text(p_type text, p_author uuid, p_text text)
RETURNS TABLE (names text[], reason text, severity text, hide boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r record;
  v_age integer;
  v_t text := lower(COALESCE(p_text, ''));
  v_hit boolean;
BEGIN
  names := ARRAY[]::text[]; reason := NULL; severity := NULL; hide := false;
  IF length(v_t) = 0 THEN RETURN NEXT; RETURN; END IF;
  IF p_author IS NOT NULL THEN
    SELECT GREATEST(0, (extract(epoch FROM (now() - u.created_at)) / 86400)::int) INTO v_age FROM auth.users u WHERE u.id = p_author;
  END IF;
  FOR r IN SELECT * FROM public.screen_rules s WHERE s.enabled AND p_type = ANY (s.applies_to) ORDER BY s.created_at LOOP
    IF r.new_account_days IS NOT NULL AND p_author IS NOT NULL AND (v_age IS NULL OR v_age > r.new_account_days) THEN CONTINUE; END IF;
    BEGIN
      v_hit := CASE r.kind WHEN 'keyword' THEN position(lower(r.pattern) IN v_t) > 0 ELSE v_t ~* r.pattern END;
    EXCEPTION WHEN OTHERS THEN
      v_hit := false; -- a broken pattern never blocks anything
    END;
    IF v_hit THEN
      names := names || r.name;
      IF severity IS NULL OR public.report_priority_rank(r.severity) > public.report_priority_rank(severity) THEN
        severity := r.severity; reason := r.reason;
      END IF;
      IF r.hide THEN hide := true; END IF;
    END IF;
  END LOOP;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public._screen_text(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- opens a case from the system, once per item while one is still open
CREATE OR REPLACE FUNCTION public._auto_case(p_type text, p_target text, p_reason text, p_severity text, p_hide boolean, p_source text, p_rule text, p_details text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_reports WHERE target_type = p_type AND target_id = p_target AND source <> 'user' AND status IN ('pending', 'reviewing')) THEN
    RETURN;
  END IF;
  INSERT INTO public.content_reports (reported_by, target_type, target_id, reason, details, priority, status, source, auto_rule, auto_actions)
  VALUES (NULL, p_type, p_target, p_reason, left(p_details, 500), COALESCE(p_severity, 'medium'), 'pending', p_source, left(p_rule, 300),
          CASE WHEN p_hide THEN ARRAY['hide']::text[] ELSE ARRAY[]::text[] END);
END;
$$;
REVOKE ALL ON FUNCTION public._auto_case(text, text, text, text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;

-- the median daily price of similar listings (needs at least 5 others)
CREATE OR REPLACE FUNCTION public._listing_signals(p_listing uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  l public.marketplace_listings%ROWTYPE;
  v_median numeric;
  v_n integer;
  v_age integer;
  v_out text := '';
BEGIN
  SELECT * INTO l FROM public.marketplace_listings WHERE id = p_listing;
  IF NOT FOUND THEN RETURN ''; END IF;
  SELECT GREATEST(0, (extract(epoch FROM (now() - u.created_at)) / 86400)::int) INTO v_age FROM auth.users u WHERE u.id = l.user_id;
  IF v_age IS NOT NULL AND v_age <= 14 AND l.price_per_day > 0 THEN
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_day), count(*) INTO v_median, v_n
      FROM public.marketplace_listings WHERE category = l.category AND id <> l.id AND user_id <> l.user_id AND price_per_day > 0;
    IF v_n >= 5 AND l.price_per_day < v_median * 0.3 THEN v_out := v_out || 'Price far below similar listings; '; END IF;
  END IF;
  IF length(btrim(l.description)) >= 60 AND EXISTS (
       SELECT 1 FROM public.marketplace_listings o
        WHERE o.user_id <> l.user_id AND o.created_at > now() - interval '90 days'
          AND md5(lower(btrim(o.description))) = md5(lower(btrim(l.description)))) THEN
    v_out := v_out || 'Same text as another seller''s listing; ';
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public._listing_signals(uuid) FROM PUBLIC, anon, authenticated;

-- the trigger on new content. It must never stop someone posting, so any error is swallowed.
CREATE OR REPLACE FUNCTION public.screen_new_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_type text;
  v_author uuid;
  v_text text;
  v_id text;
  m record;
  v_signal text := '';
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'posts' THEN v_type := 'post'; v_author := NEW.author_id; v_text := NEW.content;
    ELSIF TG_TABLE_NAME = 'post_comments' THEN v_type := 'comment'; v_author := NEW.user_id; v_text := NEW.content;
    ELSIF TG_TABLE_NAME = 'marketplace_listings' THEN v_type := 'listing'; v_author := NEW.user_id; v_text := NEW.title || ' ' || NEW.description;
    ELSIF TG_TABLE_NAME = 'jobs' THEN v_type := 'job'; v_author := NEW.posted_by; v_text := NEW.title || ' ' || NEW.description;
    ELSE RETURN NULL; END IF;
    v_id := NEW.id::text;
    IF v_author IS NULL OR public.staff_rank(v_author) >= 1 THEN RETURN NULL; END IF;

    SELECT * INTO m FROM public._screen_text(v_type, v_author, v_text);
    IF v_type = 'listing' AND TG_OP = 'INSERT' THEN v_signal := public._listing_signals(NEW.id); END IF;

    IF m.reason IS NOT NULL THEN
      PERFORM public._auto_case(v_type, v_id, m.reason, m.severity, m.hide, 'auto_text', array_to_string(m.names, ', '),
                                'Automatic: matched ' || array_to_string(m.names, ', ') || CASE WHEN v_signal <> '' THEN '; ' || v_signal ELSE '' END);
    ELSIF v_signal <> '' THEN
      PERFORM public._auto_case(v_type, v_id, 'fraud', 'medium', false, 'auto_signal', rtrim(v_signal, '; '), 'Automatic: ' || rtrim(v_signal, '; '));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'screen_new_content failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_screen_posts ON public.posts;
CREATE TRIGGER trg_screen_posts AFTER INSERT OR UPDATE OF content ON public.posts FOR EACH ROW EXECUTE FUNCTION public.screen_new_content();
DROP TRIGGER IF EXISTS trg_screen_comments ON public.post_comments;
CREATE TRIGGER trg_screen_comments AFTER INSERT OR UPDATE OF content ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.screen_new_content();
DROP TRIGGER IF EXISTS trg_screen_listings ON public.marketplace_listings;
CREATE TRIGGER trg_screen_listings AFTER INSERT OR UPDATE OF title, description ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.screen_new_content();
DROP TRIGGER IF EXISTS trg_screen_jobs ON public.jobs;
CREATE TRIGGER trg_screen_jobs AFTER INSERT OR UPDATE OF title, description ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.screen_new_content();

-- ── throttles ───────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.throttle_new_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
  v_age integer;
  v_limit integer;
  v_count integer;
  v_window interval;
  v_what text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- system jobs and imports
  IF TG_TABLE_NAME = 'posts' THEN v_author := NEW.author_id;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN v_author := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'marketplace_listings' THEN v_author := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'jobs' THEN v_author := NEW.posted_by;
  ELSE RETURN NEW; END IF;
  IF v_author IS NULL OR v_author <> auth.uid() OR public.staff_rank(v_author) >= 1 THEN RETURN NEW; END IF;

  SELECT GREATEST(0, (extract(epoch FROM (now() - u.created_at)) / 86400)::int) INTO v_age FROM auth.users u WHERE u.id = v_author;
  v_age := COALESCE(v_age, 0);

  IF TG_TABLE_NAME = 'posts' THEN
    v_limit := public._ss(CASE WHEN v_age < 1 THEN 'thr_new_posts_hour' WHEN v_age < 7 THEN 'thr_young_posts_hour' ELSE 'thr_posts_hour' END);
    v_window := interval '1 hour'; v_what := 'posts';
    SELECT count(*) INTO v_count FROM public.posts WHERE author_id = v_author AND created_at > now() - v_window;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    v_limit := public._ss(CASE WHEN v_age < 1 THEN 'thr_new_comments_hour' WHEN v_age < 7 THEN 'thr_young_comments_hour' ELSE 'thr_comments_hour' END);
    v_window := interval '1 hour'; v_what := 'comments';
    SELECT count(*) INTO v_count FROM public.post_comments WHERE user_id = v_author AND created_at > now() - v_window;
  ELSIF TG_TABLE_NAME = 'marketplace_listings' THEN
    v_limit := public._ss(CASE WHEN v_age < 7 THEN 'thr_new_listings_day' ELSE 'thr_listings_day' END);
    v_window := interval '1 day'; v_what := 'listings';
    SELECT count(*) INTO v_count FROM public.marketplace_listings WHERE user_id = v_author AND created_at > now() - v_window;
  ELSE
    v_limit := public._ss(CASE WHEN v_age < 7 THEN 'thr_new_jobs_day' ELSE 'thr_jobs_day' END);
    v_window := interval '1 day'; v_what := 'job posts';
    SELECT count(*) INTO v_count FROM public.jobs WHERE posted_by = v_author AND created_at > now() - v_window;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'You are making % too quickly. Please wait a while and try again.', v_what USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_throttle_posts ON public.posts;
CREATE TRIGGER trg_throttle_posts BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.throttle_new_content();
DROP TRIGGER IF EXISTS trg_throttle_comments ON public.post_comments;
CREATE TRIGGER trg_throttle_comments BEFORE INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.throttle_new_content();
DROP TRIGGER IF EXISTS trg_throttle_listings ON public.marketplace_listings;
CREATE TRIGGER trg_throttle_listings BEFORE INSERT ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.throttle_new_content();
DROP TRIGGER IF EXISTS trg_throttle_jobs ON public.jobs;
CREATE TRIGGER trg_throttle_jobs BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.throttle_new_content();

-- ── image scanning was tried and removed: clean up if an earlier run created it ───────────────────
DROP TRIGGER IF EXISTS trg_queue_images_posts ON public.posts;
DROP TRIGGER IF EXISTS trg_queue_images_listings ON public.marketplace_listings;
DROP FUNCTION IF EXISTS public.queue_new_images();
DROP FUNCTION IF EXISTS public.scan_queue_claim(integer);
DROP FUNCTION IF EXISTS public.scan_queue_complete(uuid, jsonb);
DROP FUNCTION IF EXISTS public.scan_queue_fail(uuid);
DROP TABLE IF EXISTS public.image_scan_queue;

-- ── for admins: manage the rules, test text, see how well it works ─────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_list_screen_rules()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'kind', s.kind, 'pattern', s.pattern, 'reason', s.reason, 'severity', s.severity, 'hide', s.hide,
      'applies_to', s.applies_to, 'new_account_days', s.new_account_days, 'enabled', s.enabled,
      'hits_30d', (SELECT count(*) FROM public.content_reports r WHERE r.source = 'auto_text' AND r.created_at > now() - interval '30 days' AND r.auto_rule LIKE '%' || s.name || '%'),
      'upheld_30d', (SELECT count(*) FROM public.content_reports r WHERE r.source = 'auto_text' AND r.created_at > now() - interval '30 days' AND r.status = 'resolved' AND r.auto_rule LIKE '%' || s.name || '%'),
      'dismissed_30d', (SELECT count(*) FROM public.content_reports r WHERE r.source = 'auto_text' AND r.created_at > now() - interval '30 days' AND r.status = 'dismissed' AND r.auto_rule LIKE '%' || s.name || '%')
    ) ORDER BY s.created_at), '[]'::jsonb) FROM public.screen_rules s);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_list_screen_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_screen_rules() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_save_screen_rule(
  p_id uuid, p_name text, p_kind text, p_pattern text, p_reason text, p_severity text, p_hide boolean,
  p_applies_to text[], p_new_account_days integer, p_enabled boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can change this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_name, ''))) < 3 OR length(p_name) > 80 THEN RAISE EXCEPTION 'Give the rule a name of 3 to 80 characters'; END IF;
  IF p_kind = 'regex' THEN
    BEGIN
      PERFORM '' ~* p_pattern;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'That pattern is not valid: %', SQLERRM;
    END;
  END IF;
  IF p_applies_to IS NULL OR array_length(p_applies_to, 1) IS NULL OR NOT (p_applies_to <@ ARRAY['post', 'comment', 'listing', 'job']) THEN
    RAISE EXCEPTION 'Choose where the rule applies';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.screen_rules (name, kind, pattern, reason, severity, hide, applies_to, new_account_days, enabled, created_by)
    VALUES (btrim(p_name), p_kind, p_pattern, p_reason, p_severity, COALESCE(p_hide, false), p_applies_to, p_new_account_days, COALESCE(p_enabled, true), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.screen_rules SET name = btrim(p_name), kind = p_kind, pattern = p_pattern, reason = p_reason, severity = p_severity,
           hide = COALESCE(p_hide, false), applies_to = p_applies_to, new_account_days = p_new_account_days, enabled = COALESCE(p_enabled, true)
     WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Rule not found'; END IF;
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'screen_rule_saved', 'screen_rule', v_id::text, jsonb_build_object('name', btrim(p_name), 'enabled', COALESCE(p_enabled, true)));
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A rule with that name already exists';
END;
$$;
REVOKE ALL ON FUNCTION public.staff_save_screen_rule(uuid, text, text, text, text, text, boolean, text[], integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_save_screen_rule(uuid, text, text, text, text, text, boolean, text[], integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_delete_screen_rule(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can change this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.screen_rules WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found'; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id) VALUES (auth.uid(), 'admin', 'screen_rule_deleted', 'screen_rule', p_id::text);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_delete_screen_rule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_delete_screen_rule(uuid) TO authenticated;

-- try some text against the rules without saving anything
CREATE OR REPLACE FUNCTION public.staff_test_screen_text(p_type text, p_text text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  m record;
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can use this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_type NOT IN ('post', 'comment', 'listing', 'job') THEN RAISE EXCEPTION 'Choose where the text would appear'; END IF;
  SELECT * INTO m FROM public._screen_text(p_type, NULL, left(p_text, 5000));
  RETURN jsonb_build_object('matched', m.reason IS NOT NULL, 'rules', to_jsonb(m.names), 'reason', m.reason, 'severity', m.severity, 'hide', m.hide);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_test_screen_text(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_test_screen_text(text, text) TO authenticated;

-- how much came from the system and how much of it was right
CREATE OR REPLACE FUNCTION public.staff_detection_stats(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 2 THEN RAISE EXCEPTION 'Only admins can see this' USING ERRCODE = '42501'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action' USING ERRCODE = '42501'; END IF;
  IF p_days NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Choose between 1 and 365 days'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'days', p_days,
      'by_source', COALESCE((SELECT jsonb_object_agg(source, jsonb_build_object(
                     'opened', c.opened, 'upheld', c.upheld, 'dismissed', c.dismissed))
                   FROM (SELECT source, count(*) AS opened, count(*) FILTER (WHERE status = 'resolved') AS upheld, count(*) FILTER (WHERE status = 'dismissed') AS dismissed
                           FROM public.content_reports WHERE created_at > now() - make_interval(days => p_days) GROUP BY source) c), '{}'::jsonb)));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_detection_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_detection_stats(integer) TO authenticated;

COMMIT;
