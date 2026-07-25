-- ─── PITCH LEGAL UPGRADE MIGRATION ──────────────────────────────────────────
-- Adds SWA/WGA guild registration, NDA e-signature fields to pitch_submissions
-- Adds nda_viewer_signatures table for call creator NDA acknowledgement

-- 1. New columns on pitch_submissions
ALTER TABLE pitch_submissions
  ADD COLUMN IF NOT EXISTS guild_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS nda_signature             TEXT,
  ADD COLUMN IF NOT EXISTS nda_signed_at             TIMESTAMPTZ;

-- 2. Table to track when a call creator signs an NDA to unlock a pitch
CREATE TABLE IF NOT EXISTS nda_viewer_signatures (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_submission_id  UUID        NOT NULL REFERENCES pitch_submissions(id) ON DELETE CASCADE,
  signed_by            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signature            TEXT        NOT NULL,
  signed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pitch_submission_id, signed_by)
);

-- 3. RLS policies for nda_viewer_signatures
ALTER TABLE nda_viewer_signatures ENABLE ROW LEVEL SECURITY;

-- Call creators can insert their own signature
CREATE POLICY "Call creators can sign NDAs"
  ON nda_viewer_signatures
  FOR INSERT
  WITH CHECK (signed_by = auth.uid());

-- Users can read their own signatures
CREATE POLICY "Users can read their own NDA signatures"
  ON nda_viewer_signatures
  FOR SELECT
  USING (signed_by = auth.uid());

-- Writers can see who has signed an NDA on their submissions
CREATE POLICY "Writers can see NDA signatures on their submissions"
  ON nda_viewer_signatures
  FOR SELECT
  USING (
    pitch_submission_id IN (
      SELECT id FROM pitch_submissions WHERE submitter_id = auth.uid()
    )
  );
