-- ============================================================================
-- FIX & ENHANCE NOTIFICATIONS TRIGGERS
-- ============================================================================
-- This migration adds missing triggers for job applications, project applications,
-- and enhances the existing notification system.

-- Update the handle_new_notification function to be more comprehensive
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    _recipient_id UUID;
    _actor_id UUID;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _related_id UUID;
    _related_type TEXT;
    _priority TEXT := 'medium';
    _is_actionable BOOLEAN := false;
    _action_url TEXT;
    _actor_name TEXT;
    _project_name TEXT;
    _job_title TEXT;
BEGIN
    -- Set the actor_id to whoever is currently signed in (if available)
    -- But for automated triggers, we use the specific user_id from the NEW record
    _actor_id := auth.uid();
    
    -- A. HANDLE POST LIKES
    IF TG_TABLE_NAME = 'post_likes' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'like';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF; 

        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _actor_id := NEW.user_id;
        _title := 'New Like';
        _message := COALESCE(_actor_name, 'Someone') || ' liked your post';
        _action_url := '/post/' || NEW.post_id;
        _priority := 'low';

    -- B. HANDLE POST COMMENTS
    ELSIF TG_TABLE_NAME = 'post_comments' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'comment';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;

        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _actor_id := NEW.user_id;
        _title := 'New Comment';
        _message := COALESCE(_actor_name, 'Someone') || ' commented on your post';
        _action_url := '/post/' || NEW.post_id;

    -- C. HANDLE CONNECTION REQUESTS (INSERT)
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            _recipient_id := NEW.following_id;
            _actor_id := NEW.follower_id;
            _related_id := NEW.id; 
            _related_type := 'user_connection';
            _type := 'new_follower';
            
            SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = _actor_id;
            _title := 'New Connection Request';
            _message := COALESCE(_actor_name, 'Someone') || ' wants to connect with you';
            _is_actionable := true;
            _action_url := '/network';
        ELSE
            RETURN NULL;
        END IF;

    -- D. HANDLE JOB APPLICATIONS (INSERT)
    ELSIF TG_TABLE_NAME = 'job_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.job_id;
        _related_type := 'job';
        _type := 'job_application';
        _actor_id := NEW.applicant_id;
        
        SELECT posted_by, title INTO _recipient_id, _job_title 
        FROM public.jobs 
        WHERE id = NEW.job_id;
        
        IF _recipient_id = NEW.applicant_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.applicant_id;
        _title := 'New Job Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied for ' || COALESCE(_job_title, 'your job');
        _priority := 'high';
        _action_url := '/jobs/manage';

    -- E. HANDLE PROJECT APPLICATIONS (INSERT)
    ELSIF TG_TABLE_NAME = 'project_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_id;
        _related_type := 'project';
        _type := 'project_application';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name INTO _recipient_id, _project_name 
        FROM public.project_spaces 
        WHERE id = NEW.project_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _action_url := '/projects/' || NEW.project_id || '/space';

    -- F. HANDLE PROJECT SPACE JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_space_id;
        _related_type := 'project';
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name INTO _recipient_id, _project_name 
        FROM public.project_spaces 
        WHERE id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project');
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_space_id || '/space';

    -- G. HANDLE DISCUSSION ROOM JOIN REQUESTS (For Private Rooms)
    ELSIF TG_TABLE_NAME = 'room_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.room_id;
        _related_type := 'discussion_room';
        _type := 'project_invite'; -- reuse existing frontend icon/logic
        _actor_id := NEW.user_id;
        
        SELECT creator_id, title INTO _recipient_id, _project_name 
        FROM public.discussion_rooms 
        WHERE id = NEW.room_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Room Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' wants to join ' || COALESCE(_project_name, 'the room');
        _is_actionable := true;
        _action_url := '/discussion-rooms/' || NEW.room_id;

    END IF;

    -- INSERT NOTIFICATION
    IF _recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id, 
            actor_id, 
            type, 
            title, 
            message, 
            related_id, 
            related_type, 
            priority, 
            is_actionable, 
            action_url
        ) VALUES (
            _recipient_id, 
            _actor_id, 
            _type, 
            _title, 
            _message, 
            _related_id, 
            _related_type, 
            _priority, 
            _is_actionable, 
            _action_url
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers for all tables
DROP TRIGGER IF EXISTS notify_on_post_like ON public.post_likes;
CREATE TRIGGER notify_on_post_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_post_comment ON public.post_comments;
CREATE TRIGGER notify_on_post_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_connection_event ON public.user_connections;
CREATE TRIGGER notify_on_connection_event AFTER INSERT ON public.user_connections FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_job_application ON public.job_applications;
CREATE TRIGGER notify_on_job_application AFTER INSERT ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_project_application ON public.project_applications;
CREATE TRIGGER notify_on_project_application AFTER INSERT ON public.project_applications FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_project_join_request ON public.project_space_join_requests;
CREATE TRIGGER notify_on_project_join_request AFTER INSERT ON public.project_space_join_requests FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS notify_on_room_join_request ON public.room_join_requests;
CREATE TRIGGER notify_on_room_join_request AFTER INSERT ON public.room_join_requests FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();
