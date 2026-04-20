ALTER TABLE discussion_rooms ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
