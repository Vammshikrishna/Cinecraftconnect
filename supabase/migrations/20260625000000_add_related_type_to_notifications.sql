-- Add missing columns back to notifications table
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "related_type" text;
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'low';
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "is_actionable" boolean DEFAULT false;
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
