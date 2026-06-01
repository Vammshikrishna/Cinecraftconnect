-- Migration: 61_harden_profiles_columns.sql
-- Restricts public read access to cryptographic and sensitive columns in public.profiles.

-- 1. Revoke full SELECT privilege from public roles
REVOKE SELECT ON public.profiles FROM public;
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Grant SELECT only on safe, public columns to public roles
GRANT SELECT (
  id, 
  updated_at, 
  username, 
  full_name, 
  avatar_url, 
  cover_image_url, 
  website, 
  bio, 
  location, 
  experience, 
  craft, 
  instagram_url, 
  youtube_url, 
  account_type, 
  onboarding_completed, 
  is_internal, 
  public_key, 
  social_links, 
  is_verified, 
  is_banned, 
  trust_score, 
  phone,
  push_token,
  shadow_banned_at,
  is_shadowbanned,
  is_official_team,
  force_password_reset,
  restriction_flags
) ON public.profiles TO public;

GRANT SELECT (
  id, 
  updated_at, 
  username, 
  full_name, 
  avatar_url, 
  cover_image_url, 
  website, 
  bio, 
  location, 
  experience, 
  craft, 
  instagram_url, 
  youtube_url, 
  account_type, 
  onboarding_completed, 
  is_internal, 
  public_key, 
  social_links, 
  is_verified, 
  is_banned, 
  trust_score, 
  phone,
  push_token,
  shadow_banned_at,
  is_shadowbanned,
  is_official_team,
  force_password_reset,
  restriction_flags
) ON public.profiles TO authenticated;

GRANT SELECT (
  id, 
  updated_at, 
  username, 
  full_name, 
  avatar_url, 
  cover_image_url, 
  website, 
  bio, 
  location, 
  experience, 
  craft, 
  instagram_url, 
  youtube_url, 
  account_type, 
  onboarding_completed, 
  is_internal, 
  public_key, 
  social_links, 
  is_verified, 
  is_banned, 
  trust_score, 
  phone,
  push_token,
  shadow_banned_at,
  is_shadowbanned,
  is_official_team,
  force_password_reset,
  restriction_flags
) ON public.profiles TO anon;

-- Note: postgres owner, superusers, and service_role retain full access automatically.
