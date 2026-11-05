-- PART FK2 - settings switches that never saved (replaces part FF). Safe to run more than once.
--
-- WHAT WENT WRONG: the live user_settings table is missing columns the website and app write. Saving them fails with
-- "Could not find the 'message_notifications' column of 'user_settings' in the schema cache" (HTTP 400, PGRST204) and the switch jumps back
-- after a reload. Found by toggling every switch: these did NOT save: Notifications (Messages, Comments and mentions, Project updates, Job alerts),
-- Privacy (Show email, Show location), Activity status, Accessibility (High contrast, Reduce motion), Sound (Sound effects, Message and call chimes).
-- Opening any public profile also failed (get_profile_activity reads show_online_status): this part includes what part FF did.
-- THE FIX: add every column the settings code uses, with the same defaults the screens show. Existing rows get the default.
--
-- PREFLIGHT (read only): select column_name from information_schema.columns where table_schema = 'public' and table_name = 'user_settings'
--   and column_name in ('message_notifications','comment_notifications','project_notifications','job_alerts','show_email','show_location',
--   'show_online_status','high_contrast','reduce_motion','sound_effects','notification_sounds','font_size');   -- fewer than 12 rows now
-- POST-CHECK  (read only): the same query returns 12 rows; toggle any of the switches above, reload: it stays.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_notifications   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_notifications    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS project_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_alerts            boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_email            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_location        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status   boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS high_contrast        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reduce_motion        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sound_effects        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_sounds  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS font_size            text    DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS theme                text    DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS language             text    DEFAULT 'en';

NOTIFY pgrst, 'reload schema';
