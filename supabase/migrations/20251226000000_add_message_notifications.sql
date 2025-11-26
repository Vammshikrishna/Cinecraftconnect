-- Migration: Add automatic notification creation for new messages
-- This creates notifications when users receive new messages in discussion rooms

-- Function to create notification when a new message is sent
CREATE OR REPLACE FUNCTION public.notify_new_room_message()
RETURNS TRIGGER AS $$
DECLARE
  room_member RECORD;
  sender_name TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Create notifications for all room members except the sender
  FOR room_member IN 
    SELECT user_id 
    FROM public.room_members 
    WHERE room_id = NEW.room_id 
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
      is_read,
      created_at
    ) VALUES (
      room_member.user_id,
      NEW.user_id,
      'new_message',
      'New Message',
      sender_name || ' sent a message',
      '/discussion-rooms/' || NEW.room_id,
      NEW.id,
      'room_message',
      'medium',
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for room_messages
DROP TRIGGER IF EXISTS trigger_notify_new_room_message ON public.room_messages;
CREATE TRIGGER trigger_notify_new_room_message
  AFTER INSERT ON public.room_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_room_message();

-- Function to create notification when a new project message is sent
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
  WHERE id = NEW.sender_id;

  -- Get project name
  SELECT name INTO project_name
  FROM public.project_spaces
  WHERE id = NEW.project_id;

  -- Create notifications for all project members except the sender
  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_id 
    AND user_id != NEW.sender_id
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
      NEW.sender_id,
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

-- Create trigger for project_messages
DROP TRIGGER IF EXISTS trigger_notify_new_project_message ON public.project_messages;
CREATE TRIGGER trigger_notify_new_project_message
  AFTER INSERT ON public.project_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_project_message();

-- Add trigger_user_id column to notifications if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'trigger_user_id'
  ) THEN
    ALTER TABLE public.notifications 
    ADD COLUMN trigger_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.notify_new_room_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_project_message() TO authenticated;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at 
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read 
  ON public.notifications(user_id, is_read);
