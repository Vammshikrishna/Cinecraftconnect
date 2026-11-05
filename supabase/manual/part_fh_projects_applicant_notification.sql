-- PART FH (projects) - tell the applicant when a project join request is approved or rejected. Safe to run more than once.
--
-- WHAT WAS MISSING: a person who applies to join a project got no answer. approve_join_request / reject_join_request changed the request
-- and (for approve) added the member, but sent no notification, so the applicant only found out by opening the project again.
-- THE FIX: both functions (same permission check as part CJ) now also add a notification for the applicant. Type 'project_update' is plain
-- text with no accept/decline buttons.
--
-- PREFLIGHT (read only): select proname from pg_proc where proname in ('approve_join_request', 'reject_join_request');   -- 2 rows
-- POST-CHECK  (read only): approve a test application, then: select title, message from public.notifications where type = 'project_update' order by created_at desc limit 1;

CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_project_space_id uuid;
    v_user_id uuid;
    v_project_id uuid;
    v_name text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    SELECT project_space_id, user_id INTO v_project_space_id, v_user_id
    FROM project_space_join_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Join request not found';
    END IF;

    IF NOT public.cj_can_manage_space(v_project_space_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the project owner can decide join requests';
    END IF;

    UPDATE project_space_join_requests
    SET status = 'approved'
    WHERE id = _request_id;

    INSERT INTO project_space_members (project_space_id, user_id, role)
    VALUES (v_project_space_id, v_user_id, 'member')
    ON CONFLICT DO NOTHING;

    SELECT project_id, name INTO v_project_id, v_name FROM public.project_spaces WHERE id = v_project_space_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (v_user_id, auth.uid(), 'project_update', 'Application approved',
            'You are now a member of ' || COALESCE(v_name, 'the project') || '.',
            '/projects/' || v_project_id || '/space', v_project_space_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_project_space_id uuid;
    v_user_id uuid;
    v_project_id uuid;
    v_name text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in first';
    END IF;

    SELECT project_space_id, user_id INTO v_project_space_id, v_user_id
    FROM project_space_join_requests
    WHERE id = _request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Join request not found';
    END IF;

    IF NOT public.cj_can_manage_space(v_project_space_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the project owner can decide join requests';
    END IF;

    UPDATE project_space_join_requests
    SET status = 'rejected'
    WHERE id = _request_id;

    SELECT project_id, name INTO v_project_id, v_name FROM public.project_spaces WHERE id = v_project_space_id;
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (v_user_id, auth.uid(), 'project_update', 'Application not accepted',
            'Your application to join ' || COALESCE(v_name, 'the project') || ' was not accepted this time.',
            '/projects/' || v_project_id, v_project_space_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_join_request(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_join_request(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_join_request(integer) TO authenticated, service_role;
