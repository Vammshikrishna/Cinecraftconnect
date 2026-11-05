-- Part GH (duplicates): a moderator can mark a report case as a duplicate of another open case. Safe to run more than once.
--
-- WHAT IT ADDS
--   * content_reports.duplicate_of      the primary case a duplicate points to (null for normal cases)
--   * moderator_mark_duplicate(report, primary, note)   closes the duplicate (status dismissed, note "Duplicate of #xxxxxxxx") with a link to the
--       primary. Same rules as the other case actions: staff only, not while another moderator holds the case (admins may step in),
--       both cases must be open, a child-safety fast-lane case can only be closed by an admin. Written to the audit log on both cases.
--   * mod_find_open_cases(query, exclude)    finds open cases to point at (by id start or reason words); no names, no message text.
--   * close_duplicate_reports() is replaced so a case closed as a duplicate does NOT also close the primary when both are about the same thing.
-- The web app keeps working before this is applied: the "Mark as duplicate" button shows a short note.
-- Needs part_ga_mod_tools.sql first (claim lock, close_duplicate_reports).
--
-- PREFLIGHT (read only, one row, all true):
--   select to_regprocedure('public.mod_claim_held_by_other(public.content_reports,uuid,integer)') is not null as ga_lock,
--          to_regprocedure('public.close_duplicate_reports()') is not null as ga_trigger, to_regprocedure('public.staff_rank(uuid)') is not null as rank,
--          to_regprocedure('public.is_current_user_internal()') is not null as internal;
-- POST-CHECK (read only):
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'content_reports' and column_name = 'duplicate_of';  -- 1 row
--   select proname from pg_proc where proname in ('moderator_mark_duplicate', 'mod_find_open_cases');   -- 2 rows

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS duplicate_of uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_reports_duplicate_of_fkey') THEN
    ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_duplicate_of_fkey
      FOREIGN KEY (duplicate_of) REFERENCES public.content_reports(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_reports_duplicate_not_self') THEN
    ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_duplicate_not_self CHECK (duplicate_of IS NULL OR duplicate_of <> id) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_content_reports_duplicate_of ON public.content_reports (duplicate_of) WHERE duplicate_of IS NOT NULL;

-- the existing "close the other open reports about the same thing" trigger must leave the primary alone
CREATE OR REPLACE FUNCTION public.close_duplicate_reports()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.duplicate_of IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF NEW.status IN ('resolved', 'dismissed') AND OLD.status IN ('pending', 'reviewing') THEN
    UPDATE public.content_reports d
       SET status = NEW.status, reviewed_by = NEW.reviewed_by, reviewed_at = COALESCE(NEW.reviewed_at, now()),
           resolution_note = COALESCE(NEW.resolution_note, NEW.status)
     WHERE d.id <> NEW.id AND d.target_type = NEW.target_type AND d.target_id = NEW.target_id
       AND d.status IN ('pending', 'reviewing');
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.close_duplicate_reports() FROM PUBLIC, anon, authenticated;

-- ── mark as duplicate ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.moderator_mark_duplicate(p_report_id uuid, p_primary_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_dup public.content_reports%ROWTYPE;
  v_pri public.content_reports%ROWTYPE;
  v_note text := left(btrim(COALESCE(p_note, '')), 300);
  v_msg text;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_report_id IS NULL OR p_primary_id IS NULL OR p_report_id = p_primary_id THEN
    RAISE EXCEPTION 'Choose a different case to point to';
  END IF;
  SELECT * INTO v_dup FROM public.content_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  SELECT * INTO v_pri FROM public.content_reports WHERE id = p_primary_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The other case was not found'; END IF;
  IF v_dup.status NOT IN ('pending', 'reviewing') THEN RAISE EXCEPTION 'This report has already been closed'; END IF;
  IF v_pri.status NOT IN ('pending', 'reviewing') THEN RAISE EXCEPTION 'The other case is already closed. Pick an open case'; END IF;
  IF v_pri.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'The other case is itself a duplicate'; END IF;
  IF public.mod_claim_held_by_other(v_dup, auth.uid()) AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'This case is being handled by another moderator. Ask them to hand it over, or wait until it frees up.';
  END IF;
  IF COALESCE(to_jsonb(v_dup) ->> 'fast_lane', 'false') = 'true' AND public.staff_rank(auth.uid()) < 2 THEN
    RAISE EXCEPTION 'Child-safety cases can only be closed by an admin';
  END IF;

  v_msg := 'Duplicate of #' || left(p_primary_id::text, 8) || CASE WHEN v_note <> '' THEN ': ' || v_note ELSE '' END;
  -- duplicates already pointing at this case now point at the primary
  UPDATE public.content_reports SET duplicate_of = p_primary_id WHERE duplicate_of = p_report_id;
  UPDATE public.content_reports
     SET duplicate_of = p_primary_id, status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(),
         resolution_note = v_msg, last_activity_at = now()
   WHERE id = p_report_id;
  UPDATE public.content_reports SET last_activity_at = now() WHERE id = p_primary_id AND assigned_to IS NOT NULL;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'report_duplicate', 'content_report', p_report_id::text,
          jsonb_build_object('primary', p_primary_id, 'note', v_msg)),
         (auth.uid(), 'moderator', 'report_duplicate_received', 'content_report', p_primary_id::text,
          jsonb_build_object('duplicate', p_report_id, 'note', 'Case #' || left(p_report_id::text, 8) || ' marked as a duplicate of this one'));
  RETURN jsonb_build_object('success', true, 'primary', p_primary_id);
END;
$$;
REVOKE ALL ON FUNCTION app_private.moderator_mark_duplicate(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.moderator_mark_duplicate(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.moderator_mark_duplicate(p_report_id uuid, p_primary_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$
  SELECT app_private.moderator_mark_duplicate(p_report_id, p_primary_id, p_note);
$$;
REVOKE ALL ON FUNCTION public.moderator_mark_duplicate(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_mark_duplicate(uuid, uuid, text) TO authenticated, service_role;

-- ── find an open case to point at ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.mod_find_open_cases(p_query text, p_exclude uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_q text := replace(replace(replace(lower(btrim(COALESCE(p_query, ''))), '\', ''), '%', ''), '_', '');
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF length(v_q) < 2 THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_out FROM (
    SELECT r.id, r.target_type, r.reason, r.priority, r.status, r.created_at
      FROM public.content_reports r
     WHERE r.status IN ('pending', 'reviewing') AND r.duplicate_of IS NULL
       AND (p_exclude IS NULL OR r.id <> p_exclude)
       AND (r.id::text LIKE v_q || '%' OR lower(COALESCE(r.reason, '')) LIKE '%' || v_q || '%' OR lower(r.target_type) LIKE v_q || '%')
     ORDER BY r.created_at DESC
     LIMIT 8
  ) x;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_find_open_cases(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_find_open_cases(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mod_find_open_cases(p_query text, p_exclude uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$
  SELECT app_private.mod_find_open_cases(p_query, p_exclude);
$$;
REVOKE ALL ON FUNCTION public.mod_find_open_cases(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_find_open_cases(text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
