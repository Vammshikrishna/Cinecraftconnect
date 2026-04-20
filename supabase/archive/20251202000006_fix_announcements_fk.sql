-- Fix announcements foreign key to reference profiles instead of auth.users
ALTER TABLE public.announcements
DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;

ALTER TABLE public.announcements
ADD CONSTRAINT announcements_author_id_fkey
FOREIGN KEY (author_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;
