-- Consolidated Migration: 14_announcements_and_infrastructure.sql

-- =========================================================================
-- From original file: 41_advanced_session_security.sql
-- =========================================================================

-- Migration: 47_advanced_session_security.sql
-- Purpose: Trusted Device & Advanced Session Security Tables

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_name TEXT,
    platform TEXT,
    app_version TEXT,
    ip_address TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT false,
    trusted BOOLEAN DEFAULT false,
    suspicious BOOLEAN DEFAULT false
);

-- Performance indexes for quick lookups during token refresh
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON public.user_sessions(refresh_token_hash);

-- Security Events Table for logging
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'login_success', 'login_failure', 'suspicious_activity', 'session_revoked'
    device_id TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
    ON public.user_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON public.user_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON public.user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policies for security_events
CREATE POLICY "Users can view their own security events"
    ON public.security_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security events"
    ON public.security_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for user_sessions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'user_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
    END IF;
END $$;


-- =========================================================================
-- From original file: 42_global_announcements_infrastructure.sql
-- =========================================================================

-- 49_global_announcements_infrastructure.sql
-- CineCraft Connect — Infrastructure for system-wide announcements and admin broadcasting

-- 1. Create the system announcements table
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    image_url TEXT,
    send_push BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Anyone logged in can read system announcements
DROP POLICY IF EXISTS "Anyone can read system announcements" ON public.system_announcements;
CREATE POLICY "Anyone can read system announcements"
  ON public.system_announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform administrators and super admins can manage announcements
DROP POLICY IF EXISTS "Admins can manage all announcements" ON public.system_announcements;
CREATE POLICY "Admins can manage all announcements"
  ON public.system_announcements
  FOR ALL
  USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 4. Enable Supabase Realtime for system_announcements
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table system_announcements already in publication';
  END;
END $$;

-- Set replica identity to FULL to ensure full payloads are delivered in realtime
ALTER TABLE public.system_announcements REPLICA IDENTITY FULL;


-- =========================================================================
-- From original file: 43_harden_username_trigger.sql
-- =========================================================================

-- Migration: 50_harden_username_trigger.sql
-- Purpose: Harden handle_new_user trigger function to guarantee fallback usernames always satisfy the username_format check constraint ('^[a-z0-9_]{3,20}$')

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
BEGIN
  -- 1. Extract provided username from metadata
  raw_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name'
  );

  -- 2. If a username was supplied, check if it matches the format
  IF raw_username IS NOT NULL AND raw_username ~ '^[a-z0-9_]{3,20}$' THEN
    clean_username := raw_username;
  ELSE
    -- If not supplied or invalid format, generate a clean fallback from the email or supplied username
    raw_username := COALESCE(raw_username, split_part(new.email, '@', 1));
    -- Convert to lowercase, strip all non-alphanumeric and non-underscore characters
    clean_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
    
    -- Enforce minimum length of 3 by padding if necessary
    IF length(clean_username) < 3 THEN
      clean_username := clean_username || 'usr';
    END IF;
    
    -- Truncate to 15 characters to leave room for our unique random suffix
    IF length(clean_username) > 15 THEN
      clean_username := substring(clean_username from 1 for 15);
    END IF;
    
    -- Append a random number suffix to guarantee uniqueness
    clean_username := clean_username || '_' || floor(random() * 1000)::text;
    
    -- Enforce maximum length of 20 characters
    clean_username := substring(clean_username from 1 for 20);
  END IF;

  -- 3. Perform profile insert with the hardened username
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id, 
    clean_username,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      'New User'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  
  -- Create default user settings
  INSERT INTO public.user_settings (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- From original file: 44_update_gov_audit_ledger_schema.sql
-- =========================================================================

-- Migration: 51_update_gov_audit_ledger_schema.sql
-- Purpose: Align gov_audit_ledger schema with GovernanceService.ts attributes & fix RLS write permissions

-- 1. Add before_state, after_state and scope columns to gov_audit_ledger if they don't exist
ALTER TABLE public.gov_audit_ledger 
ADD COLUMN IF NOT EXISTS before_state JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS after_state JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS scope JSONB DEFAULT '{"global": true}'::jsonb;

-- 2. Drop existing policies to prevent naming conflicts
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.gov_audit_ledger;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.gov_audit_ledger;
DROP POLICY IF EXISTS "Staff can manage approval queue" ON public.gov_approval_queue;
DROP POLICY IF EXISTS "Staff can view relationship data" ON public.gov_entity_relationships;

-- 3. Create the corrected RLS policies using public.user_roles (enabling both read & write for authorized staff)
CREATE POLICY "Staff can view audit logs" ON public.gov_audit_ledger
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can insert audit logs" ON public.gov_audit_ledger
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can manage approval queue" ON public.gov_approval_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('moderator', 'admin', 'super_admin')
        )
    );

CREATE POLICY "Staff can view relationship data" ON public.gov_entity_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );


-- =========================================================================
-- From original file: 45_add_announcement_rich_media.sql
-- =========================================================================

-- Migration: 52_add_announcement_rich_media.sql
-- Purpose: Add image attachment and push notification triggers to system broadcasts

ALTER TABLE public.system_announcements
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS send_push BOOLEAN DEFAULT false;


-- =========================================================================
-- From original file: 46_fix_join_request_trigger_type.sql
-- =========================================================================

-- Migration: 53_fix_join_request_trigger_type.sql
-- Purpose: Fix the type mismatch and regression in handle_new_notification() trigger.
-- In the April 16 migration, `_related_id := NEW.id;` was set for `project_space_join_requests`.
-- Since `project_space_join_requests.id` is a `bigint` but `notifications.related_id` is a `UUID`,
-- this cast failed with a 400 Bad Request. We correct it to `NEW.project_space_id`.
-- We also restore missing triggers for job_applications and room_join_requests that were dropped in 20260416.

CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
    _recipient_id UUID;
    _actor_id UUID;
    _actor_name TEXT;
    _project_name TEXT;
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

    -- A. HANDLE LIKES (both 'likes' and 'post_likes')
    IF (TG_TABLE_NAME = 'likes' OR TG_TABLE_NAME = 'post_likes') AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _related_type := 'post';
        _type := 'like';
        _priority := 'low';
        
        -- Get post author
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        
        -- Don't notify if liking own post
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
            -- user_connections.id is UUID
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
        
        SELECT creator_id, name INTO _recipient_id, _project_name 
        FROM public.project_spaces 
        WHERE id = NEW.project_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_id || '/space';

    -- F. HANDLE PROJECT SPACE JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        -- CRITICAL: NEW.id is bigint! Must use NEW.project_space_id which is a UUID!
        _related_id := NEW.project_space_id;
        _related_type := 'project';
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name INTO _recipient_id, _project_name 
        FROM public.project_spaces 
        WHERE id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project');
        _priority := 'high';
        _is_actionable := true;
        _action_url := '/projects/' || NEW.project_space_id || '/space';

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

-- Re-create triggers to ensure they point to the correct function definition
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


-- =========================================================================
-- From original file: 47_add_push_token_to_profiles.sql
-- =========================================================================

-- Add push_token column to public.profiles if it does not already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;


-- =========================================================================
-- From original file: 48_fix_project_action_urls.sql
-- =========================================================================

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


