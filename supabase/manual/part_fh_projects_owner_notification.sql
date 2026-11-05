-- PART FH (projects) - the project owner never gets a notification when someone applies to join. Safe to run more than once.
--
-- WHAT WENT WRONG (browser test): two people applied to projects made in the web wizard and the owner's Notifications page stayed empty
-- ("You're all caught up"). The existing trigger (notify_on_project_join_request -> handle_new_notification, branch F) looks up the owner as
-- project_spaces.creator_id. The wizard creates the space with only project_id and name, so creator_id is empty for those spaces and the
-- trigger finds nobody to tell. (The applicant's own "approved / not accepted" notifications work: part FH applicant notification.)
-- THE FIX: a second small trigger that only acts when the space has no creator_id; it tells the owner of the PROJECT (projects.creator_id)
-- with the same notification type and link the original uses. Spaces that do have a creator_id are untouched (no double notifications).
--
-- PREFLIGHT (read only): select count(*) as spaces_without_creator from public.project_spaces where creator_id is null;   -- more than 0 confirms it
-- POST-CHECK  (read only): apply to a project from a second account: the owner sees "Project Join Request" in Notifications.

CREATE OR REPLACE FUNCTION public.fh_notify_join_request_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_space_creator uuid;
    v_owner uuid;
    v_project uuid;
    v_name text;
    v_actor text;
BEGIN
    SELECT ps.creator_id, p.creator_id, ps.project_id, ps.name
      INTO v_space_creator, v_owner, v_project, v_name
    FROM public.project_spaces ps
    LEFT JOIN public.projects p ON p.id = ps.project_id
    WHERE ps.id = NEW.project_space_id;

    -- the original trigger already handles spaces that have a creator_id
    IF v_space_creator IS NOT NULL OR v_owner IS NULL OR v_owner = NEW.user_id THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(full_name, username) INTO v_actor FROM public.profiles WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (v_owner, NEW.user_id, 'project_invite', 'Project Join Request',
            COALESCE(v_actor, 'Someone') || ' requested to join ' || COALESCE(v_name, 'your project'),
            '/projects/' || v_project || '/space', NEW.project_space_id);
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fh_notify_join_request_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fh_notify_join_request_owner ON public.project_space_join_requests;
CREATE TRIGGER fh_notify_join_request_owner
AFTER INSERT ON public.project_space_join_requests
FOR EACH ROW EXECUTE FUNCTION public.fh_notify_join_request_owner();
