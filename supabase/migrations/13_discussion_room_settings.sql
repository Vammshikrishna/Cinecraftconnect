-- Migration: Add JSONB settings column to discussion_rooms
-- Description: Adds a flexible settings column to store all advanced room configuration options.

ALTER TABLE discussion_rooms ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
