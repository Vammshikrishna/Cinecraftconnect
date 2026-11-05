-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- part_bt: staff (internal) accounts do not take part in the social side of the app
--
-- Staff accounts exist to run the platform: governance, moderation, support, audited visits. They do not post,
-- comment, follow, message, apply, pitch or review, and nobody does those things TO them either. This part makes
-- the database enforce it, so it holds on web, mobile, scripts and any future screen, and it makes their
-- notifications match.
--
--   1. Features     one trigger function, attached to every social table below, refuses a row when the account doing
--                   the action (or receiving it, for follows, messages and mentions) is staff. It only ever REFUSES an
--                   insert, so no existing policy changes, and normal users are unaffected.
--   2. Notifications  a staff account receives only governance, support, system and security notifications (an allow
--                   list). Everything else is not created, which also covers chat, follows, mentions, invites,
--                   pitches, messages and the push-delivery function.
--   3. Clean        removes notifications staff already hold that are not on the allow list.
--
-- Not blocked (staff do these as part of their job): support tickets and replies, content reports, moderation notes
-- and evidence, platform announcements, audited access, verification decisions, editing their own profile and settings.
-- Run after part_bq. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ── 1. refuse social actions ────────────────────────────────────────────────────────────────────
-- TG_ARGV[0] is the column that holds the account involved (author_id, user_id, sender_id, ...)
CREATE OR REPLACE FUNCTION public.refuse_staff_social_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  BEGIN
    v_actor := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_actor IS NOT NULL AND public.is_staff_user(v_actor) THEN
    RAISE EXCEPTION 'Staff accounts do not take part in social features.'
      USING ERRCODE = 'check_violation',
            HINT = 'Internal accounts are for governance, moderation and support only.';
  END IF;
  RETURN NEW;
END;
$$;

-- table, column. Each pair is attached only if that table and column exist in your database.
DO $$
DECLARE
  pair text[];
  pairs text[][] := ARRAY[
    -- posts and what happens around them
    ['posts', 'author_id'], ['post_comments', 'user_id'], ['post_likes', 'user_id'], ['post_bookmarks', 'user_id'],
    ['shares', 'user_id'], ['post_collaborators', 'user_id'], ['mentions', 'mentioner_id'],
    -- (a mention OF a staff account is not refused, because it would make the author's whole post fail; the staff
    --  account simply gets no notification for it, see section 2)
    -- following and connections, in both directions
    ['user_connections', 'follower_id'], ['user_connections', 'following_id'],
    ['user_follows', 'follower_id'], ['user_follows', 'following_id'],
    ['company_page_followers', 'user_id'], ['company_page_members', 'user_id'], ['company_pages', 'owner_id'],
    -- direct messages, in both directions
    ['direct_messages', 'sender_id'], ['direct_messages', 'receiver_id'], ['direct_message_reactions', 'user_id'],
    ['messages', 'sender_id'],
    -- ratings, reviews, endorsements
    ['film_reviews', 'user_id'], ['marketplace_reviews', 'reviewer_id'], ['user_film_ratings', 'user_id'],
    ['review_helpful_marks', 'user_id'], ['skill_endorsements', 'endorser_id'],
    -- work: jobs, applications, projects, pitches, marketplace, vendors, portfolio, cinema
    ['jobs', 'poster_id'], ['jobs', 'created_by'], ['job_applications', 'applicant_id'],
    ['project_applications', 'user_id'], ['project_members', 'user_id'], ['projects', 'creator_id'],
    ['project_spaces', 'creator_id'], ['discussion_rooms', 'creator_id'],
    ['pitch_calls', 'creator_id'], ['saved_pitch_calls', 'user_id'], ['pitch_submissions', 'user_id'],
    ['pitch_submissions', 'submitter_id'], ['pitch_submissions', 'creator_id'],
    ['marketplace_listings', 'user_id'], ['marketplace_bookings', 'owner_id'], ['vendors', 'owner_id'],
    ['portfolio_items', 'user_id'], ['platform_cinema', 'creator_id']
  ];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = pair[1] AND c.column_name = pair[2]
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = pair[1] AND t.table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'refuse_staff_social_' || pair[2], pair[1]);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.refuse_staff_social_action(%L)',
        'refuse_staff_social_' || pair[2], pair[1], pair[2]
      );
    END IF;
  END LOOP;
END $$;


-- ── 2. staff notifications: only governance, support, system and security ──────────────────────
CREATE OR REPLACE FUNCTION public.staff_notification_allowed(p_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_type IS NOT NULL AND (
    p_type IN ('ban', 'mute', 'warning', 'success')
    OR p_type LIKE 'staff%'
    OR p_type LIKE 'governance%'
    OR p_type LIKE 'gov\_%'
    OR p_type LIKE 'system%'
    OR p_type LIKE 'support%'
    OR p_type LIKE 'report%'
    OR p_type LIKE 'verify%'
    OR p_type LIKE 'verification%'
    OR p_type LIKE 'role\_%'
    OR p_type LIKE 'security%'
    OR p_type LIKE 'account%'
    OR p_type LIKE 'access\_%'
    OR p_type LIKE 'appeal%'
  );
$$;

CREATE OR REPLACE FUNCTION public.skip_staff_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff_user(NEW.user_id) AND NOT public.staff_notification_allowed(NEW.type) THEN
    RETURN NULL; -- the row is simply not created
  END IF;
  RETURN NEW;
END;
$$;

-- replaces the narrower chat-only trigger from part_bs
DROP TRIGGER IF EXISTS skip_staff_chat_notification ON public.notifications;
DROP TRIGGER IF EXISTS skip_staff_notification ON public.notifications;
CREATE TRIGGER skip_staff_notification
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.skip_staff_notification();


-- ── 3. clean what staff already hold ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM public.notifications n
  WHERE public.is_staff_user(n.user_id)
    AND NOT public.staff_notification_allowed(n.type);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed > 0 THEN
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'staff.social_notifications_removed', auth.uid(), 'all', 'notifications',
      'Staff accounts only keep governance, support, system and security notifications',
      jsonb_build_object('removed', v_removed)
    );
  END IF;
END $$;


-- ── check ───────────────────────────────────────────────────────────────────────────────────────
-- Which social tables got the guard:
--   SELECT event_object_table, trigger_name FROM information_schema.triggers
--    WHERE trigger_name LIKE 'refuse_staff_social_%' ORDER BY 1, 2;
-- As a staff account, each of these should fail with "Staff accounts do not take part in social features":
--   a post, a comment, a like, a follow, a direct message, a job application.
-- A normal user doing the same works exactly as before, and so does messaging or following ANOTHER normal user.
-- To let one more notification type through for staff, add it to staff_notification_allowed() above.
