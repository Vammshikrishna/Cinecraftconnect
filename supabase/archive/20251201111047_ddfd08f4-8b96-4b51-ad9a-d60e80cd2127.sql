-- ============================================
-- CRITICAL SECURITY FIX: User Roles System
-- ============================================
-- This prevents privilege escalation attacks by properly managing user roles

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 6. Assign 'user' role to all existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- FIX: 7 Tables with Broken RLS (No Policies)
-- ============================================

-- TABLE: budget_items
-- Allow project members to manage budget items
CREATE POLICY "Project members can view budget items"
ON public.budget_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = budget_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert budget items"
ON public.budget_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = budget_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update budget items"
ON public.budget_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = budget_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can delete budget items"
ON public.budget_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = budget_items.project_id
    AND pm.user_id = auth.uid()
  )
);

-- TABLE: call_sheets
CREATE POLICY "Project members can view call sheets"
ON public.call_sheets FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = call_sheets.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert call sheets"
ON public.call_sheets FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = call_sheets.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update call sheets"
ON public.call_sheets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = call_sheets.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can delete call sheets"
ON public.call_sheets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = call_sheets.project_id
    AND pm.user_id = auth.uid()
  )
);

-- TABLE: files
CREATE POLICY "Project members can view files"
ON public.files FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = files.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can upload files"
ON public.files FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = files.project_id
    AND pm.user_id = auth.uid()
  )
  AND auth.uid() = uploaded_by
);

CREATE POLICY "File uploaders can delete their files"
ON public.files FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- TABLE: legal_docs
CREATE POLICY "Project members can view legal docs"
ON public.legal_docs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = legal_docs.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert legal docs"
ON public.legal_docs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = legal_docs.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update legal docs"
ON public.legal_docs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = legal_docs.project_id
    AND pm.user_id = auth.uid()
  )
);

-- TABLE: schedule_items
CREATE POLICY "Project members can view schedule items"
ON public.schedule_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = schedule_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert schedule items"
ON public.schedule_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = schedule_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update schedule items"
ON public.schedule_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = schedule_items.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can delete schedule items"
ON public.schedule_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = schedule_items.project_id
    AND pm.user_id = auth.uid()
  )
);

-- TABLE: shot_list
CREATE POLICY "Project members can view shot list"
ON public.shot_list FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = shot_list.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert shot list"
ON public.shot_list FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = shot_list.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update shot list"
ON public.shot_list FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = shot_list.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can delete shot list"
ON public.shot_list FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = shot_list.project_id
    AND pm.user_id = auth.uid()
  )
);

-- TABLE: tasks
CREATE POLICY "Project members can view tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_space_members psm
    WHERE psm.project_space_id = tasks.project_space_id
    AND psm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can insert tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_space_members psm
    WHERE psm.project_space_id = tasks.project_space_id
    AND psm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can update tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_space_members psm
    WHERE psm.project_space_id = tasks.project_space_id
    AND psm.user_id = auth.uid()
  )
);

CREATE POLICY "Project members can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_space_members psm
    WHERE psm.project_space_id = tasks.project_space_id
    AND psm.user_id = auth.uid()
  )
);

-- ============================================
-- FIX: Function Search Path Security Issues
-- ============================================
-- Adds SET search_path to functions to prevent schema injection attacks

-- Fix get_user_conversations
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_user_username text, last_message_content text, last_message_created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS conversation_id,
        CASE
            WHEN c.user1_id = p_user_id THEN c.user2_id
            ELSE c.user1_id
        END AS other_user_id,
        u.raw_user_meta_data->>'username' AS other_user_username,
        (SELECT content FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_content,
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_created_at
    FROM
        public.conversations c
    JOIN
        auth.users u ON u.id = (CASE WHEN c.user1_id = p_user_id THEN c.user2_id ELSE c.user1_id END)
    WHERE
        c.user1_id = p_user_id OR c.user2_id = p_user_id
    ORDER BY
        (SELECT created_at FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) DESC;
END; 
$function$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix update_posts_updated_at
CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix update_project_space_last_activity
CREATE OR REPLACE FUNCTION public.update_project_space_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    UPDATE public.project_spaces
    SET last_activity_at = now()
    WHERE id = NEW.project_space_id;
    RETURN NEW;
END;
$function$;

-- Fix notify_new_room_message
CREATE OR REPLACE FUNCTION public.notify_new_room_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  room_member RECORD;
  sender_name TEXT;
BEGIN
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  FOR room_member IN 
    SELECT user_id 
    FROM public.room_members 
    WHERE room_id = NEW.room_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id, trigger_user_id, type, title, message,
      action_url, related_id, related_type, priority, is_read, created_at
    ) VALUES (
      room_member.user_id, NEW.user_id, 'new_message', 'New Message',
      sender_name || ' sent a message', '/discussion-rooms/' || NEW.room_id,
      NEW.id, 'room_message', 'medium', false, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Fix notify_new_project_message
CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
BEGIN
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  SELECT name INTO project_name
  FROM public.project_spaces
  WHERE id = NEW.project_id;

  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id, trigger_user_id, type, title, message,
      action_url, related_id, related_type, priority, is_read, created_at
    ) VALUES (
      project_member.user_id, NEW.user_id, 'new_message', 'New Project Message',
      sender_name || ' sent a message in ' || COALESCE(project_name, 'a project'),
      '/projects/' || NEW.project_id || '/space', NEW.id, 'project_message', 
      'medium', false, NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$;