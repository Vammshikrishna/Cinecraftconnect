-- Enable Realtime for saved_pitch_calls
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'saved_pitch_calls'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE saved_pitch_calls;
    END IF;
  END IF;
END $$;
