-- PART FP (reports) - fix "column created_at does not exist" when ANY report is sent (listing, user, post ...: POST /rest/v1/content_reports returns 400). Safe to run more than once.
--
-- WHAT WENT WRONG: the rule engine _apply_rules (part BM) works out the author's account age with "SELECT created_at FROM public.profiles". The profiles table has NO
-- created_at column (the sign-up date is auth.users.created_at), so the report trigger fails and nobody can report anything. Found by testing Report on a marketplace listing and on a profile.
-- THE FIX: recreate _apply_rules reading the age from auth.users (same logic, same results).
--
-- PREFLIGHT (read only): select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at';   -- 0 rows
-- POST-CHECK (read only): send a report on any listing or profile: the dialog closes and select count(*) from public.content_reports returns one more row.

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
  -- profiles has no created_at: the account age is the sign-up date in auth.users
  SELECT GREATEST(0, (extract(epoch FROM (now() - u.created_at)) / 86400)::int) INTO v_age FROM auth.users u WHERE u.id = p_author;
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
