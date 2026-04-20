-- Create Notifications Table if not exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'like', 'comment', 'connection_request', 'connection_accepted', 'project_request', 'project_approved'
    title text NOT NULL,
    message text NOT NULL,
    related_id uuid, -- ID of the related post, project, etc. Match frontend interface
    related_type text, -- 'post', 'project', 'user_connection'
    action_url text, -- Optional URL to navigate to
    priority text DEFAULT 'low', -- 'low', 'medium', 'high'
    is_read boolean DEFAULT false,
    is_actionable boolean DEFAULT false, -- If true, might show Accept/Decline buttons in UI if implemented
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- ============================================================================
-- 1. NOTIFICATION TRIGGER FUNCTION
-- ============================================================================
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
    _priority TEXT := 'low';
    _is_actionable BOOLEAN := false;
    _action_url TEXT;
    _actor_name TEXT;
    _project_name TEXT;
BEGIN
    _actor_id := auth.uid(); -- Assuming the action is done by the logged-in user
    
    -- A. HANDLE POST LIKES
    IF TG_TABLE_NAME = 'post_likes' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'like';
        
        -- Get Post Author (Recipient)
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        
        -- Don't notify if liking own post
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF; 

        -- Get Actor Name
        SELECT full_name INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        
        _actor_id := NEW.user_id;
        _title := 'New Like';
        _message := COALESCE(_actor_name, 'Someone') || ' liked your post.';
        _action_url := '/feed'; -- Or specific post URL if available

    -- B. HANDLE POST COMMENTS
    ELSIF TG_TABLE_NAME = 'post_comments' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'comment';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;

        SELECT full_name INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        
        _actor_id := NEW.user_id;
        _title := 'New Comment';
        _message := COALESCE(_actor_name, 'Someone') || ' commented on your post.';
        _priority := 'medium';
        _action_url := '/feed';

    -- C. HANDLE CONNECTION REQUESTS (INSERT)
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            _recipient_id := NEW.following_id;
            _actor_id := NEW.follower_id;
            _related_id := NEW.id; 
            _related_type := 'user_connection';
            _type := 'connection_request';
            
            SELECT full_name INTO _actor_name FROM public.profiles WHERE id = _actor_id;
            
            _title := 'Connection Request';
            _message := COALESCE(_actor_name, 'Someone') || ' wants to connect with you.';
            _priority := 'medium';
            _is_actionable := true;
            _action_url := '/network';
        ELSE
            RETURN NULL;
        END IF;

    -- D. HANDLE CONNECTION ACCEPTED (UPDATE)
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
            _recipient_id := NEW.follower_id; 
            _actor_id := NEW.following_id; 
            _related_id := NEW.id;
            _related_type := 'user_connection';
            _type := 'connection_accepted';
            
            SELECT full_name INTO _actor_name FROM public.profiles WHERE id = _actor_id;
            
            _title := 'Connection Accepted';
            _message := COALESCE(_actor_name, 'Someone') || ' accepted your connection request.';
            _priority := 'medium';
            _action_url := '/network';
        ELSE
            RETURN NULL;
        END IF;
        
    -- E. HANDLE PROJECT JOIN REQUEST (INSERT)
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_space_id;
        _related_type := 'project';
        _type := 'project_request';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, title INTO _recipient_id, _project_name 
        FROM public.project_spaces 
        WHERE id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT full_name INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        
        _title := 'Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project') || '.';
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_space_id;

    -- F. HANDLE PROJECT REQUEST APPROVED (UPDATE)
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'UPDATE' THEN
        IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
             _recipient_id := NEW.user_id; 
             
             SELECT creator_id, title INTO _actor_id, _project_name 
             FROM public.project_spaces 
             WHERE id = NEW.project_space_id;

             _related_id := NEW.project_space_id;
             _related_type := 'project';
             _type := 'project_approved';
             
             _title := 'Request Approved';
             _message := 'Your request to join ' || COALESCE(_project_name, 'a project') || ' has been approved.';
             _priority := 'medium';
             _action_url := '/projects/' || NEW.project_space_id;
        ELSE
             RETURN NULL;
        END IF;

    END IF;

    -- INSERT NOTIFICATION
    IF _recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, type, title, message, related_id, related_type, priority, is_actionable, action_url)
        VALUES (_recipient_id, _actor_id, _type, _title, _message, _related_id, _related_type, _priority, _is_actionable, _action_url);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. CREATE TRIGGERS
-- ============================================================================

-- Post Likes
DROP TRIGGER IF EXISTS notify_on_post_like ON public.post_likes;
CREATE TRIGGER notify_on_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

-- Post Comments
DROP TRIGGER IF EXISTS notify_on_post_comment ON public.post_comments;
CREATE TRIGGER notify_on_post_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

-- Connection Requests & Acceptance
DROP TRIGGER IF EXISTS notify_on_connection_event ON public.user_connections;
CREATE TRIGGER notify_on_connection_event
AFTER INSERT OR UPDATE ON public.user_connections
FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

-- Project Join Requests & Approval
DROP TRIGGER IF EXISTS notify_on_project_join ON public.project_space_join_requests;
CREATE TRIGGER notify_on_project_join
AFTER INSERT OR UPDATE ON public.project_space_join_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();
