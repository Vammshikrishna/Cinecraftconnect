ALTER TABLE public.room_join_requests
ADD CONSTRAINT room_join_requests_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
