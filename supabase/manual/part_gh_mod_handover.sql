-- Part GH (handover): shift handover notes for the moderation team. Safe to run more than once.
--
-- WHAT IT ADDS (staff only; nobody else can read or write these tables)
--   * mod_handover_notes   one free-text note (1 to 1000 characters) with up to 10 linked case ids
--   * mod_handover_reads   who has read which note (the "read by" marker)
--   * mod_handover_list(limit)            recent notes (last 30 days), newest first, with author name, time, read-by names, and whether you may still edit
--   * mod_handover_add(body, case_ids)    at most 10 notes per hour per person; case ids must exist; written to the audit log
--   * mod_handover_edit(id, body, case_ids) / mod_handover_delete(id)   only your own note, only within 15 minutes of writing it
--   * mod_handover_mark_read(ids)         marks notes as read by you
-- The notes hold text and case ids only. Tell people in the UI not to put names, emails or phone numbers in them.
-- The web app keeps working before this is applied: the Handover panel shows a short note.
--
-- PREFLIGHT (read only, one row, all true):
--   select to_regprocedure('public.staff_rank(uuid)') is not null as rank, to_regprocedure('public.is_current_user_internal()') is not null as internal,
--          to_regclass('public.content_reports') is not null as reports, to_regclass('public.audit_logs') is not null as audit;
-- POST-CHECK (read only):
--   select relname, relrowsecurity from pg_class where relname in ('mod_handover_notes', 'mod_handover_reads');   -- 2 rows, both true
--   select proname from pg_proc where proname like 'mod_handover_%';   -- 5 rows (the public wrappers)

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.mod_handover_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  case_ids   uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(case_ids) <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mod_handover_notes_created ON public.mod_handover_notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_handover_notes_author ON public.mod_handover_notes (author_id);

CREATE TABLE IF NOT EXISTS public.mod_handover_reads (
  note_id uuid NOT NULL REFERENCES public.mod_handover_notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mod_handover_reads_user ON public.mod_handover_reads (user_id);

-- RLS on with no policies: the tables are reachable only through the functions below
ALTER TABLE public.mod_handover_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mod_handover_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mod_handover_notes, public.mod_handover_reads FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.mod_handover_guard()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR public.staff_rank(auth.uid()) < 1 OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_guard() FROM PUBLIC, anon, authenticated;

-- keeps only case ids that exist (and drops repeats)
CREATE OR REPLACE FUNCTION app_private.mod_handover_clean_ids(p_ids uuid[])
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(array_agg(DISTINCT r.id), '{}'::uuid[])
    FROM public.content_reports r WHERE r.id = ANY ((COALESCE(p_ids, '{}'::uuid[]))[1:10]);
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_clean_ids(uuid[]) FROM PUBLIC, anon, authenticated;

-- ── list ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.mod_handover_list(p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_out jsonb;
BEGIN
  PERFORM app_private.mod_handover_guard();
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', n.id, 'author', COALESCE(p.username, 'staff'), 'body', n.body, 'case_ids', n.case_ids,
           'created_at', n.created_at, 'edited_at', n.edited_at,
           'mine', n.author_id = auth.uid(),
           'can_edit', n.author_id = auth.uid() AND n.created_at > now() - interval '15 minutes',
           'read_by_me', n.author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.mod_handover_reads r WHERE r.note_id = n.id AND r.user_id = auth.uid()),
           'read_by', COALESCE((SELECT jsonb_agg(rp.username ORDER BY r.read_at) FROM public.mod_handover_reads r
                                  JOIN public.profiles rp ON rp.id = r.user_id WHERE r.note_id = n.id), '[]'::jsonb)
         ) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO v_out
    FROM (SELECT * FROM public.mod_handover_notes WHERE created_at > now() - interval '30 days'
           ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))) n
    LEFT JOIN public.profiles p ON p.id = n.author_id;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_list(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_handover_list(integer) TO authenticated, service_role;

-- ── add ─────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.mod_handover_add(p_body text, p_case_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_body text := btrim(COALESCE(p_body, ''));
  v_ids uuid[];
  v_id uuid;
BEGIN
  PERFORM app_private.mod_handover_guard();
  IF length(v_body) < 1 THEN RAISE EXCEPTION 'Write a note first'; END IF;
  IF length(v_body) > 1000 THEN RAISE EXCEPTION 'Keep the note to 1000 characters or less'; END IF;
  IF (SELECT count(*) FROM public.mod_handover_notes WHERE author_id = auth.uid() AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'You have written 10 notes in the last hour. Wait a little before adding more';
  END IF;
  v_ids := app_private.mod_handover_clean_ids(p_case_ids);
  INSERT INTO public.mod_handover_notes (author_id, body, case_ids) VALUES (auth.uid(), v_body, v_ids) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'handover_note_add', 'handover_note', v_id::text, jsonb_build_object('cases', cardinality(v_ids)));
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_add(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_handover_add(text, uuid[]) TO authenticated, service_role;

-- ── edit / delete (own note, first 15 minutes) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.mod_handover_edit(p_id uuid, p_body text, p_case_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_body text := btrim(COALESCE(p_body, ''));
  v_n public.mod_handover_notes%ROWTYPE;
BEGIN
  PERFORM app_private.mod_handover_guard();
  IF length(v_body) < 1 THEN RAISE EXCEPTION 'Write a note first'; END IF;
  IF length(v_body) > 1000 THEN RAISE EXCEPTION 'Keep the note to 1000 characters or less'; END IF;
  SELECT * INTO v_n FROM public.mod_handover_notes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_n.author_id <> auth.uid() THEN RAISE EXCEPTION 'You can only change your own notes'; END IF;
  IF v_n.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Notes can only be changed in the first 15 minutes'; END IF;
  UPDATE public.mod_handover_notes SET body = v_body, case_ids = app_private.mod_handover_clean_ids(p_case_ids), edited_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_edit(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_handover_edit(uuid, text, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.mod_handover_delete(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n public.mod_handover_notes%ROWTYPE;
BEGIN
  PERFORM app_private.mod_handover_guard();
  SELECT * INTO v_n FROM public.mod_handover_notes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_n.author_id <> auth.uid() THEN RAISE EXCEPTION 'You can only delete your own notes'; END IF;
  IF v_n.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Notes can only be deleted in the first 15 minutes'; END IF;
  DELETE FROM public.mod_handover_notes WHERE id = p_id;
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'handover_note_delete', 'handover_note', p_id::text, '{}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_handover_delete(uuid) TO authenticated, service_role;

-- ── read marker ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_private.mod_handover_mark_read(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM app_private.mod_handover_guard();
  INSERT INTO public.mod_handover_reads (note_id, user_id)
  SELECT n.id, auth.uid() FROM public.mod_handover_notes n
   WHERE n.id = ANY ((COALESCE(p_ids, '{}'::uuid[]))[1:100]) AND n.author_id <> auth.uid()
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION app_private.mod_handover_mark_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.mod_handover_mark_read(uuid[]) TO authenticated, service_role;

-- ── public wrappers (what the app calls) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mod_handover_list(p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$ SELECT app_private.mod_handover_list(p_limit); $$;
CREATE OR REPLACE FUNCTION public.mod_handover_add(p_body text, p_case_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$ SELECT app_private.mod_handover_add(p_body, p_case_ids); $$;
CREATE OR REPLACE FUNCTION public.mod_handover_edit(p_id uuid, p_body text, p_case_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$ SELECT app_private.mod_handover_edit(p_id, p_body, p_case_ids); $$;
CREATE OR REPLACE FUNCTION public.mod_handover_delete(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$ SELECT app_private.mod_handover_delete(p_id); $$;
CREATE OR REPLACE FUNCTION public.mod_handover_mark_read(p_ids uuid[])
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public, app_private, pg_temp AS $$ SELECT app_private.mod_handover_mark_read(p_ids); $$;

REVOKE ALL ON FUNCTION public.mod_handover_list(integer), public.mod_handover_add(text, uuid[]), public.mod_handover_edit(uuid, text, uuid[]),
  public.mod_handover_delete(uuid), public.mod_handover_mark_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_handover_list(integer), public.mod_handover_add(text, uuid[]), public.mod_handover_edit(uuid, text, uuid[]),
  public.mod_handover_delete(uuid), public.mod_handover_mark_read(uuid[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
