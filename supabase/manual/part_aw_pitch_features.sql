-- PART AW: Pitch features: withdraw a pitch, private notes + rating, feedback to the writer, call stats,
-- "call closed" and "closing soon" notifications. Run after part AV, then deploy the new web + mobile builds.
-- See docs/PITCH.md.
BEGIN;

-- ── 1. columns + the "withdrawn" status ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pitch_submissions
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

ALTER TABLE public.pitch_submissions DROP CONSTRAINT IF EXISTS pitch_submissions_feedback_len;
ALTER TABLE public.pitch_submissions ADD CONSTRAINT pitch_submissions_feedback_len CHECK (feedback IS NULL OR length(feedback) <= 1000);

ALTER TABLE public.pitch_submissions DROP CONSTRAINT IF EXISTS pitch_submissions_status_check;
ALTER TABLE public.pitch_submissions ADD CONSTRAINT pitch_submissions_status_check CHECK (status = ANY (ARRAY[
  'submitted','seen','under_review','shortlisted','interested','request_full_deck','invite_to_discuss','passed','closed','collaborating','withdrawn'
]));

-- ── 2. update guard again: the call owner may also write feedback, and nothing once a pitch is withdrawn ─────────
CREATE OR REPLACE FUNCTION public.pitch_submission_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean;
  v_review constant text[] := ARRAY['status', 'seen_at', 'reviewed_at', 'shortlisted_at', 'passed_at', 'feedback', 'updated_at'];
  v_content constant text[] := ARRAY['title', 'logline', 'short_synopsis', 'full_synopsis', 'genre', 'format', 'language', 'tone',
    'why_fits', 'rights_owned', 'is_original_work', 'treatment_url', 'lookbook_url', 'moodboard_url', 'character_notes',
    'pilot_outline', 'reference_links', 'guild_registration_number', 'nda_preferred', 'attachments', 'updated_at'];
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This pitch was withdrawn' USING ERRCODE = 'P0001';
  END IF;

  SELECT (c.creator_id = auth.uid()) INTO v_owner FROM public.pitch_calls c WHERE c.id = OLD.pitch_call_id;

  IF COALESCE(v_owner, false) THEN
    IF NEW.status = 'withdrawn' THEN
      RAISE EXCEPTION 'Only the writer can withdraw a pitch' USING ERRCODE = 'P0001';
    END IF;
    IF (to_jsonb(NEW) - v_review) IS DISTINCT FROM (to_jsonb(OLD) - v_review) THEN
      RAISE EXCEPTION 'A pitch call owner can only change the review status' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.submitter_id = auth.uid() THEN
    IF OLD.status IN ('submitted', 'seen') THEN
      IF (to_jsonb(NEW) - v_content - 'full_deck_url') IS DISTINCT FROM (to_jsonb(OLD) - v_content - 'full_deck_url') THEN
        RAISE EXCEPTION 'You cannot change the review state or the NDA of a pitch' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF (to_jsonb(NEW) - 'full_deck_url' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'full_deck_url' - 'updated_at') THEN
        RAISE EXCEPTION 'This pitch is under review and can no longer be edited' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'P0001';
END;
$$;

-- a writer who withdrew can pitch to the same call again: the old withdrawn row makes room
CREATE OR REPLACE FUNCTION public.pitch_clear_withdrawn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.pitch_submissions
   WHERE pitch_call_id = NEW.pitch_call_id AND submitter_id = NEW.submitter_id AND status = 'withdrawn';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_pitch_clear_withdrawn ON public.pitch_submissions;
CREATE TRIGGER a_pitch_clear_withdrawn BEFORE INSERT ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pitch_clear_withdrawn();

-- ── 3. withdraw ──────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_pitch_submission(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.pitch_submissions%ROWTYPE;
  v_owner uuid;
BEGIN
  SELECT * INTO s FROM public.pitch_submissions WHERE id = p_id;
  IF NOT FOUND OR s.submitter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Pitch not found' USING ERRCODE = 'P0001';
  END IF;
  IF s.status IN ('withdrawn', 'passed', 'closed', 'collaborating') THEN
    RAISE EXCEPTION 'This pitch can no longer be withdrawn' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.pitch_submissions SET status = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = p_id;
  PERFORM set_config('app.market_system', '', true);

  SELECT creator_id INTO v_owner FROM public.pitch_calls WHERE id = s.pitch_call_id;
  IF v_owner IS NOT NULL AND v_owner <> s.submitter_id THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
    VALUES (v_owner, s.submitter_id, 'pitch_submission_withdrawn', 'A pitch was withdrawn',
            'The writer withdrew "' || left(COALESCE(s.title, 'a story'), 80) || '".',
            '/pitch/submission/' || s.id || '/review', s.id, jsonb_build_object('pitch_call_id', s.pitch_call_id));
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.withdraw_pitch_submission(uuid) TO authenticated;

-- ── 4. private notes and a 1-5 rating (the call owner only; never visible to the writer) ────────────────────────
CREATE TABLE IF NOT EXISTS public.pitch_submission_notes (
  submission_id uuid PRIMARY KEY REFERENCES public.pitch_submissions(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note          text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  rating        smallint CHECK (rating BETWEEN 1 AND 5),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pitch_submission_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their review notes" ON public.pitch_submission_notes;
CREATE POLICY "Owners manage their review notes" ON public.pitch_submission_notes
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pitch_submissions s JOIN public.pitch_calls c ON c.id = s.pitch_call_id
      WHERE s.id = pitch_submission_notes.submission_id AND c.creator_id = auth.uid()
    )
  );

-- ── 5. a message to the writer notifies them ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_pitch_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF NEW.feedback IS NULL OR length(trim(NEW.feedback)) = 0 OR NEW.feedback IS NOT DISTINCT FROM OLD.feedback THEN
    RETURN NEW;
  END IF;
  SELECT creator_id INTO v_owner FROM public.pitch_calls WHERE id = NEW.pitch_call_id;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
  VALUES (NEW.submitter_id, v_owner, 'pitch_feedback', 'Feedback on your pitch',
          'About "' || left(COALESCE(NEW.title, 'your story'), 80) || '": ' || left(NEW.feedback, 200),
          '/pitch/' || NEW.pitch_call_id, NEW.id, jsonb_build_object('pitch_call_id', NEW.pitch_call_id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_pitch_feedback ON public.pitch_submissions;
CREATE TRIGGER notify_pitch_feedback AFTER UPDATE ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_pitch_feedback();

-- ── 6. a call that closes tells the writers still waiting ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_pitch_call_closed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('closed', 'expired') AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(CASE WHEN jsonb_typeof(NEW.attachments) = 'object' THEN NEW.attachments ->> 'is_direct_catcher' END, '') <> 'true' THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
    SELECT s.submitter_id, NEW.creator_id, 'pitch_call_closed', 'A pitch call you entered has closed',
           '"' || left(NEW.title, 80) || '" is no longer taking pitches. Your pitch stays with the producer.',
           '/pitch/' || NEW.id, NEW.id, jsonb_build_object('pitch_call_id', NEW.id)
      FROM public.pitch_submissions s
     WHERE s.pitch_call_id = NEW.id AND s.status IN ('submitted', 'seen', 'under_review');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_pitch_call_closed ON public.pitch_calls;
CREATE TRIGGER notify_pitch_call_closed AFTER UPDATE OF status ON public.pitch_calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_pitch_call_closed();

-- ── 7. closing soon: people who saved a call and have not pitched hear about it the day before ───────────────────
CREATE OR REPLACE FUNCTION public.close_expired_pitch_calls()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.pitch_calls SET status = 'expired', updated_at = now()
   WHERE status = 'open' AND deadline IS NOT NULL AND deadline < current_date;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);

  INSERT INTO public.notifications (user_id, type, title, message, action_url, related_id, metadata)
  SELECT sv.user_id, 'pitch_closing_soon', 'A saved pitch call closes tomorrow',
         '"' || left(c.title, 80) || '" closes tomorrow. Send your pitch before then.',
         '/pitch/' || c.id, c.id, jsonb_build_object('pitch_call_id', c.id)
    FROM public.pitch_calls c
    JOIN public.saved_pitch_calls sv ON sv.pitch_call_id = c.id
   WHERE c.status = 'open' AND c.is_published = true AND c.deadline = current_date + 1
     AND sv.user_id <> c.creator_id
     AND NOT EXISTS (SELECT 1 FROM public.pitch_submissions s WHERE s.pitch_call_id = c.id AND s.submitter_id = sv.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = sv.user_id AND n.type = 'pitch_closing_soon' AND n.related_id = c.id);
  RETURN v_n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_expired_pitch_calls() TO authenticated;

-- ── 8. numbers for the call owner ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pitch_call_stats(p_call uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.pitch_calls%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.pitch_calls WHERE id = p_call;
  IF NOT FOUND OR c.creator_id IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'views', COALESCE(c.view_count, 0),
    'saves', (SELECT count(*) FROM public.saved_pitch_calls WHERE pitch_call_id = p_call),
    'submissions', (SELECT count(*) FROM public.pitch_submissions WHERE pitch_call_id = p_call AND status <> 'withdrawn'),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM (
        SELECT status, count(*) AS n FROM public.pitch_submissions WHERE pitch_call_id = p_call GROUP BY status) t), '{}'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.pitch_call_stats(uuid) TO authenticated;

COMMIT;
