-- 12_performance_indexes.sql
-- Optimized indexes for high-concurrency features (Feed, Marketplace, Network)

-- Enable extension for fuzzy search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Posts Table (Social Engine)
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON public.posts (like_count DESC);

-- 2. Marketplace Listings
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON public.marketplace_listings (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_created_at ON public.marketplace_listings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON public.marketplace_listings (category);

-- 3. Profiles (Talent Network)
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_craft ON public.profiles (craft);

-- 4. Messaging
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);

-- 5. Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON public.notifications (user_id) WHERE is_read = false;

-- 6. Projects & Rooms
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_created_at ON public.discussion_rooms (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_rooms_project_id ON public.discussion_rooms (project_id);

-- 7. Jobs & Announcements
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs (type);
CREATE INDEX IF NOT EXISTS idx_announcements_posted_at ON public.announcements (posted_at DESC);

-- 8. Marketplace Reviews
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_listing_id ON public.marketplace_reviews (listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_rating ON public.marketplace_reviews (rating DESC);

-- 9. Film Reviews
CREATE INDEX IF NOT EXISTS idx_film_reviews_tmdb_id ON public.film_reviews (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_film_reviews_created_at ON public.film_reviews (created_at DESC);
