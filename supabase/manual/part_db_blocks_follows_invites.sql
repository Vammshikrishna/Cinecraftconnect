-- PART DB - blocks and follows, stale invitations (audit step 14: findings 67 and 69). Based on the live state read in
-- audit_step14_preflight.sql. Safe to run more than once.
-- (Findings 17, 24 and 58 were already closed live: row security is on for the four tables, a page manager cannot remove a
--  page admin, and the job page can no longer be re-pointed.)
--
-- 1. A block now also ends a follow, in both directions, and nobody can follow someone who blocked them (or whom they blocked).
--    Before, a blocked account kept following and kept creating "new follower" notifications.
-- 2. Accepting a project invitation re-checks that nobody blocked anyone since it was sent and that the person who invited is
--    still allowed to (still a member or the owner of the space). Accepting a date-hold counter-offer re-checks blocks.

-- 1a. refuse follows between people who blocked each other
CREATE OR REPLACE FUNCTION public.db_refuse_blocked_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
     WHERE (b.user_id = NEW.following_id AND b.blocked_user_id = NEW.follower_id)
        OR (b.user_id = NEW.follower_id AND b.blocked_user_id = NEW.following_id)
  ) THEN
    RAISE EXCEPTION 'You cannot follow this account.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a_db_refuse_blocked_follow ON public.user_follows;
CREATE TRIGGER a_db_refuse_blocked_follow
  BEFORE INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.db_refuse_blocked_follow();

-- 1b. a block removes follows both ways (as well as the connection it already removed)
CREATE OR REPLACE FUNCTION public.remove_connection_on_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.user_connections
   WHERE (follower_id = NEW.user_id AND following_id = NEW.blocked_user_id)
      OR (follower_id = NEW.blocked_user_id AND following_id = NEW.user_id);
  DELETE FROM public.user_follows
   WHERE (follower_id = NEW.user_id AND following_id = NEW.blocked_user_id)
      OR (follower_id = NEW.blocked_user_id AND following_id = NEW.user_id);
  RETURN NULL;
END;
$function$;

-- 1c. clean up follows that already exist between people who blocked each other
DELETE FROM public.user_follows f
 WHERE EXISTS (
   SELECT 1 FROM public.blocked_users b
    WHERE (b.user_id = f.following_id AND b.blocked_user_id = f.follower_id)
       OR (b.user_id = f.follower_id AND b.blocked_user_id = f.following_id));

-- 1d. the new-follower notification function had no fixed search path
ALTER FUNCTION public.handle_new_follower_notification() SET search_path TO 'public', 'pg_temp';

-- 2a. project invitations are re-checked when accepted
CREATE OR REPLACE FUNCTION public.respond_project_invite(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  i public.project_person_invites%ROWTYPE;
  v_name text;
  v_space_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO i FROM public.project_person_invites WHERE id = p_id AND invitee_id = v_me AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_space_name FROM public.project_spaces WHERE id = i.project_space_id;

  -- the invitation was valid when it was sent: check it still is when it is accepted
  IF COALESCE(p_accept, false) AND (
       EXISTS (SELECT 1 FROM public.blocked_users b
                WHERE (b.user_id = i.inviter_id AND b.blocked_user_id = v_me) OR (b.user_id = v_me AND b.blocked_user_id = i.inviter_id))
       OR NOT (public.cj_can_manage_space(i.project_space_id, i.inviter_id)
               OR EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = i.project_space_id AND m.user_id = i.inviter_id))
     ) THEN
    RAISE EXCEPTION 'This invitation is no longer valid' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;

  IF COALESCE(p_accept, false) THEN
    INSERT INTO public.project_space_members (project_space_id, user_id, role)
    SELECT i.project_space_id, v_me, 'member'
     WHERE NOT EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = i.project_space_id AND user_id = v_me);
    UPDATE public.project_person_invites SET status = 'accepted', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (i.inviter_id, v_me, 'project_invitation_accepted', 'Invitation accepted', v_name || ' joined ' || COALESCE(v_space_name, 'your project'), '/projects/' || i.project_space_id::text, p_id, false);
  ELSE
    UPDATE public.project_person_invites SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (i.inviter_id, v_me, 'project_invitation_declined', 'Invitation', v_name || ' cannot join ' || COALESCE(v_space_name, 'your project') || ' right now', '/network', p_id, false);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_project_invite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_project_invite(uuid, boolean) TO authenticated;

-- 2b. date-hold counter-offers are re-checked when accepted
CREATE OR REPLACE FUNCTION public.respond_hold_counter(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid := auth.uid();
  h public.date_holds%ROWTYPE;
  v_name text;
  v_cal uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Please sign in first' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO h FROM public.date_holds WHERE id = p_id AND requester_id = v_me AND status = 'countered' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_name FROM public.profiles WHERE id = v_me;
  IF COALESCE(p_accept, false) AND EXISTS (
       SELECT 1 FROM public.blocked_users b
        WHERE (b.user_id = h.target_id AND b.blocked_user_id = v_me) OR (b.user_id = v_me AND b.blocked_user_id = h.target_id)) THEN
    RAISE EXCEPTION 'This request is no longer available' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_accept, false) THEN
    v_cal := public._hold_to_calendar(h);
    UPDATE public.date_holds SET status = 'accepted', responded_at = now(), availability_id = v_cal,
           rate_amount = COALESCE(counter_rate, rate_amount) WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.target_id, v_me, 'date_hold_accepted', 'Dates held', v_name || ' accepted your counter offer', '/network', p_id, false);
  ELSE
    UPDATE public.date_holds SET status = 'declined', responded_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id, is_read)
    VALUES (h.target_id, v_me, 'date_hold_declined', 'Date request', v_name || ' declined your counter offer', '/network', p_id, false);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_hold_counter(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_hold_counter(uuid, boolean) TO authenticated;
