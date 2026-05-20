-- Migration: 52_add_announcement_rich_media.sql
-- Purpose: Add image attachment and push notification triggers to system broadcasts

ALTER TABLE public.system_announcements
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS send_push BOOLEAN DEFAULT false;
