-- ============================================================================
-- FIX NOTIFICATION RECIPIENT LOGIC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    _recipient_id UUID;
    _actor_id UUID;
    _actor_name TEXT;
    _project_name TEXT;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _related_id UUID;
    _related_type TEXT;
    _priority TEXT := 'medium';
    _is_actionable BOOLEAN := false;
    _action_url TEXT;
BEGIN
    -- Initialize defaults
    _actor_id := auth.uid();

    -- A. HANDLE LIKES
    IF TG_TABLE_NAME = 'likes' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'like';
        
        -- Get post author
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        
        -- Don't notify if liking own post
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'New Like';
        _message := COALESCE(_actor_name, 'Someone') || ' liked your post';
        _action_url := '/post/' || NEW.post_id;

    -- B. HANDLE COMMENTS
    ELSIF TG_TABLE_NAME = 'post_comments' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.id;
        _related_type := 'post';
        _type := 'comment';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'New Comment';
        _message := COALESCE(_actor_name, 'Someone') || ' commented on your post';
        _action_url := '/post/' || NEW.post_id;

    -- C. HANDLE NEW FOLLOWERS
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.id;
        _related_type := 'profile';
        _type := 'new_follower';
        _recipient_id := NEW.following_id;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.follower_id;
        _title := 'New Connection Request';
        _message := COALESCE(_actor_name, 'Someone') || ' wants to connect with you';
        _is_actionable := true;
        _action_url := '/profile/' || NEW.follower_id;

    -- D. HANDLE PROJECT APPLICATIONS
    ELSIF TG_TABLE_NAME = 'project_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.id;
        _related_type := 'project';
        _type := 'project_application';
        _actor_id := NEW.user_id;
        
        -- FIX: Join with projects to get creator_id
        SELECT p.creator_id, p.title INTO _recipient_id, _project_name 
        FROM public.projects p
        WHERE p.id = NEW.project_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_id;

    -- E. HANDLE PROJECT INVITES (Join Requests)
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.id;
        _related_type := 'project';
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        -- FIX: Join with projects to get creator_id from the project associated with the space
        SELECT p.creator_id, ps.name INTO _recipient_id, _project_name 
        FROM public.project_spaces ps
        JOIN public.projects p ON ps.project_id = p.id
        WHERE ps.id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_space_id;
    END IF;

    -- Final Insert if we have a recipient
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
            COALESCE(_actor_id, auth.uid()),
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
