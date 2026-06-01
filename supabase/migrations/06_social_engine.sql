-- social_engine.sql

CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    media_urls text[], -- Support multiple media
    media_type text,
    tags text[],
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    has_ai_generated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.post_likes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Triggers for counts
CREATE OR REPLACE FUNCTION public.update_post_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_change AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.update_post_stats();
CREATE TRIGGER on_comment_change AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_post_stats();

-- Post Bookmarks table
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, post_id)
);

-- User Film Ratings table
CREATE TABLE IF NOT EXISTS public.user_film_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tmdb_id integer,
    rating numeric NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, tmdb_id)
);

-- Film Reviews table
CREATE TABLE IF NOT EXISTS public.film_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tmdb_id integer,
    review_text text NOT NULL,
    is_spoiler boolean DEFAULT false,
    helpful_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, tmdb_id)
);

-- Helpful Marks table
CREATE TABLE IF NOT EXISTS public.review_helpful_marks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES public.film_reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(review_id, user_id)
);

-- Function and trigger to update helpful count
CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count - 1
        WHERE id = OLD.review_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_helpful_count_trigger ON public.review_helpful_marks;
CREATE TRIGGER update_helpful_count_trigger
AFTER INSERT OR DELETE ON public.review_helpful_marks
FOR EACH ROW
EXECUTE FUNCTION public.update_review_helpful_count();

-- Trigger for user_film_ratings updated_at
DROP TRIGGER IF EXISTS update_user_film_ratings_updated_at ON public.user_film_ratings;
CREATE TRIGGER update_user_film_ratings_updated_at
    BEFORE UPDATE ON public.user_film_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_film_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.film_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_marks ENABLE ROW LEVEL SECURITY;

-- Policies for posts, likes, comments
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Anyone can view likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can view comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can manage own likes" ON public.post_likes FOR ALL USING (auth.uid() = user_id);

-- Policies for post_bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON public.post_bookmarks FOR ALL USING (auth.uid() = user_id);

-- Policies for user_film_ratings
CREATE POLICY "Anyone can view film ratings" ON public.user_film_ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create ratings" ON public.user_film_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ratings" ON public.user_film_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ratings" ON public.user_film_ratings FOR DELETE USING (auth.uid() = user_id);

-- Policies for film_reviews
CREATE POLICY "Anyone can view reviews" ON public.film_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create their own reviews" ON public.film_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.film_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON public.film_reviews FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public can view reviews" ON public.film_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own reviews" ON public.film_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.film_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.film_reviews FOR DELETE USING (auth.uid() = user_id);

-- Policies for review_helpful_marks
CREATE POLICY "Anyone can view helpful marks" ON public.review_helpful_marks FOR SELECT USING (true);
CREATE POLICY "Users can mark reviews as helpful" ON public.review_helpful_marks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their helpful marks" ON public.review_helpful_marks FOR DELETE USING (auth.uid() = user_id);
