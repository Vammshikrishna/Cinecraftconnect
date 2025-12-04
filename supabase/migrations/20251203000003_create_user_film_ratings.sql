-- Create user_film_ratings table
CREATE TABLE IF NOT EXISTS public.user_film_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tmdb_id integer NOT NULL,
    rating numeric NOT NULL CHECK (rating >= 0 AND rating <= 5),
    review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, tmdb_id)
);

-- Enable RLS
ALTER TABLE public.user_film_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view film ratings" ON public.user_film_ratings
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings" ON public.user_film_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.user_film_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.user_film_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_film_ratings_updated_at
    BEFORE UPDATE ON public.user_film_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
