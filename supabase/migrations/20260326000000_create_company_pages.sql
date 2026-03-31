-- 0. Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company_assets', 'company_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company_assets
DROP POLICY IF EXISTS "Company Assets Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Company Assets Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Company Assets Owner Manage" ON storage.objects;
DROP POLICY IF EXISTS "Company Assets Owner Delete" ON storage.objects;

CREATE POLICY "Company Assets Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company_assets');
CREATE POLICY "Company Assets Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company_assets' AND auth.role() = 'authenticated');
CREATE POLICY "Company Assets Owner Manage" ON storage.objects FOR UPDATE USING (bucket_id = 'company_assets' AND auth.uid() = owner);
CREATE POLICY "Company Assets Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'company_assets' AND auth.uid() = owner);

-- ============================================================
-- COMPANY PAGES MODULE (LinkedIn Pages equivalent)
-- ============================================================

-- 1. Company Pages table
CREATE TABLE IF NOT EXISTS company_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  industry TEXT[] DEFAULT '{}',
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+')),
  founded_year INTEGER,
  headquarters TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  specialties TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Page admins (multi-admin support)
CREATE TABLE IF NOT EXISTS company_page_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'content_admin', 'analyst')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- 3. Page followers
CREATE TABLE IF NOT EXISTS company_page_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- 4. Page team members (employees)
CREATE TABLE IF NOT EXISTS company_page_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES company_pages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, user_id)
);

-- 5. Add page_id to posts table (so pages can publish posts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'page_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN page_id UUID REFERENCES company_pages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add page_id to jobs table (link jobs to company pages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'page_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN page_id UUID REFERENCES company_pages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ENSURE CONSTRAINTS POINT TO PROFILES (Crucial for joins)
DO $$
BEGIN
  -- company_pages owner_id
  ALTER TABLE company_pages DROP CONSTRAINT IF EXISTS company_pages_owner_id_fkey;
  ALTER TABLE company_pages ADD CONSTRAINT company_pages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- company_page_admins user_id
  ALTER TABLE company_page_admins DROP CONSTRAINT IF EXISTS company_page_admins_user_id_fkey;
  ALTER TABLE company_page_admins ADD CONSTRAINT company_page_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- company_page_followers user_id
  ALTER TABLE company_page_followers DROP CONSTRAINT IF EXISTS company_page_followers_user_id_fkey;
  ALTER TABLE company_page_followers ADD CONSTRAINT company_page_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- company_page_members user_id
  ALTER TABLE company_page_members DROP CONSTRAINT IF EXISTS company_page_members_user_id_fkey;
  ALTER TABLE company_page_members ADD CONSTRAINT company_page_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some constraints could not be updated (might not exist yet)';
END $$;

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_pages_owner ON company_pages(owner_id);
CREATE INDEX IF NOT EXISTS idx_company_pages_slug ON company_pages(slug);
CREATE INDEX IF NOT EXISTS idx_company_page_followers_page ON company_page_followers(page_id);
CREATE INDEX IF NOT EXISTS idx_company_page_followers_user ON company_page_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_company_page_members_page ON company_page_members(page_id);
CREATE INDEX IF NOT EXISTS idx_company_page_admins_page ON company_page_admins(page_id);
CREATE INDEX IF NOT EXISTS idx_posts_page_id ON posts(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_page_id ON jobs(page_id) WHERE page_id IS NOT NULL;

-- 8. Trigger to auto-update follower_count
CREATE OR REPLACE FUNCTION update_page_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_pages SET follower_count = follower_count + 1 WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_pages SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.page_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_page_follower_count ON company_page_followers;
CREATE TRIGGER trg_page_follower_count
AFTER INSERT OR DELETE ON company_page_followers
FOR EACH ROW EXECUTE FUNCTION update_page_follower_count();

-- 9. Trigger to auto-insert owner as super_admin
CREATE OR REPLACE FUNCTION auto_add_page_owner_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_page_admins (page_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'super_admin')
  ON CONFLICT (page_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_page_admin ON company_pages;
CREATE TRIGGER trg_auto_page_admin
AFTER INSERT ON company_pages
FOR EACH ROW EXECUTE FUNCTION auto_add_page_owner_as_admin();

-- 10. RLS Policies
ALTER TABLE company_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_page_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_page_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_page_members ENABLE ROW LEVEL SECURITY;

-- Company pages
DROP POLICY IF EXISTS "Anyone can view company pages" ON company_pages;
DROP POLICY IF EXISTS "Owner can create pages" ON company_pages;
DROP POLICY IF EXISTS "Owner can update pages" ON company_pages;
DROP POLICY IF EXISTS "Owner can delete pages" ON company_pages;

CREATE POLICY "Anyone can view company pages" ON company_pages FOR SELECT USING (true);
CREATE POLICY "Owner can create pages" ON company_pages FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update pages" ON company_pages FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner can delete pages" ON company_pages FOR DELETE USING (auth.uid() = owner_id);

-- Admins
DROP POLICY IF EXISTS "Anyone can view page admins" ON company_page_admins;
DROP POLICY IF EXISTS "Owner can manage admins" ON company_page_admins;
DROP POLICY IF EXISTS "Owner can remove admins" ON company_page_admins;

CREATE POLICY "Anyone can view page admins" ON company_page_admins FOR SELECT USING (true);
CREATE POLICY "Owner can manage admins" ON company_page_admins FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM company_pages WHERE id = page_id AND owner_id = auth.uid())
);
CREATE POLICY "Owner can remove admins" ON company_page_admins FOR DELETE USING (
  EXISTS (SELECT 1 FROM company_pages WHERE id = page_id AND owner_id = auth.uid())
);

-- Followers
DROP POLICY IF EXISTS "Anyone can view followers" ON company_page_followers;
DROP POLICY IF EXISTS "Users can follow" ON company_page_followers;
DROP POLICY IF EXISTS "Users can unfollow" ON company_page_followers;

CREATE POLICY "Anyone can view followers" ON company_page_followers FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON company_page_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow" ON company_page_followers FOR DELETE USING (auth.uid() = user_id);

-- Members
DROP POLICY IF EXISTS "Anyone can view members" ON company_page_members;
DROP POLICY IF EXISTS "Admins can add members" ON company_page_members;
DROP POLICY IF EXISTS "Admins can remove members" ON company_page_members;

CREATE POLICY "Anyone can view members" ON company_page_members FOR SELECT USING (true);
CREATE POLICY "Admins can add members" ON company_page_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = company_page_members.page_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can remove members" ON company_page_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM company_page_admins WHERE page_id = company_page_members.page_id AND user_id = auth.uid())
);

-- 11. Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'company_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_pages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'company_page_followers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_page_followers;
  END IF;
END $$;
