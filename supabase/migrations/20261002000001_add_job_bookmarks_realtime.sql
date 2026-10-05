-- Enable REPLICA IDENTITY FULL for job_bookmarks and saved_pitch_calls so Realtime DELETE events include full row data
ALTER TABLE ONLY "public"."job_bookmarks" REPLICA IDENTITY FULL;
ALTER TABLE ONLY "public"."saved_pitch_calls" REPLICA IDENTITY FULL;

-- Enable Realtime for job_bookmarks, saved_pitch_calls, and jobs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'job_bookmarks'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE job_bookmarks;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'saved_pitch_calls'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE saved_pitch_calls;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    END IF;
  END IF;
END $$;
