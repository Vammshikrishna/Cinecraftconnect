-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART DP: report abuse follow-up (audit finding F-6, the two gaps part DJ left open).
--   1. Own-content refusal now also covers announcements, reviews, cinema entries, pitch calls and pitch
--      submissions (part DJ only knew user, post, comment, job, listing, room). For an announcement or a post that
--      was published for a page, every manager of that page counts as the owner too.
--   2. Several fake accounts can no longer hide someone's content together. Only "credible" reporters count toward
--      the priority steps (3 = high, 5 = urgent) and the admin rules ("Hide at 5 reports"):
--        credible = account older than 7 days, not banned, not shadowbanned, onboarding completed AND at least one
--                   real activity (a post, a comment, or an accepted connection).
--      Reports from other accounts are still stored and staff still see them; they just do not count.
--      Two more per-target rules on top of that:
--        * 3 or more credible reporters whose accounts were created within 24 hours of each other (chained: each
--          account is within 24 hours of the previous one) count as ONE reporter.
--        * If all credible user reporters on a target were created inside one 24 hour window, they count as ONE.
--      An automatic hide only fires when the NEW report comes from a credible reporter.
--   3. Flood limit per target: at most 10 new reports on one target per hour (all reporters together). Extra
--      reports are accepted and queued, but they do not change priority and cannot trigger an automatic hide.
--
-- WHAT THE AUTOMATIC HIDE IS (checked in part BM, not changed here): _auto_hide_target only acts on posts and
-- comments. A post is moved to audience 'private' and its old audience is saved in auto_hidden_prev_audience; a
-- comment gets is_hidden = true. Both are soft: when the last open report that asked for the hide is closed
-- (dismissed or resolved) report_after_close calls _auto_show_target and the content comes back. Staff can lift it
-- by closing the report. The schema has no separate "pending hide" state and none is invented here. The
-- child-safety fast lane still hides at once (same soft hide) exactly as in part DJ.
--
-- Run order: part CC, part CK, part CZ, part DJ, THEN this part. Safe to run more than once.
-- If part DJ is ever run again it puts back its own report_prepare: run this part again afterwards.
--
-- Target types with NO author lookup (cannot be checked for "own content"):
--   * message  : chat messages are end-to-end encrypted and are reported through flagged_messages; there is no
--                readable author column on content_reports for them.
--   Every other type in content_reports_target_type_check is covered:
--   user, post, comment, job, listing, room, announcement, review (film_reviews), cinema (platform_cinema),
--   pitch_call, pitch_submission.
--
-- ── PREFLIGHT (read only: run these first in the SQL editor; they change nothing) ───────────────
--   -- a) part DJ must already be installed (expect 2 rows: the trigger and report_prepare/guard pieces)
--   select tgname from pg_trigger where tgrelid = 'public.content_reports'::regclass and not tgisinternal
--      and tgname in ('b_dj_report_abuse_guard', 'trg_report_prepare');
--   -- b) the tables and columns this part reads (expect 11 rows)
--   select table_name, column_name from information_schema.columns where table_schema = 'public' and (table_name, column_name) in
--     (('announcements','author_id'), ('announcements','publisher_page_id'), ('film_reviews','user_id'), ('platform_cinema','creator_id'),
--      ('pitch_calls','creator_id'), ('pitch_submissions','submitter_id'), ('profiles','is_banned'),
--      ('profiles','is_shadowbanned'), ('profiles','onboarding_completed'), ('posts','page_id'), ('user_connections','status'));
--   -- c) helper functions that must exist (expect 2 rows)
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname in ('is_page_manager', 'report_priority_rank');
--   -- d) history: reports people filed on their own announcement / review / cinema entry / pitch (not changed)
--   select r.id, r.target_type, r.created_at from public.content_reports r
--    where r.reported_by is not null and r.target_type in ('announcement','review','cinema','pitch_call','pitch_submission')
--      and r.target_id ~ '^[0-9a-fA-F-]{36}$' and r.reported_by = (case r.target_type
--        when 'announcement' then (select author_id from public.announcements where id = r.target_id::uuid)
--        when 'review' then (select user_id from public.film_reviews where id = r.target_id::uuid)
--        when 'cinema' then (select creator_id from public.platform_cinema where id = r.target_id::uuid)
--        when 'pitch_call' then (select creator_id from public.pitch_calls where id = r.target_id::uuid)
--        when 'pitch_submission' then (select submitter_id from public.pitch_submissions where id = r.target_id::uuid) end);
--   -- e) open targets whose reports come mostly from accounts that would not count (fresh, banned, or inactive)
--   select r.target_type, r.target_id, count(distinct r.reported_by) as people,
--          count(distinct r.reported_by) filter (where u.created_at > now() - interval '7 days') as under_7_days
--     from public.content_reports r left join auth.users u on u.id = r.reported_by
--    where r.status in ('pending', 'reviewing') group by 1, 2 having count(distinct r.reported_by) >= 3 order by 3 desc;
--   -- f) targets already hidden by an automatic rule right now (they come back when the report is closed)
--   select 'post' as kind, id::text from public.posts where auto_hidden_at is not null
--    union all select 'comment', id::text from public.post_comments where is_hidden;
--   -- g) targets that received more than 10 reports in one hour in the past (the new limit would have applied)
--   select target_type, target_id, date_trunc('hour', created_at) as hour, count(*) from public.content_reports
--    group by 1, 2, 3 having count(*) > 10 order by 4 desc;
-- ════════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 0. refuse to run on a database that does not have what this part needs ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.content_reports'::regclass AND NOT tgisinternal AND tgname = 'b_dj_report_abuse_guard') THEN
    RAISE EXCEPTION 'Part DJ is not installed yet (trigger b_dj_report_abuse_guard is missing). Run part DJ first.';
  END IF;
  IF to_regprocedure('public.report_priority_rank(text)') IS NULL OR to_regprocedure('public._apply_rules(text, text, integer, jsonb, uuid)') IS NULL
     OR to_regprocedure('public.is_page_manager(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'report_priority_rank, _apply_rules or is_page_manager is missing. Run the earlier parts first.';
  END IF;
  IF to_regclass('public.announcements') IS NULL OR to_regclass('public.film_reviews') IS NULL OR to_regclass('public.platform_cinema') IS NULL
     OR to_regclass('public.pitch_calls') IS NULL OR to_regclass('public.pitch_submissions') IS NULL THEN
    RAISE EXCEPTION 'One of announcements, film_reviews, platform_cinema, pitch_calls, pitch_submissions does not exist.';
  END IF;
END $$;

-- index for the per-target hourly flood count and the per-target reporter count
CREATE INDEX IF NOT EXISTS idx_content_reports_target_created
  ON public.content_reports (target_type, target_id, created_at DESC);

-- ── 1. who made the reported thing: every target type that has an author ───────────────────────
-- Separate from part BM's _report_target_author on purpose (that one also feeds the rules and the action
-- screens and is left alone). 'message' has no author lookup (encrypted chat), so it returns NULL.
CREATE OR REPLACE FUNCTION public.dp_report_target_author(p_type text, p_target text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := p_target::uuid;
  RETURN CASE p_type
    WHEN 'user'             THEN v_id
    WHEN 'post'             THEN (SELECT author_id    FROM public.posts WHERE id = v_id)
    WHEN 'comment'          THEN (SELECT user_id      FROM public.post_comments WHERE id = v_id)
    WHEN 'job'              THEN (SELECT posted_by    FROM public.jobs WHERE id = v_id)
    WHEN 'listing'          THEN (SELECT user_id      FROM public.marketplace_listings WHERE id = v_id)
    WHEN 'room'             THEN (SELECT creator_id   FROM public.discussion_rooms WHERE id = v_id)
    WHEN 'announcement'     THEN (SELECT author_id    FROM public.announcements WHERE id = v_id)
    WHEN 'review'           THEN (SELECT user_id      FROM public.film_reviews WHERE id = v_id)
    WHEN 'cinema'           THEN (SELECT creator_id   FROM public.platform_cinema WHERE id = v_id)
    WHEN 'pitch_call'       THEN (SELECT creator_id   FROM public.pitch_calls WHERE id = v_id)
    WHEN 'pitch_submission' THEN (SELECT submitter_id FROM public.pitch_submissions WHERE id = v_id)
    ELSE NULL END;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.dp_report_target_author(text, text) FROM PUBLIC, anon, authenticated;

-- a manager of the page an announcement or post was published for is the owner too
CREATE OR REPLACE FUNCTION public.dp_reporter_manages_target(p_reporter uuid, p_type text, p_target text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_page uuid;
BEGIN
  IF p_type = 'announcement' THEN
    SELECT publisher_page_id INTO v_page FROM public.announcements WHERE id = p_target::uuid;
  ELSIF p_type = 'post' THEN
    SELECT page_id INTO v_page FROM public.posts WHERE id = p_target::uuid;
  ELSE
    RETURN false;
  END IF;
  RETURN v_page IS NOT NULL AND public.is_page_manager(v_page, p_reporter);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.dp_reporter_manages_target(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── 1b. the guard: same pattern as part DJ (BEFORE INSERT, system reports left alone) ──────────
-- Name sorts after b_dj_report_abuse_guard and before trg_report_prepare.
CREATE OR REPLACE FUNCTION public.dp_report_own_content_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_author uuid;
BEGIN
  IF NEW.reported_by IS NULL OR auth.uid() IS NULL OR COALESCE(NEW.source, 'user') <> 'user' THEN
    RETURN NEW;
  END IF;

  v_author := public.dp_report_target_author(NEW.target_type, NEW.target_id);
  IF (v_author IS NOT NULL AND v_author = NEW.reported_by)
     OR public.dp_reporter_manages_target(NEW.reported_by, NEW.target_type, NEW.target_id) THEN
    RAISE EXCEPTION 'You cannot report your own content or your own account' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dp_report_own_content_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS b_dp_report_own_content_guard ON public.content_reports;
CREATE TRIGGER b_dp_report_own_content_guard BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.dp_report_own_content_guard();

-- ── 2. credible reporters ──────────────────────────────────────────────────────────────────────
-- One place to change the definition. Stricter than "onboarding OR activity": completed onboarding AND one real
-- action, because onboarding alone is something a script can do and then wait 7 days.
CREATE OR REPLACE FUNCTION public.dp_reporter_is_credible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  -- profiles has no created_at: the sign-up date is the account's (auth.users.created_at)
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
     WHERE p.id = p_user
       AND u.created_at <= now() - interval '7 days'
       AND NOT COALESCE(p.is_banned, false)
       AND NOT COALESCE(p.is_shadowbanned, false)
       AND p.shadow_banned_at IS NULL
       AND COALESCE(p.onboarding_completed, false)
       AND (EXISTS (SELECT 1 FROM public.posts x WHERE x.author_id = p.id)
            OR EXISTS (SELECT 1 FROM public.post_comments c WHERE c.user_id = p.id)
            OR EXISTS (SELECT 1 FROM public.user_connections uc
                        WHERE uc.status = 'accepted' AND (uc.follower_id = p.id OR uc.following_id = p.id)))
  );
$$;
REVOKE ALL ON FUNCTION public.dp_reporter_is_credible(uuid) FROM PUBLIC, anon, authenticated;

-- How many independent, credible sources have an open report on this target (the new report included).
--   * each credible person counts once
--   * accounts created within 24 hours of each other (chained) form a group; a group of 3 or more counts as 1
--   * if all credible people were created inside one 24 hour window they count as 1
--   * all automatic (system) cases together count as 1 source, as in part DJ
CREATE OR REPLACE FUNCTION public.dp_credible_reporter_count(p_type text, p_target text, p_new_reporter uuid, p_new_is_system boolean)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_people integer;
  v_grouped integer;
  v_span interval;
  v_system integer := 0;
  v_users integer;
BEGIN
  WITH people AS (
    SELECT r.reported_by AS uid FROM public.content_reports r
     WHERE r.target_type = p_type AND r.target_id = p_target AND r.status IN ('pending', 'reviewing')
       AND r.reported_by IS NOT NULL AND COALESCE(r.source, 'user') = 'user'
    UNION
    SELECT p_new_reporter WHERE p_new_reporter IS NOT NULL AND NOT p_new_is_system
  ), cred AS (
    SELECT p.id, u.created_at FROM people JOIN public.profiles p ON p.id = people.uid JOIN auth.users u ON u.id = p.id
     WHERE public.dp_reporter_is_credible(p.id)
  ), ordered AS (
    SELECT id, created_at,
           CASE WHEN created_at - lag(created_at) OVER (ORDER BY created_at, id) > interval '24 hours' THEN 1 ELSE 0 END AS brk
      FROM cred
  ), grp AS (
    SELECT created_at, sum(brk) OVER (ORDER BY created_at, id) AS g FROM ordered
  ), sized AS (
    SELECT g, count(*)::int AS n, min(created_at) AS lo, max(created_at) AS hi FROM grp GROUP BY g
  )
  SELECT COALESCE(sum(n), 0)::int, COALESCE(sum(CASE WHEN n >= 3 THEN 1 ELSE n END), 0)::int, max(hi) - min(lo)
    INTO v_people, v_grouped, v_span
    FROM sized;

  -- everybody who counts was created inside one 24 hour window: one source
  IF v_people >= 2 AND v_span <= interval '24 hours' THEN
    v_users := 1;
  ELSE
    v_users := v_grouped;
  END IF;

  IF p_new_is_system OR EXISTS (
       SELECT 1 FROM public.content_reports r
        WHERE r.target_type = p_type AND r.target_id = p_target AND r.status IN ('pending', 'reviewing')
          AND (r.reported_by IS NULL OR COALESCE(r.source, 'user') <> 'user')) THEN
    v_system := 1;
  END IF;
  RETURN v_users + v_system;
END;
$$;
REVOKE ALL ON FUNCTION public.dp_credible_reporter_count(text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── 3. report_prepare: part DJ's version plus credible counting and the per-target flood limit ─
-- Everything else is exactly as in part DJ (snapshot, reporter reliability, rules, deadline, child-safety fast lane).
CREATE OR REPLACE FUNCTION public.report_prepare()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_open integer;
  v_up integer;
  v_dis integer;
  v_rule record;
  v_author uuid;
  v_is_system boolean;
  v_cred boolean;
  v_flood boolean;
  c_target_hourly_limit CONSTANT integer := 10;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      NEW.due_at := LEAST(COALESCE(OLD.due_at, 'infinity'::timestamptz), now() + public.report_due_interval(NEW.priority));
    END IF;
    RETURN NEW;
  END IF;

  NEW.evidence := public._report_snapshot(NEW.target_type, NEW.target_id);
  v_author := public._report_target_author(NEW.target_type, NEW.target_id);

  v_is_system := NEW.reported_by IS NULL OR COALESCE(NEW.source, 'user') <> 'user';
  -- system cases count as credible (as before); people only when they pass the credibility test
  v_cred := v_is_system OR public.dp_reporter_is_credible(NEW.reported_by);
  IF NOT v_cred THEN NEW.auto_actions := NEW.auto_actions || 'not_credible'; END IF;

  -- flood limit: how many reports did this target get in the last hour (all reporters, this one not yet saved)
  SELECT count(*)::int >= c_target_hourly_limit INTO v_flood FROM public.content_reports r
   WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id AND r.created_at > now() - interval '1 hour';
  IF v_flood THEN NEW.auto_actions := NEW.auto_actions || 'flood_queued'; END IF;

  SELECT count(*) FILTER (WHERE status = 'resolved')::int, count(*) FILTER (WHERE status = 'dismissed')::int
    INTO v_up, v_dis FROM public.content_reports WHERE reported_by = NEW.reported_by AND status IN ('resolved', 'dismissed');
  IF v_flood THEN
    NULL; -- queued: priority stays as it came in
  ELSIF v_up + v_dis >= 5 AND v_up::numeric / (v_up + v_dis) >= 0.8 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := CASE WHEN NEW.priority = 'low' THEN 'medium' ELSE 'high' END;
    NEW.auto_actions := NEW.auto_actions || 'trusted_reporter';
  ELSIF v_dis >= 8 AND v_up::numeric / GREATEST(v_up + v_dis, 1) <= 0.1 THEN
    NEW.priority := 'low';
    NEW.auto_actions := NEW.auto_actions || 'low_reliability';
  END IF;

  -- how many independent CREDIBLE sources (this report included, if it is credible) have an open report on the same thing
  v_open := public.dp_credible_reporter_count(NEW.target_type, NEW.target_id, NEW.reported_by, v_is_system);
  IF v_flood OR NOT v_cred THEN
    NULL; -- queued or not credible: stored and visible to staff, but no escalation
  ELSIF v_open >= 5 AND public.report_priority_rank(NEW.priority) < 4 THEN
    NEW.priority := 'urgent';
  ELSIF v_open >= 3 AND public.report_priority_rank(NEW.priority) < 3 THEN
    NEW.priority := 'high';
  END IF;

  SELECT * INTO v_rule FROM public._apply_rules(NEW.target_type, NEW.reason, v_open, NEW.evidence, v_author);
  IF NOT v_flood AND v_rule.o_priority IS NOT NULL AND public.report_priority_rank(v_rule.o_priority) > public.report_priority_rank(NEW.priority) THEN
    NEW.priority := v_rule.o_priority;
  END IF;
  -- an automatic hide (soft, reversible: see the header) needs a credible reporter and no flood
  IF v_rule.o_hide AND v_cred AND NOT v_flood THEN NEW.auto_actions := NEW.auto_actions || 'hide'; END IF;
  IF array_length(v_rule.o_names, 1) > 0 THEN NEW.auto_actions := NEW.auto_actions || ('rule:' || array_to_string(v_rule.o_names, ', ')); END IF;

  NEW.due_at := now() + public.report_due_interval(NEW.priority);

  -- the fast lane overrides everything above, including a low-reliability reporter
  IF NEW.reason = 'child_safety' THEN
    NEW.fast_lane := true;
    NEW.priority := 'urgent';
    NEW.status := 'pending';
    IF NOT ('hide' = ANY (NEW.auto_actions)) THEN NEW.auto_actions := NEW.auto_actions || 'hide'; END IF;
    NEW.auto_actions := array_remove(NEW.auto_actions, 'low_reliability') || 'child_safety';
    NEW.due_at := now() + interval '15 minutes';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. assert that everything was created before committing ────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.dp_report_target_author(text, text)') IS NULL
     OR to_regprocedure('public.dp_reporter_is_credible(uuid)') IS NULL
     OR to_regprocedure('public.dp_credible_reporter_count(text, text, uuid, boolean)') IS NULL
     OR to_regprocedure('public.dp_report_own_content_guard()') IS NULL THEN
    RAISE EXCEPTION 'Part DP did not install completely.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.content_reports'::regclass AND tgname = 'b_dp_report_own_content_guard') THEN
    RAISE EXCEPTION 'Trigger b_dp_report_own_content_guard is missing.';
  END IF;
END $$;

COMMIT;

-- ── POST-CHECK (read only: run after the part; they change nothing) ─────────────────────────────
--   -- a) both guards and the prepare trigger exist, in firing order (expect b_dj..., b_dp..., trg_report_prepare)
--   select tgname from pg_trigger where tgrelid = 'public.content_reports'::regclass and not tgisinternal order by tgname;
--   -- b) report_prepare is the new one (expect true, true, true)
--   select prosrc like '%dp_credible_reporter_count%', prosrc like '%flood_queued%', prosrc like '%child_safety%'
--     from pg_proc where proname = 'report_prepare' and pronamespace = 'public'::regnamespace;
--   -- c) author lookup works for each type (expect a uuid per row where such a record exists; message stays null)
--   select 'announcement', public.dp_report_target_author('announcement', (select id::text from public.announcements limit 1))
--   union all select 'review',           public.dp_report_target_author('review', (select id::text from public.film_reviews limit 1))
--   union all select 'cinema',           public.dp_report_target_author('cinema', (select id::text from public.platform_cinema limit 1))
--   union all select 'pitch_call',       public.dp_report_target_author('pitch_call', (select id::text from public.pitch_calls limit 1))
--   union all select 'pitch_submission', public.dp_report_target_author('pitch_submission', (select id::text from public.pitch_submissions limit 1))
--   union all select 'message (expect null)', public.dp_report_target_author('message', gen_random_uuid()::text);
--   -- d) how many accounts currently count as credible (a very small number means the thresholds are too strict)
--   select count(*) filter (where public.dp_reporter_is_credible(id)) as credible, count(*) as accounts from public.profiles;
--   -- e) every automatic hide is still reversible: both lists should be empty
--   select id from public.posts where auto_hidden_at is not null and auto_hidden_prev_audience is null;
--   select a.target_id from public.audit_logs a where a.action = 'auto_hide' and a.target_type not in ('post', 'comment');
--   -- f) new automatic tags are being written (after some real reports): flood_queued, not_credible
--   select unnest(auto_actions) as tag, count(*) from public.content_reports where created_at > now() - interval '7 days' group by 1 order by 2 desc;
--   -- g) open targets and how many people versus credible sources they have
--   select target_type, target_id, count(distinct reported_by) as people,
--          public.dp_credible_reporter_count(target_type, target_id, null, false) as credible_sources
--     from public.content_reports where status in ('pending', 'reviewing') group by 1, 2 having count(distinct reported_by) >= 3;
