-- PART AV: Pitch + Story Exchange security and integrity. Run after part AU, then deploy the new web + mobile builds.
-- See docs/PITCH.md.
BEGIN;

-- ── 0. helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
-- RLS between pitch_calls and pitch_submissions would recurse; this lets a writer see the calls they pitched to.
CREATE OR REPLACE FUNCTION public.pitch_call_has_my_submission(p_call uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pitch_submissions s WHERE s.pitch_call_id = p_call AND s.submitter_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.pitch_is_blocked(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.user_id = p_a AND b.blocked_user_id = p_b) OR (b.user_id = p_b AND b.blocked_user_id = p_a)
  );
$$;

-- ── 1. pitch_calls ────────────────────────────────────────────────────────────────────────────────────────────────
-- Anyone could insert a call with someone else's creator_id ("catcher briefs"). The owner policy already covers
-- the creator's own inserts, so the loose one goes; direct pitches now use submit_direct_pitch_call().
DROP POLICY IF EXISTS "Allow authenticated users to insert catcher briefs" ON public.pitch_calls;

DROP POLICY IF EXISTS "Submitters can see calls they pitched to" ON public.pitch_calls;
CREATE POLICY "Submitters can see calls they pitched to" ON public.pitch_calls
  FOR SELECT USING (public.pitch_call_has_my_submission(id));

CREATE OR REPLACE FUNCTION public.pitch_call_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new jsonb := CASE WHEN jsonb_typeof(NEW.attachments) = 'object' THEN NEW.attachments ELSE '{}'::jsonb END;
  v_old jsonb;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.creator_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only post pitch calls as yourself' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.pitch_calls WHERE creator_id = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
      RAISE EXCEPTION 'You can post up to 10 pitch calls a day' USING ERRCODE = 'P0001';
    END IF;
    NEW.view_count := 0;
    IF v_new ? 'is_direct_catcher' OR v_new ? 'target_producer_id' OR v_new ? 'sender_id' THEN
      RAISE EXCEPTION 'Direct pitches are sent from the producer''s profile' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_old := CASE WHEN jsonb_typeof(OLD.attachments) = 'object' THEN OLD.attachments ELSE '{}'::jsonb END;
  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
    RAISE EXCEPTION 'A pitch call cannot change owner' USING ERRCODE = 'P0001';
  END IF;
  NEW.view_count := OLD.view_count;
  IF (v_new -> 'is_direct_catcher') IS DISTINCT FROM (v_old -> 'is_direct_catcher')
     OR (v_new -> 'target_producer_id') IS DISTINCT FROM (v_old -> 'target_producer_id')
     OR (v_new -> 'sender_id') IS DISTINCT FROM (v_old -> 'sender_id') THEN
    RAISE EXCEPTION 'Direct pitch details cannot be changed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pitch_call_guard ON public.pitch_calls;
CREATE TRIGGER pitch_call_guard BEFORE INSERT OR UPDATE ON public.pitch_calls
  FOR EACH ROW EXECUTE FUNCTION public.pitch_call_guard();

-- Direct pitch: creates the private brief that holds the submission. Returns the call id.
CREATE OR REPLACE FUNCTION public.submit_direct_pitch_call(p_producer_id uuid, p_title text DEFAULT NULL, p_producer_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = 'P0001'; END IF;
  IF p_producer_id IS NULL OR p_producer_id = v_me THEN
    RAISE EXCEPTION 'Choose someone else to pitch to' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_producer_id) THEN
    RAISE EXCEPTION 'That person was not found' USING ERRCODE = 'P0001';
  END IF;
  IF public.pitch_is_blocked(v_me, p_producer_id) THEN
    RAISE EXCEPTION 'You cannot pitch to this person' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.pitch_calls
        WHERE attachments->>'sender_id' = v_me::text AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You can send up to 5 direct pitches a day' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.market_system', '1', true);
  INSERT INTO public.pitch_calls (creator_id, title, project_type, requirement_description, status, is_published, nda_required, attachments)
  VALUES (
    p_producer_id,
    left('Direct Pitch: ' || COALESCE(NULLIF(trim(p_title), ''), 'New Concept'), 200),
    'other',
    'Confidential direct concept submission brief.',
    'open',
    false,
    true,
    jsonb_build_object('is_direct_catcher', true, 'target_producer_id', p_producer_id,
                       'target_producer_name', COALESCE(left(p_producer_name, 120), 'Producer'), 'sender_id', v_me)
  )
  RETURNING id INTO v_id;
  PERFORM set_config('app.market_system', '', true);
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_direct_pitch_call(uuid, text, text) TO authenticated;

-- Calls whose deadline has passed close by themselves (clients call this when they load the list).
CREATE OR REPLACE FUNCTION public.close_expired_pitch_calls()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.pitch_calls SET status = 'expired', updated_at = now()
   WHERE status = 'open' AND deadline IS NOT NULL AND deadline < current_date;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.market_system', '', true);
  RETURN v_n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_expired_pitch_calls() TO authenticated;

-- ── 2. pitch_call_views: only through the function (no forged viewers, one count per person per 12h) ─────────────
DROP POLICY IF EXISTS "Log new views" ON public.pitch_call_views;

CREATE OR REPLACE FUNCTION public.log_pitch_call_view(p_call uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_call IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pitch_calls c WHERE c.id = p_call AND c.creator_id <> v_me AND c.is_published = true) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pitch_call_views v WHERE v.pitch_call_id = p_call AND v.viewer_id = v_me AND v.viewed_at > now() - interval '12 hours') THEN
    RETURN;
  END IF;
  INSERT INTO public.pitch_call_views (pitch_call_id, viewer_id) VALUES (p_call, v_me);
  PERFORM set_config('app.market_system', '1', true);
  UPDATE public.pitch_calls SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_call;
  PERFORM set_config('app.market_system', '', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_pitch_call_view(uuid) TO authenticated;

-- ── 3. pitch_submissions ──────────────────────────────────────────────────────────────────────────────────────────
-- 3a. what a submission may be created with
CREATE OR REPLACE FUNCTION public.pitch_submission_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.pitch_calls%ROWTYPE;
  v_att jsonb;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF NEW.submitter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit pitches as yourself' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO c FROM public.pitch_calls WHERE id = NEW.pitch_call_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That pitch call no longer exists' USING ERRCODE = 'P0001';
  END IF;
  IF c.creator_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot pitch to your own call' USING ERRCODE = 'P0001';
  END IF;
  v_att := CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ELSE '{}'::jsonb END;
  IF COALESCE(c.status, 'open') <> 'open' OR (c.deadline IS NOT NULL AND c.deadline < current_date) THEN
    RAISE EXCEPTION 'This pitch call is closed' USING ERRCODE = 'P0001';
  END IF;
  IF (v_att ->> 'is_direct_catcher') = 'true' THEN
    IF (v_att ->> 'sender_id') IS DISTINCT FROM auth.uid()::text THEN
      RAISE EXCEPTION 'This direct pitch belongs to someone else' USING ERRCODE = 'P0001';
    END IF;
  ELSIF c.is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'This pitch call is not open' USING ERRCODE = 'P0001';
  END IF;
  IF public.pitch_is_blocked(auth.uid(), c.creator_id) THEN
    RAISE EXCEPTION 'You cannot pitch to this person' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.pitch_submissions WHERE submitter_id = auth.uid() AND submitted_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'You can send up to 20 pitches a day' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(c.nda_required, false) AND length(trim(COALESCE(NEW.nda_signature, ''))) < 3 THEN
    RAISE EXCEPTION 'This call needs your NDA signature' USING ERRCODE = 'P0001';
  END IF;

  -- the review state and the signing time are the server's to set
  NEW.status := 'submitted';
  NEW.seen_at := NULL; NEW.reviewed_at := NULL; NEW.shortlisted_at := NULL; NEW.passed_at := NULL;
  NEW.submitted_at := now();
  NEW.nda_signed_at := CASE WHEN length(trim(COALESCE(NEW.nda_signature, ''))) > 0 THEN now() ELSE NULL END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pitch_submission_insert_guard ON public.pitch_submissions;
CREATE TRIGGER pitch_submission_insert_guard BEFORE INSERT ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pitch_submission_insert_guard();

-- 3b. what each side may change afterwards: the writer edits the pitch (never the review state or the NDA),
--     the call owner changes the review state (never the writer's words).
CREATE OR REPLACE FUNCTION public.pitch_submission_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean;
  v_review constant text[] := ARRAY['status', 'seen_at', 'reviewed_at', 'shortlisted_at', 'passed_at', 'updated_at'];
  v_content constant text[] := ARRAY['title', 'logline', 'short_synopsis', 'full_synopsis', 'genre', 'format', 'language', 'tone',
    'why_fits', 'rights_owned', 'is_original_work', 'treatment_url', 'lookbook_url', 'moodboard_url', 'character_notes',
    'pilot_outline', 'reference_links', 'guild_registration_number', 'nda_preferred', 'attachments', 'updated_at'];
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  SELECT (c.creator_id = auth.uid()) INTO v_owner FROM public.pitch_calls c WHERE c.id = OLD.pitch_call_id;

  IF COALESCE(v_owner, false) THEN
    IF (to_jsonb(NEW) - v_review) IS DISTINCT FROM (to_jsonb(OLD) - v_review) THEN
      RAISE EXCEPTION 'A pitch call owner can only change the review status' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.submitter_id = auth.uid() THEN
    IF OLD.status IN ('submitted', 'seen') THEN
      -- full_deck_url stays editable in every state (it is uploaded after a deck is requested)
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
DROP TRIGGER IF EXISTS pitch_submission_update_guard ON public.pitch_submissions;
CREATE TRIGGER pitch_submission_update_guard BEFORE UPDATE ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pitch_submission_update_guard();

-- 3c. the call owner hears about a new pitch (status changes already notify the writer)
CREATE OR REPLACE FUNCTION public.notify_pitch_submission_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.pitch_calls%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.pitch_calls WHERE id = NEW.pitch_call_id;
  IF NOT FOUND OR c.creator_id IS NULL OR c.creator_id = NEW.submitter_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
  VALUES (
    c.creator_id, NEW.submitter_id, 'pitch_submission_received',
    CASE WHEN (CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ->> 'is_direct_catcher' END) = 'true'
         THEN 'New direct pitch' ELSE 'New pitch received' END,
    'A writer sent "' || left(COALESCE(NEW.title, 'a story'), 80) || '"' ||
      CASE WHEN (CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ->> 'is_direct_catcher' END) = 'true'
           THEN '.' ELSE ' to "' || left(c.title, 80) || '".' END,
    '/pitch/submission/' || NEW.id || '/review', NEW.id,
    jsonb_build_object('pitch_call_id', NEW.pitch_call_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- a notification problem must never block a submission
END;
$$;
DROP TRIGGER IF EXISTS notify_pitch_submission_received ON public.pitch_submissions;
CREATE TRIGGER notify_pitch_submission_received AFTER INSERT ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_pitch_submission_received();

-- ── 4. access logs and viewer NDA signatures: only people who belong to the submission ─────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own access logs" ON public.pitch_access_logs;
CREATE POLICY "Users can insert their own access logs" ON public.pitch_access_logs
  FOR INSERT WITH CHECK (
    accessed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pitch_submissions s
      JOIN public.pitch_calls c ON c.id = s.pitch_call_id
      WHERE s.id = pitch_access_logs.pitch_submission_id
        AND (c.creator_id = auth.uid() OR s.submitter_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Call creators can sign NDAs" ON public.nda_viewer_signatures;
CREATE POLICY "Call creators can sign NDAs" ON public.nda_viewer_signatures
  FOR INSERT WITH CHECK (
    signed_by = auth.uid()
    AND length(trim(signature)) >= 3
    AND EXISTS (
      SELECT 1 FROM public.pitch_submissions s
      JOIN public.pitch_calls c ON c.id = s.pitch_call_id
      WHERE s.id = nda_viewer_signatures.pitch_submission_id AND c.creator_id = auth.uid()
    )
  );

-- ── 5. Story Exchange ─────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.story_interests ADD COLUMN IF NOT EXISTS nda_signature text;

-- 5a. the full synopsis leaves the table's public columns; it is read only through get_story_full_synopsis()
REVOKE SELECT ON public.story_listings FROM anon, authenticated;
GRANT SELECT (id, created_at, updated_at, creator_id, title, logline, synopsis_teaser, genre, format, language, tone,
              stage, asking_deal, nda_required, is_published)
  ON public.story_listings TO authenticated;

DROP POLICY IF EXISTS "Story listings are visible to authenticated users" ON public.story_listings;
CREATE POLICY "Story listings are visible to authenticated users" ON public.story_listings
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_published = true OR creator_id = auth.uid()));

-- realtime broadcasts whole rows: publish the same columns only (PostgreSQL 15+), else stop publishing the table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.story_listings;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_listings
      (id, created_at, updated_at, creator_id, title, logline, synopsis_teaser, genre, format, language, tone,
       stage, asking_deal, nda_required, is_published);
  EXCEPTION WHEN OTHERS THEN NULL; -- older server: the table is simply not published any more
  END;
END $$;

CREATE OR REPLACE FUNCTION public.get_story_full_synopsis(p_story uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.story_listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.story_listings WHERE id = p_story;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF s.creator_id = auth.uid() OR public.is_current_user_internal() THEN
    RETURN s.synopsis_full;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.story_interests i
    WHERE i.story_id = p_story AND i.interested_by = auth.uid() AND i.status = 'approved'
      AND (NOT COALESCE(s.nda_required, false) OR i.nda_signed_at IS NOT NULL)
  ) THEN
    RETURN s.synopsis_full;
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_story_full_synopsis(uuid) TO authenticated;

-- 5b. interest requests: always start pending, the NDA time is the server's, only the writer decides
CREATE OR REPLACE FUNCTION public.story_interest_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.story_listings%ROWTYPE;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO s FROM public.story_listings WHERE id = NEW.story_id;
    IF NOT FOUND OR s.is_published IS NOT TRUE THEN
      RAISE EXCEPTION 'That story is not available' USING ERRCODE = 'P0001';
    END IF;
    IF s.creator_id = auth.uid() THEN
      RAISE EXCEPTION 'This is your own story' USING ERRCODE = 'P0001';
    END IF;
    IF public.pitch_is_blocked(auth.uid(), s.creator_id) THEN
      RAISE EXCEPTION 'You cannot request this story' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(s.nda_required, false) AND length(trim(COALESCE(NEW.nda_signature, ''))) < 3 THEN
      RAISE EXCEPTION 'This story needs your NDA signature' USING ERRCODE = 'P0001';
    END IF;
    NEW.status := 'pending';
    NEW.nda_signed_at := CASE WHEN length(trim(COALESCE(NEW.nda_signature, ''))) > 0 THEN now() ELSE NULL END;
    RETURN NEW;
  END IF;

  -- UPDATE: only the status can change, and only to a value the writer may choose
  IF NEW.story_id IS DISTINCT FROM OLD.story_id OR NEW.interested_by IS DISTINCT FROM OLD.interested_by
     OR NEW.nda_signed_at IS DISTINCT FROM OLD.nda_signed_at OR NEW.nda_signature IS DISTINCT FROM OLD.nda_signature THEN
    RAISE EXCEPTION 'Only the decision can be changed' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'declined') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS story_interest_guard ON public.story_interests;
CREATE TRIGGER story_interest_guard BEFORE INSERT OR UPDATE ON public.story_interests
  FOR EACH ROW EXECUTE FUNCTION public.story_interest_guard();

-- 5c. notifications both ways
CREATE OR REPLACE FUNCTION public.notify_story_interest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.story_listings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.story_listings WHERE id = NEW.story_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
    VALUES (s.creator_id, NEW.interested_by, 'story_interest_request', 'Someone wants to read your story',
            'A producer asked to unlock "' || left(s.title, 80) || '".', '/pitch?tab=stories', NEW.id,
            jsonb_build_object('story_id', NEW.story_id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'declined') THEN
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, metadata)
    VALUES (NEW.interested_by, s.creator_id, 'story_interest_' || NEW.status,
            CASE WHEN NEW.status = 'approved' THEN 'Story unlocked' ELSE 'Request declined' END,
            CASE WHEN NEW.status = 'approved'
                 THEN 'The writer approved your request. You can read the full synopsis of "' || left(s.title, 80) || '".'
                 ELSE 'The writer declined your request for "' || left(s.title, 80) || '".' END,
            '/pitch?tab=stories', NEW.id, jsonb_build_object('story_id', NEW.story_id));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_story_interest ON public.story_interests;
CREATE TRIGGER notify_story_interest AFTER INSERT OR UPDATE ON public.story_interests
  FOR EACH ROW EXECUTE FUNCTION public.notify_story_interest();

-- ── 6. existing direct briefs go private (their writer keeps access through the submission) ─────────────────────────
SELECT set_config('app.market_system', '1', true);
UPDATE public.pitch_calls
   SET is_published = false,
       attachments = attachments || jsonb_build_object('sender_id', (
         SELECT s.submitter_id::text FROM public.pitch_submissions s WHERE s.pitch_call_id = pitch_calls.id ORDER BY s.created_at LIMIT 1))
 WHERE jsonb_typeof(attachments) = 'object' AND attachments->>'is_direct_catcher' = 'true'
   AND EXISTS (SELECT 1 FROM public.pitch_submissions s WHERE s.pitch_call_id = pitch_calls.id);
SELECT set_config('app.market_system', '', true);

COMMIT;
