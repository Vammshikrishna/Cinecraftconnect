-- Update RLS policies for pitch_calls to allow anyone (including unauthenticated users) to select open pitch calls
DROP POLICY IF EXISTS "Anyone authenticated can view open pitch calls" ON "public"."pitch_calls";

CREATE POLICY "Anyone can view open pitch calls" ON "public"."pitch_calls"
  FOR SELECT TO public USING ((is_published = true));
