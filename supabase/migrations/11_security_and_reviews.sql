-- Consolidated Migration: 11_security_and_reviews.sql

-- =========================================================================
-- From original file: 28_harden_storage_security.sql
-- =========================================================================

-- 34_harden_storage_security.sql
-- Hardening storage policies for all buckets and ensuring public access for optimized delivery

-- 1. Post Media Policies
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

-- 2. Call Sheets & Legal Docs (Private Access)
DROP POLICY IF EXISTS "Auth view call-sheets" ON storage.objects;
CREATE POLICY "Auth view call-sheets" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'call-sheets' );

DROP POLICY IF EXISTS "Auth view legal-docs" ON storage.objects;
CREATE POLICY "Auth view legal-docs" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'legal-docs' );

-- 3. Ensure profiles table column consistency
-- Many frontend components use cover_image_url while core schema used cover_url
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
        ALTER TABLE public.profiles RENAME COLUMN cover_url TO cover_image_url;
    END IF;
END $$;

-- 4. Social Graph Visibility
-- Standardize connection visibility so public profiles show correct counts
DROP POLICY IF EXISTS "Users can view own connections" ON public.user_connections;
DROP POLICY IF EXISTS "Anyone can view accepted connections" ON public.user_connections;
CREATE POLICY "Anyone can view accepted connections" ON public.user_connections 
FOR SELECT USING (status = 'accepted');

DROP POLICY IF EXISTS "Users can view own pending connections" ON public.user_connections;
CREATE POLICY "Users can view own pending connections" ON public.user_connections 
FOR SELECT USING (follower_id = auth.uid() OR following_id = auth.uid());

-- 5. Social & Content Column Consistency
-- Ensure posts and announcements have columns required by the UI for categorization
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS page_id uuid;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS publisher_page_id uuid;

-- 6. Optimized Asset Metadata (Optional helper)
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON public.user_connections (status);
CREATE INDEX IF NOT EXISTS idx_posts_page_id ON public.posts (page_id) WHERE page_id IS NOT NULL;


-- =========================================================================
-- From original file: 29_add_review_anonymity.sql
-- =========================================================================

-- Add is_anonymous column to film_reviews
ALTER TABLE public.film_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;


-- =========================================================================
-- From original file: 30_segmented_film_ratings.sql
-- =========================================================================

-- Create an updated RPC that calculates segmented ratings based on account type
CREATE OR REPLACE FUNCTION public.get_segmented_film_ratings(tmdb_ids integer[])
RETURNS TABLE (
    tmdb_id integer,
    overall_average numeric,
    overall_count bigint,
    pro_average numeric,
    pro_count bigint,
    fan_average numeric,
    fan_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        ROUND(AVG(ufr.rating)::numeric, 1) as overall_average,
        COUNT(*) as overall_count,
        ROUND(AVG(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN ufr.rating ELSE NULL END)::numeric, 1) as pro_average,
        COUNT(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN 1 ELSE NULL END) as pro_count,
        ROUND(AVG(CASE WHEN p.account_type = 'fan' THEN ufr.rating ELSE NULL END)::numeric, 1) as fan_average,
        COUNT(CASE WHEN p.account_type = 'fan' THEN 1 ELSE NULL END) as fan_count
    FROM 
        public.user_film_ratings ufr
    JOIN
        public.profiles p ON ufr.user_id = p.id
    WHERE 
        ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY 
        ufr.tmdb_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_segmented_film_ratings(integer[]) TO authenticated, anon;


-- =========================================================================
-- From original file: 31_hide_internal_users.sql
-- =========================================================================

-- 37_hide_internal_users.sql

-- 1. Add is_internal column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- 2. Create a helper function to check if the current auth.uid() is an internal user
CREATE OR REPLACE FUNCTION public.is_current_user_internal()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger function to keep profiles.is_internal in sync with user_roles
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

-- 4. Attach trigger to user_roles
DROP TRIGGER IF EXISTS user_roles_sync_is_internal ON public.user_roles;
CREATE TRIGGER user_roles_sync_is_internal
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE PROCEDURE public.sync_is_internal_trigger();

-- 5. Backfill existing internal users
UPDATE public.profiles
SET is_internal = true
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'moderator', 'super_admin')
);

-- 6. Update the RLS policy on profiles to hide internal users from public view
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR is_internal = false
  OR public.is_current_user_internal()
);


-- =========================================================================
-- From original file: 32_internal_governance_expansion.sql
-- =========================================================================

-- 38_internal_governance_expansion.sql
-- Expand internal tools: Verification, Broadcasts, VIP Invites, Shadowbans

-- 1. Add shadowban flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_shadowbanned boolean DEFAULT false;

-- 2. Verification Requests Table
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    portfolio_links text[] NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own requests" ON public.verification_requests FOR SELECT USING (user_id = auth.uid() OR public.is_current_user_internal());
CREATE POLICY "Users can insert their own requests" ON public.verification_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Internals can update requests" ON public.verification_requests FOR UPDATE USING (public.is_current_user_internal());

-- 3. Platform Announcements (Global Broadcasts)
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance', 'update')),
    target_audience text DEFAULT 'all' CHECK (target_audience IN ('all', 'creators', 'fans', 'studios')),
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_announcement_dismissals (
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    announcement_id uuid REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
    dismissed_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, announcement_id)
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active announcements" ON public.platform_announcements FOR SELECT USING (is_active = true OR public.is_current_user_internal());
CREATE POLICY "Internals can manage announcements" ON public.platform_announcements FOR ALL USING (public.is_current_user_internal());

ALTER TABLE public.user_announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their dismissals" ON public.user_announcement_dismissals FOR ALL USING (user_id = auth.uid());

-- 4. VIP Invite Codes
CREATE TABLE IF NOT EXISTS public.vip_invites (
    code text PRIMARY KEY,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_used boolean DEFAULT false,
    used_by_id uuid REFERENCES public.profiles(id),
    role_granted text DEFAULT 'creator_pro',
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vip_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internals can manage invites" ON public.vip_invites FOR ALL USING (public.is_current_user_internal());
-- Everyone needs to be able to SELECT to validate a code, but only unused ones
CREATE POLICY "Public can view unused invites to validate" ON public.vip_invites FOR SELECT USING (is_used = false);
-- Public can UPDATE an invite to mark it as used during signup
CREATE POLICY "Public can use invite codes" ON public.vip_invites FOR UPDATE USING (is_used = false) WITH CHECK (is_used = true);


-- =========================================================================
-- From original file: 33_identity_hardening.sql
-- =========================================================================

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


-- =========================================================================
-- From original file: 34_fix_review_schema.sql
-- =========================================================================

-- 40_fix_review_schema.sql
-- Forcefully ensures that the film_reviews table has the is_anonymous column
-- and refreshes the schema cache.

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='film_reviews' AND column_name='is_anonymous'
    ) THEN
        ALTER TABLE public.film_reviews ADD COLUMN is_anonymous BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Also add is_spoiler just in case it's missing
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='film_reviews' AND column_name='is_spoiler'
    ) THEN
        ALTER TABLE public.film_reviews ADD COLUMN is_spoiler BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'film_reviews_user_tmdb_unique'
    ) THEN
        ALTER TABLE public.film_reviews ADD CONSTRAINT film_reviews_user_tmdb_unique UNIQUE (user_id, tmdb_id);
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


