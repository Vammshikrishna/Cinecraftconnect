-- Create film reviews table
CREATE TABLE IF NOT EXISTS public.film_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    review_text TEXT NOT NULL,
    is_spoiler BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tmdb_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_film_reviews_tmdb_id ON public.film_reviews(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_film_reviews_user_id ON public.film_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_film_reviews_created_at ON public.film_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE public.film_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.film_reviews;
DROP POLICY IF EXISTS "Users can create their own reviews" ON public.film_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.film_reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.film_reviews;

-- RLS Policies
CREATE POLICY "Anyone can view reviews"
    ON public.film_reviews
    FOR SELECT
    USING (true);

CREATE POLICY "Users can create their own reviews"
    ON public.film_reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
    ON public.film_reviews
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
    ON public.film_reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create helpful marks table
CREATE TABLE IF NOT EXISTS public.review_helpful_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.film_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(review_id, user_id)
);

-- Enable RLS for helpful marks
ALTER TABLE public.review_helpful_marks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view helpful marks" ON public.review_helpful_marks;
DROP POLICY IF EXISTS "Users can mark reviews as helpful" ON public.review_helpful_marks;
DROP POLICY IF EXISTS "Users can remove their helpful marks" ON public.review_helpful_marks;

CREATE POLICY "Anyone can view helpful marks"
    ON public.review_helpful_marks
    FOR SELECT
    USING (true);

CREATE POLICY "Users can mark reviews as helpful"
    ON public.review_helpful_marks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their helpful marks"
    ON public.review_helpful_marks
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_helpful_count_trigger ON public.review_helpful_marks;

-- Trigger for helpful count
CREATE TRIGGER update_helpful_count_trigger
AFTER INSERT OR DELETE ON public.review_helpful_marks
FOR EACH ROW
EXECUTE FUNCTION update_review_helpful_count();
