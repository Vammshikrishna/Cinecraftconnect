ALTER TABLE "public"."call_participants" 
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'joined',
ADD COLUMN IF NOT EXISTS "is_audio_enabled" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "is_video_enabled" boolean DEFAULT true;

-- Ensure there is a unique constraint for the upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'call_participants_call_id_user_id_key'
    ) THEN
        ALTER TABLE "public"."call_participants" 
        ADD CONSTRAINT "call_participants_call_id_user_id_key" UNIQUE ("call_id", "user_id");
    END IF;
END $$;
