-- 39_identity_hardening.sql
-- Fixes issues with profile metadata synchronization and RLS permissions

-- 1. Enhance handle_new_user trigger to be more robust with metadata keys
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id, 
    COALESCE(
      new.raw_user_meta_data->>'username', 
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1) || '_' || floor(random() * 1000)::text
    ), 
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      'New User'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  
  -- Create default settings
  INSERT INTO public.user_settings (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add RLS policies to allow internal staff to manage profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_current_user_internal());

-- 3. Ensure user_roles has correct RLS policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view internal roles" ON public.user_roles;
CREATE POLICY "Anyone can view internal roles" ON public.user_roles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_current_user_internal());

-- 4. Fix is_internal sync trigger to handle race conditions better
CREATE OR REPLACE FUNCTION public.sync_is_internal_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.role IN ('admin', 'moderator', 'super_admin') THEN
      UPDATE public.profiles SET is_internal = true WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles SET is_internal = false WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET is_internal = false WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
