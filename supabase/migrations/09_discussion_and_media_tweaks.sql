-- Consolidated Migration: 09_discussion_and_media_tweaks.sql

-- =========================================================================
-- From original file: 09_media_storage.sql
-- =========================================================================

-- media_storage.sql

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('portfolios', 'portfolios', true),
    ('project-files', 'project-files', false),
    ('post-media', 'post-media', true),
    ('call-sheets', 'call-sheets', false),
    ('legal-docs', 'legal-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (Standardized)

-- All authenticated users can list buckets
DROP POLICY IF EXISTS "Authenticated can list buckets" ON storage.buckets;
CREATE POLICY "Authenticated can list buckets" ON storage.buckets FOR SELECT TO authenticated USING ( true );

-- Avatars: Public Read, Auth Upload
DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
CREATE POLICY "Public view avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Portfolios: Public Read, Owner Manage
DROP POLICY IF EXISTS "Public view portfolios" ON storage.objects;
CREATE POLICY "Public view portfolios" ON storage.objects FOR SELECT USING ( bucket_id = 'portfolios' );
CREATE POLICY "Owner manage portfolios" ON storage.objects FOR ALL USING ( bucket_id = 'portfolios' AND owner = auth.uid() );

-- Project Files: Access for project members only
DROP POLICY IF EXISTS "Project members view files" ON storage.objects;
CREATE POLICY "Project members view files" ON storage.objects FOR SELECT USING (
    bucket_id = 'project-files' AND EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
    )
);

-- 3. Post Media Policies
DROP POLICY IF EXISTS "Public view post-media" ON storage.objects;
CREATE POLICY "Public view post-media" ON storage.objects FOR SELECT USING ( bucket_id = 'post-media' );

DROP POLICY IF EXISTS "Auth upload post-media" ON storage.objects;
CREATE POLICY "Auth upload post-media" ON storage.objects FOR INSERT WITH CHECK ( 
    bucket_id = 'post-media' AND 
    auth.role() = 'authenticated' 
);

DROP POLICY IF EXISTS "Owner manage post-media" ON storage.objects;
CREATE POLICY "Owner manage post-media" ON storage.objects FOR ALL USING ( 
    bucket_id = 'post-media' AND 
    owner = auth.uid() 
);


-- =========================================================================
-- From original file: 10_discussion_room_triggers.sql
-- =========================================================================

-- 11_discussion_room_triggers.sql

-- Function to update the member count in discussion_rooms
CREATE OR REPLACE FUNCTION public.update_discussion_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.discussion_rooms
        SET member_count = member_count + 1
        WHERE id = NEW.room_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.discussion_rooms
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = OLD.room_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on insert or delete in room_members
DROP TRIGGER IF EXISTS on_room_member_change ON public.room_members;
CREATE TRIGGER on_room_member_change
AFTER INSERT OR DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.update_discussion_room_member_count();

-- Initial sync of member counts (in case any are currently out of sync)
UPDATE public.discussion_rooms dr
SET member_count = (
    SELECT count(*)
    FROM public.room_members rm
    WHERE rm.room_id = dr.id
);


-- =========================================================================
-- From original file: 11_performance_indexes.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 12_discussion_room_settings.sql
-- =========================================================================

-- Migration: Add JSONB settings column to discussion_rooms
-- Description: Adds a flexible settings column to store all advanced room configuration options.

ALTER TABLE discussion_rooms ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;


-- =========================================================================
-- From original file: 13_fix_room_members_relationship.sql
-- =========================================================================

-- Fix: Ensure room_members has the correct foreign key relationship to profiles
-- This ensures that the .select('*, profiles(*)') query works correctly in PostgREST

-- 1. Ensure the role column exists (if it was missing)
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';

-- 2. Drop and recreate the foreign key to profiles if necessary
-- We use a DO block to safely check and add the constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_members_user_id_fkey' 
        AND table_name = 'room_members'
    ) THEN
        ALTER TABLE public.room_members 
        ADD CONSTRAINT room_members_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Notify PostgREST to reload its schema cache (optional but helpful)
NOTIFY pgrst, 'reload schema';


