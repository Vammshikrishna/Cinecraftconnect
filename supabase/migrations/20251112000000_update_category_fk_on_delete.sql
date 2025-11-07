
ALTER TABLE public.discussion_rooms
DROP CONSTRAINT IF EXISTS discussion_rooms_category_id_fkey;

ALTER TABLE public.discussion_rooms
ADD CONSTRAINT discussion_rooms_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES public.room_categories (id)
ON DELETE SET NULL;
