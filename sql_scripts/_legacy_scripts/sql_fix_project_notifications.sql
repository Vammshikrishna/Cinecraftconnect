-- Fix the notify_new_project_message function to use user_id instead of sender_id

CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
BEGIN
  -- Get sender's name (Fixed: using NEW.user_id)
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project name
  SELECT name INTO project_name
  FROM public.project_spaces
  WHERE id = NEW.project_id;

  -- Create notifications for all project members except the sender
  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_id 
    AND user_id != NEW.user_id -- Fixed: using NEW.user_id
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
      is_read,
      created_at
    ) VALUES (
      project_member.user_id,
      NEW.user_id, -- Fixed: using NEW.user_id
      'new_message',
      'New Project Message',
      sender_name || ' sent a message in ' || COALESCE(project_name, 'a project'),
      '/projects/' || NEW.project_id || '/space',
      NEW.id,
      'project_message',
      'medium',
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
