-- PHASE 2: run ONLY after the web + mobile builds that read profile_extras are live.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS instagram_url,
  DROP COLUMN IF EXISTS youtube_url,
  DROP COLUMN IF EXISTS social_links,
  DROP COLUMN IF EXISTS union_membership,
  DROP COLUMN IF EXISTS day_rate_min,
  DROP COLUMN IF EXISTS day_rate_max;
