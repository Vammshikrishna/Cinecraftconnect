"-- 1. Update format_notification_message to return a clean fallback for E2EE messages
CREATE OR REPLACE FUNCTION public.format_notification_message(content text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  share_type TEXT;
BEGIN
  IF content IS NULL THEN
    RETURN 'Sent an attachment';
  END IF;

  -- Detect E2EE messages and return clean fallback text
  IF content LIKE '%__e2ee%' THEN
    RETURN 'ðŸ”’ Encrypted message';
  END IF;

  -- Decode premium shared items
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

  -- Default
  RETURN content;
END;
$$;


-- 2. Update notify_new_direct_message to include E2EE content in metadata JSONB
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

  INSERT INTO public.notificati
<truncated 3730 bytes>
