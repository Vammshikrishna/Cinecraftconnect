-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Part AO – Search speed
--   Search uses ILIKE '%term%' (partial matches). These trigram indexes make those lookups fast as the data grows.
--   Safe to run any time; every index is created only if it does not exist yet. No app change is needed.
--   (Some of these already exist from the earlier performance migrations; those are skipped.)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_posts_content_trgm        ON public.posts          USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_craft_trgm       ON public.profiles       USING gin (craft gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_company_pages_name_trgm   ON public.company_pages  USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_announcements_title_trgm  ON public.announcements  USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_skills_name_trgm     ON public.user_skills    USING gin (skill_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_blocked_users_user        ON public.blocked_users  (user_id);
