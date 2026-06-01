-- Migration: 47_advanced_session_security.sql
-- Purpose: Trusted Device & Advanced Session Security Tables

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_name TEXT,
    platform TEXT,
    app_version TEXT,
    ip_address TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT false,
    trusted BOOLEAN DEFAULT false,
    suspicious BOOLEAN DEFAULT false
);
-- Performance indexes for quick lookups during token refresh
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON public.user_sessions(refresh_token_hash);
-- Security Events Table for logging
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'login_success', 'login_failure', 'suspicious_activity', 'session_revoked'
    device_id TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Performance indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);
-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- Policies for user_sessions
CREATE POLICY "Users can view their own sessions"
    ON public.user_sessions FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions"
    ON public.user_sessions FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions"
    ON public.user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
-- Policies for security_events
CREATE POLICY "Users can view their own security events"
    ON public.security_events FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own security events"
    ON public.security_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
-- Enable Realtime for user_sessions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'user_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
    END IF;
END $$;
