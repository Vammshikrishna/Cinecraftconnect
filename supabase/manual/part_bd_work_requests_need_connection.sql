-- PART BD: date requests and project invitations need an accepted connection. Both used to work between any two
-- creators / studios, which made cold requests easy to spam. Run after part BC (or BB), then deploy the new web build.
-- See docs/PROFILE.md.
BEGIN;

CREATE OR REPLACE FUNCTION public.are_connected(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_connections c
     WHERE c.status = 'accepted'
       AND ((c.follower_id = p_a AND c.following_id = p_b) OR (c.follower_id = p_b AND c.following_id = p_a))
  );
$$;
GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO authenticated;

-- a date request goes to a connection
CREATE OR REPLACE FUNCTION public.date_hold_needs_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN RETURN NEW; END IF;
  IF NOT public.are_connected(NEW.requester_id, NEW.target_id) THEN
    RAISE EXCEPTION 'Connect with this person first to send a date request' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_date_hold_needs_connection ON public.date_holds;
CREATE TRIGGER a_date_hold_needs_connection BEFORE INSERT ON public.date_holds
  FOR EACH ROW EXECUTE FUNCTION public.date_hold_needs_connection();

-- a project invitation goes to a connection
CREATE OR REPLACE FUNCTION public.project_invite_needs_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.market_is_system() OR public.is_current_user_internal() THEN RETURN NEW; END IF;
  IF NOT public.are_connected(NEW.inviter_id, NEW.invitee_id) THEN
    RAISE EXCEPTION 'Connect with this person first to invite them to a project' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_project_invite_needs_connection ON public.project_person_invites;
CREATE TRIGGER a_project_invite_needs_connection BEFORE INSERT ON public.project_person_invites
  FOR EACH ROW EXECUTE FUNCTION public.project_invite_needs_connection();

COMMIT;
