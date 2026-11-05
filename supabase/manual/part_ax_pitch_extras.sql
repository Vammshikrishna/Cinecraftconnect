-- PART AX: Pitch extras: file attachments on a pitch (private bucket), reports on pitch calls and pitches, the NDA record.
-- Run after part AW, then deploy the new web + mobile builds. See docs/PITCH.md.
BEGIN;

-- ── 1. attachments (PDF treatment, lookbook, images; up to 3 per pitch) ──────────────────────────────────────────
ALTER TABLE public.pitch_submissions ADD COLUMN IF NOT EXISTS attachment_paths text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pitch_submissions DROP CONSTRAINT IF EXISTS pitch_submissions_attachment_count;
ALTER TABLE public.pitch_submissions ADD CONSTRAINT pitch_submissions_attachment_count CHECK (cardinality(attachment_paths) <= 3);

-- "<submission uuid>-..." -> uuid, or NULL (never raises, so it is safe inside policies)
CREATE OR REPLACE FUNCTION public.pitch_submission_id_from_name(p_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-'
              THEN left(p_name, 36)::uuid END;
$$;

-- a writer's files live under attachments/<their id>/ ; full decks stay "<submission id>-full-deck-..."
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "pitch_assets_upload_own" ON storage.objects;
CREATE POLICY "pitch_assets_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pitch_assets'
    AND (
      (name LIKE ('attachments/' || auth.uid()::text || '/%')
        AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png', 'webp'))
      OR EXISTS (
        SELECT 1 FROM public.pitch_submissions s
        WHERE s.id = public.pitch_submission_id_from_name(storage.objects.name) AND s.submitter_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "pitch_assets_read_attachments" ON storage.objects;
CREATE POLICY "pitch_assets_read_attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pitch_assets'
    AND name LIKE 'attachments/%'
    AND (
      split_part(name, '/', 2) = auth.uid()::text
      OR public.is_current_user_internal()
      OR EXISTS (
        SELECT 1 FROM public.pitch_submissions s JOIN public.pitch_calls c ON c.id = s.pitch_call_id
        WHERE s.id = public.pitch_submission_id_from_name(split_part(storage.objects.name, '/', 3))
          AND (c.creator_id = auth.uid() OR (CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ->> 'target_producer_id' END) = auth.uid()::text)
      )
    )
  );

DROP POLICY IF EXISTS "pitch_assets_delete_own_attachments" ON storage.objects;
CREATE POLICY "pitch_assets_delete_own_attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pitch_assets' AND name LIKE ('attachments/' || auth.uid()::text || '/%'));

-- only your own files can be listed on your pitch
CREATE OR REPLACE FUNCTION public.pitch_attachments_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.attachment_paths IS NOT DISTINCT FROM OLD.attachment_paths THEN RETURN NEW; END IF;
  FOREACH p IN ARRAY COALESCE(NEW.attachment_paths, '{}') LOOP
    IF p NOT LIKE ('pitch_assets:attachments/' || NEW.submitter_id::text || '/%') THEN
      RAISE EXCEPTION 'Invalid attachment' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pitch_attachments_guard ON public.pitch_submissions;
CREATE TRIGGER pitch_attachments_guard BEFORE INSERT OR UPDATE ON public.pitch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pitch_attachments_guard();

-- the writer may change attachment_paths together with the rest of the pitch text (same rule as before)
CREATE OR REPLACE FUNCTION public.pitch_submission_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean;
  v_review constant text[] := ARRAY['status', 'seen_at', 'reviewed_at', 'shortlisted_at', 'passed_at', 'feedback', 'updated_at'];
  v_content constant text[] := ARRAY['title', 'logline', 'short_synopsis', 'full_synopsis', 'genre', 'format', 'language', 'tone',
    'why_fits', 'rights_owned', 'is_original_work', 'treatment_url', 'lookbook_url', 'moodboard_url', 'character_notes',
    'pilot_outline', 'reference_links', 'guild_registration_number', 'nda_preferred', 'attachments', 'attachment_paths', 'updated_at'];
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

-- ── 2. reports on pitch calls and pitches (same two-person moderation flow) ──────────────────────────────────────
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['post','comment','user','job','listing','room','message','announcement','review','cinema','pitch_call','pitch_submission']));

CREATE OR REPLACE FUNCTION public._apply_report_action(
  p_report_id uuid, p_action text, p_note text, p_maker uuid, p_checker uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_author uuid;
  v_tid uuid;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  BEGIN
    v_tid := v_report.target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  IF v_tid IS NOT NULL THEN
    v_author := CASE v_report.target_type
      WHEN 'user'    THEN v_tid
      WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_tid)
      WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_tid)
      WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_tid)
      WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_tid)
      WHEN 'announcement' THEN (SELECT author_id FROM public.announcements WHERE id = v_tid)
      WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_tid)
      WHEN 'review'  THEN (SELECT user_id FROM public.film_reviews WHERE id = v_tid)
      WHEN 'cinema'  THEN (SELECT creator_id FROM public.platform_cinema WHERE id = v_tid)
      WHEN 'pitch_call' THEN (SELECT creator_id FROM public.pitch_calls WHERE id = v_tid)
      WHEN 'pitch_submission' THEN (SELECT submitter_id FROM public.pitch_submissions WHERE id = v_tid)
      ELSE NULL
    END;
  END IF;

  IF p_action = 'takedown' THEN
    IF v_tid IS NULL OR v_report.target_type NOT IN ('post', 'comment', 'job', 'listing', 'room', 'announcement', 'review', 'cinema', 'pitch_call', 'pitch_submission') THEN
      RAISE EXCEPTION 'Cannot take down target type % (use user management for accounts; messages are encrypted)', v_report.target_type;
    END IF;
    IF v_report.target_type = 'post' THEN DELETE FROM public.posts WHERE id = v_tid;
    ELSIF v_report.target_type = 'comment' THEN DELETE FROM public.post_comments WHERE id = v_tid;
    ELSIF v_report.target_type = 'job' THEN DELETE FROM public.jobs WHERE id = v_tid;
    ELSIF v_report.target_type = 'listing' THEN DELETE FROM public.marketplace_listings WHERE id = v_tid;
    ELSIF v_report.target_type = 'announcement' THEN DELETE FROM public.announcements WHERE id = v_tid;
    ELSIF v_report.target_type = 'room' THEN DELETE FROM public.discussion_rooms WHERE id = v_tid;
    ELSIF v_report.target_type = 'review' THEN DELETE FROM public.film_reviews WHERE id = v_tid;
    ELSIF v_report.target_type = 'cinema' THEN DELETE FROM public.platform_cinema WHERE id = v_tid;
    ELSIF v_report.target_type = 'pitch_call' THEN
      -- a taken-down call disappears from the lists and stops taking pitches; the pitches already sent stay with their writers
      PERFORM set_config('app.market_system', '1', true);
      UPDATE public.pitch_calls SET is_published = false, status = 'closed', updated_at = now() WHERE id = v_tid;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      PERFORM set_config('app.market_system', '', true);
    ELSIF v_report.target_type = 'pitch_submission' THEN
      PERFORM set_config('app.market_system', '1', true);
      UPDATE public.pitch_submissions SET status = 'closed', updated_at = now() WHERE id = v_tid;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      PERFORM set_config('app.market_system', '', true);
    END IF;
    IF v_report.target_type NOT IN ('pitch_call', 'pitch_submission') THEN
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    END IF;
    IF v_deleted = 0 THEN
      RAISE EXCEPTION 'Content no longer exists';
    END IF;
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles SET is_shadowbanned = true, shadow_banned_at = now() WHERE id = v_author;
  ELSIF p_action <> 'dismiss' THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  UPDATE public.content_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         reviewed_by = COALESCE(p_checker, p_maker),
         reviewed_at = now(),
         resolution_note = COALESCE(p_note, p_action)
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (COALESCE(p_checker, p_maker), 'moderator', 'report_' || p_action, v_report.target_type, v_report.target_id,
          jsonb_build_object('report_id', p_report_id, 'author_id', v_author, 'note', p_note,
                             'maker_id', p_maker, 'checker_id', p_checker));

  RETURN jsonb_build_object('success', true, 'action', p_action, 'author_id', v_author);
END;
$$;
REVOKE ALL ON FUNCTION public._apply_report_action(uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. the NDA record: who signed what and when (the writer and the call owner of that pitch only) ───────────────
CREATE OR REPLACE FUNCTION public.get_nda_record(p_submission uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.pitch_submissions%ROWTYPE;
  c public.pitch_calls%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.pitch_submissions WHERE id = p_submission;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.pitch_calls WHERE id = s.pitch_call_id;
  IF auth.uid() IS NULL OR (auth.uid() <> s.submitter_id AND auth.uid() <> c.creator_id AND NOT public.is_current_user_internal()) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'record_id', s.id,
    'pitch_title', s.title,
    'call_title', c.title,
    'direct', COALESCE((CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ->> 'is_direct_catcher' END), '') = 'true',
    'nda_required', COALESCE(c.nda_required, false),
    'writer', (SELECT jsonb_build_object('id', p.id, 'name', COALESCE(p.full_name, p.username)) FROM public.profiles p WHERE p.id = s.submitter_id),
    'owner', (SELECT jsonb_build_object('id', p.id, 'name', COALESCE(p.full_name, p.username)) FROM public.profiles p WHERE p.id = c.creator_id),
    'writer_signature', s.nda_signature,
    'writer_signed_at', s.nda_signed_at,
    'submitted_at', s.submitted_at,
    'viewer_signatures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', COALESCE(p.full_name, p.username), 'signature', v.signature, 'signed_at', v.signed_at) ORDER BY v.signed_at)
        FROM public.nda_viewer_signatures v LEFT JOIN public.profiles p ON p.id = v.signed_by
       WHERE v.pitch_submission_id = s.id), '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_nda_record(uuid) TO authenticated;

COMMIT;
