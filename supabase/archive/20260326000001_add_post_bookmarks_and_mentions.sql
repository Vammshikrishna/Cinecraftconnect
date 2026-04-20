-- Migration: 20260326000001_add_post_bookmarks_and_mentions.sql

-- 1. Create Post Bookmarks table
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- 2. Create Mentions tracking table
-- This can be used for both posts and chat messages
CREATE TABLE IF NOT EXISTS public.mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentioner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    mentioned_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    related_id UUID NOT NULL, -- The ID of the post or message
    related_type TEXT NOT NULL CHECK (related_type IN ('post', 'chat_message', 'announcement')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- Policies for post_bookmarks
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.post_bookmarks;
CREATE POLICY "Users can manage their own bookmarks" 
ON public.post_bookmarks FOR ALL 
USING (auth.uid() = user_id);

-- Policies for mentions
DROP POLICY IF EXISTS "Anyone can view mentions" ON public.mentions;
CREATE POLICY "Anyone can view mentions" 
ON public.mentions FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can create mentions" ON public.mentions;
CREATE POLICY "Users can create mentions" 
ON public.mentions FOR INSERT 
WITH CHECK (auth.uid() = mentioner_id);

DROP POLICY IF EXISTS "Users can delete their own mentions" ON public.mentions;
CREATE POLICY "Users can delete their own mentions" 
ON public.mentions FOR DELETE 
USING (auth.uid() = mentioner_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON public.post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post ON public.post_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned ON public.mentions(mentioned_id);
CREATE INDEX IF NOT EXISTS idx_mentions_related ON public.mentions(related_id, related_type);

-- Trigger to create notifications for mentions
CREATE OR REPLACE FUNCTION public.handle_new_mention_notification()
RETURNS TRIGGER AS $$
DECLARE
    _mentioner_name TEXT;
    _page_url TEXT;
BEGIN
    -- Get Mentioner Name
    SELECT full_name INTO _mentioner_name FROM public.profiles WHERE id = NEW.mentioner_id;
    
    -- Set page URL based on related_type
    IF NEW.related_type = 'post' THEN
        _page_url := '/feed';
    ELSIF NEW.related_type = 'chat_message' THEN
        _page_url := '/messages';
    ELSIF NEW.related_type = 'announcement' THEN
        _page_url := '/announcements';
    END IF;

    -- Insert into notifications
    INSERT INTO public.notifications (
        user_id, 
        actor_id, 
        type, 
        title, 
        message, 
        related_id, 
        related_type, 
        priority, 
        action_url
    )
    VALUES (
        NEW.mentioned_id, 
        NEW.mentioner_id, 
        'mention', 
        'New Mention', 
        COALESCE(_mentioner_name, 'Someone') || ' mentioned you in a ' || REPLACE(NEW.related_type, '_', ' ') || '.', 
        NEW.related_id, 
        NEW.related_type, 
        'high', 
        _page_url
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_mention_notification ON public.mentions;
CREATE TRIGGER trg_mention_notification
AFTER INSERT ON public.mentions
FOR EACH ROW EXECUTE FUNCTION public.handle_new_mention_notification();
