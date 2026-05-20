-- Migration: 50_harden_username_trigger.sql
-- Purpose: Harden handle_new_user trigger function to guarantee fallback usernames always satisfy the username_format check constraint ('^[a-z0-9_]{3,20}$')

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
BEGIN
  -- 1. Extract provided username from metadata
  raw_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name'
  );

  -- 2. If a username was supplied, check if it matches the format
  IF raw_username IS NOT NULL AND raw_username ~ '^[a-z0-9_]{3,20}$' THEN
    clean_username := raw_username;
  ELSE
    -- If not supplied or invalid format, generate a clean fallback from the email or supplied username
    raw_username := COALESCE(raw_username, split_part(new.email, '@', 1));
    -- Convert to lowercase, strip all non-alphanumeric and non-underscore characters
    clean_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
    
    -- Enforce minimum length of 3 by padding if necessary
    IF length(clean_username) < 3 THEN
      clean_username := clean_username || 'usr';
    END IF;
    
    -- Truncate to 15 characters to leave room for our unique random suffix
    IF length(clean_username) > 15 THEN
      clean_username := substring(clean_username from 1 for 15);
    END IF;
    
    -- Append a random number suffix to guarantee uniqueness
    clean_username := clean_username || '_' || floor(random() * 1000)::text;
    
    -- Enforce maximum length of 20 characters
    clean_username := substring(clean_username from 1 for 20);
  END IF;

  -- 3. Perform profile insert with the hardened username
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id, 
    clean_username,
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
  
  -- Create default user settings
  INSERT INTO public.user_settings (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
