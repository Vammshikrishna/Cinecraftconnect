-- ─── STORY EXCHANGE & DIGITAL NDA MIGRATION ───────────────────────────────

-- 1. Create Story Listings table (Gap 1)
CREATE TABLE IF NOT EXISTS story_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    logline TEXT NOT NULL,
    synopsis_teaser TEXT NOT NULL,
    synopsis_full TEXT,
    genre TEXT,
    format TEXT,
    language TEXT,
    tone TEXT,
    stage TEXT DEFAULT 'concept',
    asking_deal TEXT DEFAULT 'negotiable',
    nda_required BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true
);

-- 2. Create Story Interests table for unlock handshake (Gap 1)
CREATE TABLE IF NOT EXISTS story_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story_listings(id) ON DELETE CASCADE NOT NULL,
    interested_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'declined'
    nda_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(story_id, interested_by)
);

-- 3. Create Pitch Call Views for analytics tracking (Gap 4)
CREATE TABLE IF NOT EXISTS pitch_call_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_call_id UUID REFERENCES pitch_calls(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    viewed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on new tables
ALTER TABLE story_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_call_views ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Story listings are visible to authenticated users"
    ON story_listings FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Writers can manage their own story listings"
    ON story_listings FOR ALL
    USING (creator_id = auth.uid());

CREATE POLICY "Story interests visible to parties involved"
    ON story_interests FOR SELECT
    USING (
        interested_by = auth.uid() 
        OR story_id IN (SELECT id FROM story_listings WHERE creator_id = auth.uid())
    );

CREATE POLICY "Interested users can create interest requests"
    ON story_interests FOR INSERT
    WITH CHECK (interested_by = auth.uid());

CREATE POLICY "Writers can update interest status"
    ON story_interests FOR UPDATE
    USING (story_id IN (SELECT id FROM story_listings WHERE creator_id = auth.uid()));

CREATE POLICY "Pitch call owners can read views"
    ON pitch_call_views FOR SELECT
    USING (
        pitch_call_id IN (SELECT id FROM pitch_calls WHERE creator_id = auth.uid())
    );

CREATE POLICY "Log new views"
    ON pitch_call_views FOR INSERT
    WITH CHECK (true);

-- Allow target producers to view direct pitches sent to them
CREATE POLICY "Producers can view direct pitches targeted to them"
    ON pitch_calls FOR SELECT
    USING ((attachments->>'target_producer_id') = auth.uid()::text);

-- Allow authenticated users to insert direct pitch calls for producers
CREATE POLICY "Allow authenticated users to insert catcher briefs"
    ON pitch_calls FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Enable Realtime for key tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'pitch_calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pitch_calls;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'pitch_submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pitch_submissions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'story_listings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE story_listings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'story_interests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE story_interests;
    END IF;
END;
$$;
