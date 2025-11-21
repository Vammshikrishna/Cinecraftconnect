-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    media_url text,
    media_type text,
    tags text[],
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    has_ai_generated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING GIN(tags);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view all posts (public feed)
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts" 
    ON public.posts 
    FOR SELECT 
    USING (true);

-- Authenticated users can create posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" 
    ON public.posts 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

-- Authors can update their own posts
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
CREATE POLICY "Authors can update their own posts" 
    ON public.posts 
    FOR UPDATE 
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own posts
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.posts;
CREATE POLICY "Authors can delete their own posts" 
    ON public.posts 
    FOR DELETE 
    USING (auth.uid() = author_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_posts_updated_at_trigger ON public.posts;
CREATE TRIGGER update_posts_updated_at_trigger
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_posts_updated_at();

-- Add comment to table
COMMENT ON TABLE public.posts IS 'User posts for the feed';
