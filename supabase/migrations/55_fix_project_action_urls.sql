-- =========================================================================
-- Migration: 55_fix_project_action_urls.sql
-- Description: Fixes notification redirection URLs to point to parent projects
--              instead of project spaces, allowing correct routing on web/native.
-- =========================================================================

-- 1. Upgrade notify_new_project_message() to fetch parent project_id
CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
  parent_project_id UUID;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project space name and parent project_id
  SELECT name, project_id INTO project_name, parent_project_id
  FROM public.project_spaces
  WHERE id = NEW.project_space_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

  -- Create notifications for all project members except the sender
  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_space_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      action_url,
      related_id,
      related_type,
      priority,
      is_read
    ) VALUES (
      project_member.user_id,
      NEW.user_id,
      'new_message',
      sender_name || ' in ' || COALESCE(project_name, 'Project Space'),
      formatted_msg,
      '/projects/' || parent_project_id || '/space',
      NEW.id,
      'project_message',
      'medium',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Upgrade handle_new_notification() to resolve parent project_id
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    _recipient_id UUID;
    _actor_id UUID;
    _actor_name TEXT;
    _project_name TEXT;
    _parent_project_id UUID;
    _job_title TEXT;
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
    IF (TG_TABLE_NAME = 'likes' OR TG_TABLE_NAME = 'post_likes') AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'like';
        _priority := 'low';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _actor_id := NEW.user_id;
        _title := 'New Like';
        _message := COALESCE(_actor_name, 'Someone') || ' liked your post';
        _action_url := '/post/' || NEW.post_id;

    -- B. HANDLE COMMENTS
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

    -- C. HANDLE NEW FOLLOWERS / CONNECTIONS
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            _recipient_id := NEW.following_id;
            _actor_id := NEW.follower_id;
            _related_id := NEW.id;
            _related_type := 'profile';
            _type := 'new_follower';
            
            SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.follower_id;
            _title := 'New Connection Request';
            _message := COALESCE(_actor_name, 'Someone') || ' wants to connect with you';
            _is_actionable := true;
            _action_url := '/profile/' || NEW.follower_id;
        ELSE
            RETURN NULL;
        END IF;

    -- D. HANDLE JOB APPLICATIONS
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

    -- E. HANDLE PROJECT APPLICATIONS
    ELSIF TG_TABLE_NAME = 'project_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_id;
        _related_type := 'project';
        _type := 'project_application';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name, project_id INTO _recipient_id, _project_name, _parent_project_id 
        FROM public.project_spaces 
        WHERE id = NEW.project_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || _parent_project_id || '/space';

    -- F. HANDLE PROJECT SPACE JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_space_id;
        _related_type := 'project';
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name, project_id INTO _recipient_id, _project_name, _parent_project_id 
        FROM public.project_spaces 
        WHERE id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || _parent_project_id || '/space';

    -- G. HANDLE DISCUSSION ROOM JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'room_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.room_id;
        _related_type := 'discussion_room';
        _type := 'project_invite';
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
-- 3. Data Migration: Correct historical incorrect project space URLs in notifications table
-- Update '/projects/SPACE_UUID/space' to '/projects/PROJECT_UUID/space'
UPDATE public.notifications n
SET action_url = '/projects/' || ps.project_id || '/space'
FROM public.project_spaces ps
WHERE n.action_url LIKE '/projects/%/space'
  AND SPLIT_PART(n.action_url, '/', 3) = ps.id::text;
-- Update '/projects/SPACE_UUID' to '/projects/PROJECT_UUID/space'
UPDATE public.notifications n
SET action_url = '/projects/' || ps.project_id || '/space'
FROM public.project_spaces ps
WHERE n.action_url LIKE '/projects/%'
  AND n.action_url NOT LIKE '%/space'
  AND SPLIT_PART(n.action_url, '/', 3) = ps.id::text;
