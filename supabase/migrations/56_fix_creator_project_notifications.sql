-- =========================================================================
-- Migration: 56_fix_creator_project_notifications.sql
-- Description: Ensures that the creator of a project space receives notifications
--              for messages sent by other members, even if the creator is not
--              explicitly added to the project_space_members table.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
  parent_project_id UUID;
  creator_id UUID;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project space name, parent project_id, and creator_id
  SELECT name, project_id, creator_id INTO project_name, parent_project_id, creator_id
  FROM public.project_spaces
  WHERE id = NEW.project_space_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

  -- Create notifications for all project members AND the creator, except the sender
  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_space_id 
    AND user_id != NEW.user_id
    UNION
    SELECT creator_id AS user_id
    FROM public.project_spaces
    WHERE id = NEW.project_space_id
      AND creator_id != NEW.user_id
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
