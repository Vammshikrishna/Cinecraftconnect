ALTER TABLE announcements
ADD CONSTRAINT announcements_author_id_fkey
FOREIGN KEY (author_id)
REFERENCES profiles(id)
ON DELETE CASCADE;
