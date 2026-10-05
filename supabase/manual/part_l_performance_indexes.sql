-- PART L: safe to run now (adds read-path indexes; tolerant of missing tables).
BEGIN;
-- Additional indexes for the hottest read paths (feed, profile, notifications, chat unread counts,
-- membership checks used by RLS, and ILIKE search). Each statement is tolerant: if a table or column is
-- missing in a given deployment it is skipped with a NOTICE instead of aborting the migration.
-- NOTE: plain CREATE INDEX takes a short write lock. On a large live database, run these one at a time
-- with CREATE INDEX CONCURRENTLY from the SQL editor instead (CONCURRENTLY cannot run inside a transaction).

DO $$
DECLARE
  stmt text;
  stmts text[] := ARRAY[
    -- notifications list + badge counts
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC)',
    -- unread DM badge (receiver_id + is_read = false)
    'CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_unread ON public.direct_messages (receiver_id) WHERE is_read = false',
    'CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created ON public.direct_messages (sender_id, created_at DESC)',
    -- comments / likes
    'CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments (post_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes (post_id)',
    'CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON public.post_bookmarks (user_id)',
    -- profile page: a user''s posts newest-first
    'CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts (author_id, created_at DESC)',
    -- connections / follows (profile counts, "is connected" checks, RLS)
    'CREATE INDEX IF NOT EXISTS idx_user_connections_follower_status ON public.user_connections (follower_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_user_connections_following_status ON public.user_connections (following_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows (follower_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows (following_id)',
    -- membership lookups used by many RLS policies
    'CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON public.room_members (room_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_space_members_user ON public.project_space_members (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_space_members_space_user ON public.project_space_members (project_space_id, user_id)',
    -- jobs
    'CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications (job_id)',
    'CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON public.job_applications (applicant_id)',
    -- ILIKE '%term%' search (pg_trgm GIN); profiles.full_name already has one
    'CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin (username public.gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_projects_title_trgm ON public.projects USING gin (title public.gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_discussion_rooms_title_trgm ON public.discussion_rooms USING gin (title public.gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_vendors_business_name_trgm ON public.vendors USING gin (business_name public.gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_marketplace_listings_title_trgm ON public.marketplace_listings USING gin (title public.gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_company_pages_name_trgm ON public.company_pages USING gin (name public.gin_trgm_ops)'
  ];
BEGIN
  FOREACH stmt IN ARRAY stmts LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped (% ): %', SQLERRM, stmt;
    END;
  END LOOP;
END
$$;

ANALYZE;
COMMIT;
