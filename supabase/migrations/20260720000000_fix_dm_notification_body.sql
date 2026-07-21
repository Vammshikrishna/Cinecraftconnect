-- Fix DM Notification Body (FCM Description)
-- The previous migration incorrectly hardcoded the message body instead of using formatted_msg

CREATE OR REPLACE FUNCTION public.notify_new_direct_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  sender_name TEXT;
  formatted_msg TEXT;
  notif_metadata JSONB;
BEGIN
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  formatted_msg := public.format_notification_message(NEW.content);

  IF NEW.content LIKE '%__e2ee%' THEN
    notif_metadata := jsonb_build_object('encrypted_content', NEW.content);
  ELSE
    notif_metadata := NULL;
  END IF;

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
    metadata
  ) VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'new_message',
    sender_name,  -- Title should be the sender's name
    formatted_msg, -- Description should be the actual message or fallback
    '/messages/' || NEW.sender_id,
    NEW.id,
    'direct_message',
    'high',
    false,
    notif_metadata
  );

  RETURN NEW;
END;
$$;
