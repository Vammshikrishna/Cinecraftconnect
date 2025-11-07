-- Add length constraints to posts table
-- ALTER TABLE public.posts 
-- ADD CONSTRAINT content_length_check 
-- CHECK (length(content) <= 5000);

-- Add length constraints to discussion_rooms table
-- ALTER TABLE public.discussion_rooms
-- ADD CONSTRAINT title_length_check
-- CHECK (length(title) <= 200);

-- ALTER TABLE public.discussion_rooms
-- ADD CONSTRAINT description_length_check
-- CHECK (length(description) <= 2000);

-- Add constraint for tags array length and individual tag length
-- ALTER TABLE public.posts
-- ADD CONSTRAINT tags_array_length_check
-- CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 10);

-- ALTER TABLE public.discussion_rooms
-- ADD CONSTRAINT room_tags_array_length_check
-- CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 10);