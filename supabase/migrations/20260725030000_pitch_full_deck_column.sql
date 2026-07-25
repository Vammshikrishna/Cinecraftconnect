-- Add full_deck_url to pitch_submissions

ALTER TABLE pitch_submissions
  ADD COLUMN IF NOT EXISTS full_deck_url TEXT;
