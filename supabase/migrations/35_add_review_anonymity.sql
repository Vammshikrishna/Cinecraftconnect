-- Add is_anonymous column to film_reviews
ALTER TABLE public.film_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
