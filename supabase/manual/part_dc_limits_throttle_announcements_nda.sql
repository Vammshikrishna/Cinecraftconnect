-- PART DC - plan limits on update, content throttle, page-content authority, pitch NDA in storage (audit step 15).
-- Based on the live state read in audit_step15_preflight.sql. Safe to run more than once.
--
-- 1. Plan limits (finding 43): the limit triggers only fired on INSERT, so a job created inactive and then switched on, or a
--    room created public and then switched to private, got around them. They now also fire when those fields change.
--    (While billing is in "beta" mode nothing is limited, exactly as before.)
-- 2. Content throttle (finding 52): a client could write an old created_at on a new post / comment / listing / job so it was
--    not counted, and parallel inserts could all pass the count. New rows from signed-in people always get created_at = now(),
--    and inserts by the same author are checked one at a time.
-- 3. Page content (findings 78): an announcement or post published as a company page can only be edited or deleted by someone
--    who CURRENTLY manages that page, not by whoever wrote it originally.
-- 4. Pitch NDA (finding 30): when a pitch call requires an NDA, the person reviewing a submission can open its files only
--    after they signed it (a row in nda_viewer_signatures). Before, the check lived only in the app.

-- ---------------------------------------------------------------------------
-- 1. plan limits also on update
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS "enforce_plan_limit_jobs.active.max.upd" ON public.jobs;
CREATE TRIGGER "enforce_plan_limit_jobs.active.max.upd"
  BEFORE UPDATE OF is_active ON public.jobs
  FOR EACH ROW WHEN (OLD.is_active IS DISTINCT FROM TRUE AND NEW.is_active IS TRUE)
  EXECUTE FUNCTION public.enforce_plan_limit('posted_by', 'jobs.active.max');

DROP TRIGGER IF EXISTS "enforce_plan_limit_rooms.private.max.upd" ON public.discussion_rooms;
CREATE TRIGGER "enforce_plan_limit_rooms.private.max.upd"
  BEFORE UPDATE OF room_type ON public.discussion_rooms
  FOR EACH ROW WHEN (OLD.room_type NOT IN ('private', 'secret') AND NEW.room_type IN ('private', 'secret'))
  EXECUTE FUNCTION public.enforce_plan_limit('creator_id', 'rooms.private.max');

-- ---------------------------------------------------------------------------
-- 2. throttle: real created_at, one insert per author at a time
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.db_prepare_throttled_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_author text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- system jobs and imports
  END IF;
  NEW.created_at := now();
  v_author := to_jsonb(NEW) ->> TG_ARGV[0];
  IF v_author IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || v_author, 0));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_db_prepare_throttled_insert ON public.posts;
CREATE TRIGGER a_db_prepare_throttled_insert BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.db_prepare_throttled_insert('author_id');
DROP TRIGGER IF EXISTS a_db_prepare_throttled_insert ON public.post_comments;
CREATE TRIGGER a_db_prepare_throttled_insert BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.db_prepare_throttled_insert('user_id');
DROP TRIGGER IF EXISTS a_db_prepare_throttled_insert ON public.marketplace_listings;
CREATE TRIGGER a_db_prepare_throttled_insert BEFORE INSERT ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.db_prepare_throttled_insert('user_id');
DROP TRIGGER IF EXISTS a_db_prepare_throttled_insert ON public.jobs;
CREATE TRIGGER a_db_prepare_throttled_insert BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.db_prepare_throttled_insert('posted_by');

-- ---------------------------------------------------------------------------
-- 3. page announcements and page posts: current page managers only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Manage own or page announcements" ON public.announcements;
CREATE POLICY "Manage own or page announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (
    (publisher_page_id IS NULL AND author_id = auth.uid())
    OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid()))
    OR public.is_current_user_internal()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Delete own or page announcements" ON public.announcements;
CREATE POLICY "Delete own or page announcements" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    (publisher_page_id IS NULL AND author_id = auth.uid())
    OR (publisher_page_id IS NOT NULL AND public.is_page_manager(publisher_page_id, auth.uid()))
    OR public.is_current_user_internal()
  );

-- posts published as a page: changing the content or removing the post needs current page-manager rights
-- (likes / comment counters are not touched by this rule)
CREATE OR REPLACE FUNCTION public.db_guard_page_post_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_current_user_internal() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF OLD.page_id IS NOT NULL AND NOT public.is_page_manager(OLD.page_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only a manager of this page can change or delete its posts' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS a_db_guard_page_post_update ON public.posts;
CREATE TRIGGER a_db_guard_page_post_update
  BEFORE UPDATE OF content, media_items, tags, category, audience, scheduled_at, link_preview ON public.posts
  FOR EACH ROW WHEN (OLD.page_id IS NOT NULL)
  EXECUTE FUNCTION public.db_guard_page_post_change();
DROP TRIGGER IF EXISTS a_db_guard_page_post_delete ON public.posts;
CREATE TRIGGER a_db_guard_page_post_delete
  BEFORE DELETE ON public.posts
  FOR EACH ROW WHEN (OLD.page_id IS NOT NULL)
  EXECUTE FUNCTION public.db_guard_page_post_change();

-- ---------------------------------------------------------------------------
-- 4. pitch NDA enforced in storage for the reviewing side
--    (the submitter always reads their own files; staff keep their audited access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pitch_assets_read_participants" ON storage.objects;
CREATE POLICY "pitch_assets_read_participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pitch_assets'
    AND (
      public.is_current_user_internal()
      OR (
        name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-'
        AND EXISTS (
          SELECT 1
          FROM public.pitch_submissions s
          LEFT JOIN public.pitch_calls c ON c.id = s.pitch_call_id
          WHERE s.id = (left(objects.name, 36))::uuid
            AND (
              s.submitter_id = auth.uid()
              OR (
                (c.creator_id = auth.uid() OR (c.attachments ->> 'target_producer_id') = auth.uid()::text)
                AND (c.nda_required IS NOT TRUE
                     OR EXISTS (SELECT 1 FROM public.nda_viewer_signatures n WHERE n.pitch_submission_id = s.id AND n.signed_by = auth.uid()))
              )
            )
        )
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
        SELECT 1
        FROM public.pitch_submissions s
        JOIN public.pitch_calls c ON c.id = s.pitch_call_id
        WHERE s.id = public.pitch_submission_id_from_name(split_part(objects.name, '/', 3))
          AND (
            c.creator_id = auth.uid()
            OR CASE WHEN jsonb_typeof(c.attachments) = 'object' THEN c.attachments ->> 'target_producer_id' ELSE NULL END = auth.uid()::text
          )
          AND (c.nda_required IS NOT TRUE
               OR EXISTS (SELECT 1 FROM public.nda_viewer_signatures n WHERE n.pitch_submission_id = s.id AND n.signed_by = auth.uid()))
      )
    )
  );

-- (Not changed here: the withdraw-then-resubmit cascade that deletes a call owner's private notes, NDA signatures and access
--  logs (finding 72) and the "ignored" timestamp on connection requests (finding 65). Both need a closer look first.)
