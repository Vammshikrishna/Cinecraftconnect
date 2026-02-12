-- Fix foreign key relationships for film reviews and helpful marks to allow joining with profiles
ALTER TABLE public.film_reviews 
  DROP CONSTRAINT IF EXISTS film_reviews_user_id_fkey,
  ADD CONSTRAINT film_reviews_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

ALTER TABLE public.review_helpful_marks 
  DROP CONSTRAINT IF EXISTS review_helpful_marks_user_id_fkey,
  ADD CONSTRAINT review_helpful_marks_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;
