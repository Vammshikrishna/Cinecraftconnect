-- Phase 1: Security Hardening & Phase 5: Database Optimization (Fixed)

-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Remove role column from profiles (security issue)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON public.post_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_users ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON public.room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_connections_follower ON public.user_connections(follower_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_following ON public.user_connections(following_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON public.profiles USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON public.audit_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON public.background_jobs(job_type, status, created_at DESC);

-- Rate limiting (leaky bucket implementation)
-- CREATE TABLE IF NOT EXISTS public.rate_limits (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
--   key TEXT NOT NULL UNIQUE,
--   tokens SMALLINT NOT NULL DEFAULT 5,
--   last_refill TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- RLS policies for rate_limits
-- CREATE POLICY "Users can manage their own rate limits"
-- ON public.rate_limits FOR ALL
-- USING (auth.uid() = user_id);

-- Background jobs table
-- CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- CREATE TABLE public.background_jobs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   job_type TEXT NOT NULL,
--   payload JSONB,
--   status job_status NOT NULL DEFAULT 'pending',
--   last_error TEXT,
--   run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
-- RLS for background jobs
-- CREATE POLICY "Admins can manage all jobs"
-- ON public.background_jobs FOR ALL
-- USING (public.has_role(auth.uid(), 'admin'));

-- CREATE POLICY "System can execute jobs"
-- ON public.background_jobs FOR ALL
-- USING (current_user = 'postgres'); -- Assuming jobs are run by postgres role

-- Audit logging
-- CREATE TABLE public.audit_logs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
--   action TEXT NOT NULL,
--   details JSONB,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- RLS for audit logs
-- CREATE POLICY "Admins can view all logs"
-- ON public.audit_logs FOR SELECT
-- USING (public.has_role(auth.uid(), 'admin'));

-- CREATE POLICY "System can insert audit logs"
-- ON public.audit_logs FOR INSERT
-- WITH CHECK (current_user = 'postgres');
