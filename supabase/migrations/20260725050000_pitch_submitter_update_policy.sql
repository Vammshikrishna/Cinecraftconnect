-- Allow writers (submitters) to update their own pitch submissions
-- Specifically needed so they can append the full_deck_url to their submission after it's created.
CREATE POLICY "Submitters can update their own submissions" ON "public"."pitch_submissions" 
FOR UPDATE USING (auth.uid() = submitter_id);
