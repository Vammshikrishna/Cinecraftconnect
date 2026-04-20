-- FIX MESSAGE NOTIFICATIONS AND SOUNDS
-- This migration ensures that DMs and Project Space messages trigger the notification system (and sounds)

-- 1. FIX PROJECT SPACE NOTIFICATIONS
CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project name
  SELECT name INTO project_name
  FROM public.project_spaces
  WHERE id = NEW.project_space_id;

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
      'New Project Message',
      sender_name || ' sent a message in ' || COALESCE(project_name, 'a project'),
      '/projects/' || NEW.project_space_id || '/space',
      NEW.id,
      'project_message',
      'medium',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-link trigger for project_space_messages
DROP TRIGGER IF EXISTS trigger_notify_new_project_message ON public.project_space_messages;
CREATE TRIGGER trigger_notify_new_project_message
  AFTER INSERT ON public.project_space_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_project_message();


-- 2. ADD DIRECT MESSAGE NOTIFICATIONS
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Create notification for the receiver
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
    NEW.receiver_id,
    NEW.sender_id,
    'new_message',
    'New Direct Message',
    sender_name || ' sent you a message',
    '/messages/' || NEW.sender_id, -- Link to the chat with this user
    NEW.id,
    'direct_message',
    'high',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for direct_messages
DROP TRIGGER IF EXISTS trigger_notify_new_direct_message ON public.direct_messages;
CREATE TRIGGER trigger_notify_new_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_direct_message();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.notify_new_project_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_direct_message() TO authenticated;
