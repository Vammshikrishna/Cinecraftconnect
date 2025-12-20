-- ==========================================
-- 1. Film Reviews Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.film_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    tmdb_id INTEGER NOT NULL,
    review_text TEXT NOT NULL,
    is_spoiler BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, tmdb_id)
);

-- Add FK to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'film_reviews_user_id_fkey') THEN
        ALTER TABLE public.film_reviews
        ADD CONSTRAINT film_reviews_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id);
    END IF;
END $$;

-- Enable RLS for film_reviews
ALTER TABLE public.film_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for film_reviews
DROP POLICY IF EXISTS "Public can view reviews" ON public.film_reviews;
CREATE POLICY "Public can view reviews" ON public.film_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own reviews" ON public.film_reviews;
CREATE POLICY "Users can create own reviews" ON public.film_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.film_reviews;
CREATE POLICY "Users can update own reviews" ON public.film_reviews FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.film_reviews;
CREATE POLICY "Users can delete own reviews" ON public.film_reviews FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- 2. Review Helpful Marks Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.review_helpful_marks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(review_id, user_id)
);

-- Add FK to film_reviews
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'review_helpful_marks_review_id_fkey') THEN
        ALTER TABLE public.review_helpful_marks
        ADD CONSTRAINT review_helpful_marks_review_id_fkey
        FOREIGN KEY (review_id)
        REFERENCES public.film_reviews(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'review_helpful_marks_user_id_fkey') THEN
        ALTER TABLE public.review_helpful_marks
        ADD CONSTRAINT review_helpful_marks_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS for review_helpful_marks
ALTER TABLE public.review_helpful_marks ENABLE ROW LEVEL SECURITY;

-- Policies for review_helpful_marks
DROP POLICY IF EXISTS "Public can view helpful marks" ON public.review_helpful_marks;
CREATE POLICY "Public can view helpful marks" ON public.review_helpful_marks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can mark helpful" ON public.review_helpful_marks;
CREATE POLICY "Users can mark helpful" ON public.review_helpful_marks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove mark" ON public.review_helpful_marks;
CREATE POLICY "Users can remove mark" ON public.review_helpful_marks FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- 3. Trigger for Helpful Count
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count - 1
        WHERE id = OLD.review_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_helpful_count ON public.review_helpful_marks;
CREATE TRIGGER update_helpful_count
AFTER INSERT OR DELETE ON public.review_helpful_marks
FOR EACH ROW EXECUTE FUNCTION public.update_review_helpful_count();

-- Reload schema cache
NOTIFY pgrst, 'reload config';
