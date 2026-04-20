-- Create user_settings table to store user preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- Appearance Settings
  theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  font_size VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  language VARCHAR(10) DEFAULT 'en',
  
  -- Notification Settings
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  project_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,
  comment_notifications BOOLEAN DEFAULT true,
  job_alerts BOOLEAN DEFAULT true,
  
  -- Privacy Settings
  profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'connections', 'private')),
  show_email BOOLEAN DEFAULT false,
  show_location BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_messages_from VARCHAR(20) DEFAULT 'everyone' CHECK (allow_messages_from IN ('everyone', 'connections', 'nobody')),
  
  -- Accessibility Settings
  high_contrast BOOLEAN DEFAULT false,
  reduce_motion BOOLEAN DEFAULT false,
  
  -- Sound Settings
  sound_effects BOOLEAN DEFAULT true,
  notification_sounds BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Function to create default settings for new users
CREATE OR REPLACE FUNCTION public.create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create settings when a new profile is created
DROP TRIGGER IF EXISTS on_profile_created_create_settings ON public.profiles;
CREATE TRIGGER on_profile_created_create_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_user_settings();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS update_user_settings_timestamp ON public.user_settings;
CREATE TRIGGER update_user_settings_timestamp
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_settings_timestamp();
