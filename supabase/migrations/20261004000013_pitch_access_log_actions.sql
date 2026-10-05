-- The web app logs 'pdf_downloaded' (and previously 'attachment_opened'), but the CHECK constraint only allowed
-- viewed / full_synopsis_viewed / attachment_downloaded, so those inserts failed silently and no access was recorded.
ALTER TABLE public.pitch_access_logs DROP CONSTRAINT IF EXISTS pitch_access_logs_action_check;
ALTER TABLE public.pitch_access_logs ADD CONSTRAINT pitch_access_logs_action_check
  CHECK (action = ANY (ARRAY['viewed', 'full_synopsis_viewed', 'attachment_downloaded', 'attachment_opened', 'pdf_downloaded']));
