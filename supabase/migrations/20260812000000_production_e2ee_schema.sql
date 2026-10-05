-- Migration: Production-Grade E2EE Device Registry & Protocol Schemas
-- Date: 2026-08-12

-- 1. Create user_devices Table
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_public_key TEXT NOT NULL,
    signing_public_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_devices
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Policies for user_devices
CREATE POLICY "Users can read all active public device keys"
ON public.user_devices FOR SELECT
USING (true);

CREATE POLICY "Users can insert/update their own devices"
ON public.user_devices FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Add E2EE Protocol columns to message tables
ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS protocol_version INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS sender_device_id TEXT,
ADD COLUMN IF NOT EXISTS epoch INTEGER DEFAULT 0;

ALTER TABLE public.project_space_messages
ADD COLUMN IF NOT EXISTS protocol_version INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS sender_device_id TEXT,
ADD COLUMN IF NOT EXISTS epoch INTEGER DEFAULT 1;

ALTER TABLE public.room_messages
ADD COLUMN IF NOT EXISTS protocol_version INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS sender_device_id TEXT,
ADD COLUMN IF NOT EXISTS epoch INTEGER DEFAULT 1;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_messages_protocol ON public.direct_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_space_messages_epoch ON public.project_space_messages(project_space_id, epoch);
CREATE INDEX IF NOT EXISTS idx_room_messages_epoch ON public.room_messages(room_id, epoch);
