-- Real moderation actions for the Report Triage Hub. Previously "Take down" passed a report id to a
-- governance action that did nothing, and "Shadowban" only showed a toast.
CREATE OR REPLACE FUNCTION public.moderator_resolve_report(p_report_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb
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
  IF auth.uid() IS NULL OR NOT public.is_current_user_internal() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('dismiss', 'takedown', 'shadowban') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  BEGIN
    v_tid := v_report.target_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tid := NULL;
  END;

  -- Resolve the content author (used by shadowban).
  IF v_tid IS NOT NULL THEN
    v_author := CASE v_report.target_type
      WHEN 'user'    THEN v_tid
      WHEN 'post'    THEN (SELECT author_id FROM public.posts WHERE id = v_tid)
      WHEN 'comment' THEN (SELECT user_id FROM public.post_comments WHERE id = v_tid)
      WHEN 'job'     THEN (SELECT posted_by FROM public.jobs WHERE id = v_tid)
      WHEN 'listing' THEN (SELECT user_id FROM public.marketplace_listings WHERE id = v_tid)
      WHEN 'room'    THEN (SELECT creator_id FROM public.discussion_rooms WHERE id = v_tid)
      ELSE NULL
    END;
  END IF;

  IF p_action = 'takedown' THEN
    IF v_tid IS NULL OR v_report.target_type NOT IN ('post', 'comment', 'job', 'listing', 'room') THEN
      RAISE EXCEPTION 'Cannot take down target type % (use user management for accounts, messages are encrypted)', v_report.target_type;
    END IF;
    IF v_report.target_type = 'post' THEN
      DELETE FROM public.posts WHERE id = v_tid;
    ELSIF v_report.target_type = 'comment' THEN
      DELETE FROM public.post_comments WHERE id = v_tid;
    ELSIF v_report.target_type = 'job' THEN
      DELETE FROM public.jobs WHERE id = v_tid;
    ELSIF v_report.target_type = 'listing' THEN
      DELETE FROM public.marketplace_listings WHERE id = v_tid;
    ELSIF v_report.target_type = 'room' THEN
      DELETE FROM public.discussion_rooms WHERE id = v_tid;
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
      RAISE EXCEPTION 'Content no longer exists';
    END IF;
  ELSIF p_action = 'shadowban' THEN
    IF v_author IS NULL THEN
      RAISE EXCEPTION 'Could not determine the author of this content';
    END IF;
    UPDATE public.profiles
       SET is_shadowbanned = true, shadow_banned_at = now()
     WHERE id = v_author;
  END IF;

  UPDATE public.content_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         resolution_note = COALESCE(p_note, p_action)
   WHERE id = p_report_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'moderator', 'report_' || p_action, v_report.target_type, v_report.target_id,
          jsonb_build_object('report_id', p_report_id, 'author_id', v_author, 'note', p_note));

  RETURN jsonb_build_object('success', true, 'action', p_action, 'author_id', v_author);
END;
$$;

REVOKE ALL ON FUNCTION public.moderator_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_resolve_report(uuid, text, text) TO authenticated;
