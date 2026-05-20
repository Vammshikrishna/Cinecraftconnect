-- =========================================================================
-- Migration: 48_premium_message_notifications.sql
-- Description: Upgrades messaging triggers to write clean, emoji-free, 
--              professional titles and contents directly to notifications.
-- =========================================================================

-- =========================================================================
-- 1. Helper Function to Format Message Previews (Clean / Emoji-Free)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.format_notification_message(content TEXT)
RETURNS TEXT AS $$
DECLARE
  share_type TEXT;
BEGIN
  IF content IS NULL THEN
    RETURN 'Sent an attachment';
  END IF;

  -- Decode premium shared items (e.g. POST_SHARE::JSON)
  IF content LIKE '%_SHARE::%' THEN
    share_type := LOWER(SPLIT_PART(content, '_SHARE::', 1));
    CASE share_type
      WHEN 'post' THEN RETURN 'Shared a post';
      WHEN 'marketplace' THEN RETURN 'Shared a marketplace listing';
      WHEN 'announcement' THEN RETURN 'Shared an announcement';
      WHEN 'vendor' THEN RETURN 'Shared a vendor profile';
      WHEN 'project' THEN RETURN 'Shared a project';
      WHEN 'discussion' THEN RETURN 'Shared a discussion room';
      WHEN 'job' THEN RETURN 'Shared a job';
      WHEN 'craft' THEN RETURN 'Shared a craft';
      WHEN 'profile' THEN RETURN 'Shared a profile';
      ELSE RETURN 'Shared a ' || share_type;
    END CASE;
  END IF;

  -- Decode markdown photos
  IF content LIKE '![%' AND content LIKE '%]%' THEN
    RETURN 'Photo';
  END IF;

  -- Default message body
  RETURN content;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =========================================================================
-- 2. Premium Direct Message Trigger Function (Clean)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

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
    sender_name,  -- Clean Title: e.g. "sanoopu"
    formatted_msg,
    '/messages/' || NEW.sender_id,
    NEW.id,
    'direct_message',
    'high',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- 3. Premium Group Discussion Trigger Function (Clean)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_new_room_message()
RETURNS TRIGGER AS $$
DECLARE
  room_member RECORD;
  sender_name TEXT;
  room_title TEXT;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get room title
  SELECT title INTO room_title
  FROM public.discussion_rooms
  WHERE id = NEW.room_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

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
      sender_name || ' in ' || COALESCE(room_title, 'Discussion'), -- Clean Title: e.g. "sanoopu in Movie Magic"
      formatted_msg,
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


-- =========================================================================
-- 4. Premium Project Space Trigger Function (Clean)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project name
  SELECT name INTO project_name
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
      sender_name || ' in ' || COALESCE(project_name, 'Project Space'), -- Clean Title: e.g. "sanoopu in Pre-production"
      formatted_msg,
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


-- =========================================================================
-- 5. Drop & Recreate Active Database Triggers
-- =========================================================================
DROP TRIGGER IF EXISTS trigger_notify_new_direct_message ON public.direct_messages;
CREATE TRIGGER trigger_notify_new_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_direct_message();

DROP TRIGGER IF EXISTS trigger_notify_new_room_message ON public.room_messages;
CREATE TRIGGER trigger_notify_new_room_message
  AFTER INSERT ON public.room_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_room_message();

DROP TRIGGER IF EXISTS trigger_notify_new_project_message ON public.project_space_messages;
CREATE TRIGGER trigger_notify_new_project_message
  AFTER INSERT ON public.project_space_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_project_message();
