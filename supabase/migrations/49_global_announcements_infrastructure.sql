-- 49_global_announcements_infrastructure.sql
-- CineCraft Connect — Infrastructure for system-wide announcements and admin broadcasting

-- 1. Create the system announcements table
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    image_url TEXT,
    send_push BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Anyone logged in can read system announcements
DROP POLICY IF EXISTS "Anyone can read system announcements" ON public.system_announcements;
CREATE POLICY "Anyone can read system announcements"
  ON public.system_announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform administrators and super admins can manage announcements
DROP POLICY IF EXISTS "Admins can manage all announcements" ON public.system_announcements;
CREATE POLICY "Admins can manage all announcements"
  ON public.system_announcements
  FOR ALL
  USING (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- 4. Enable Supabase Realtime for system_announcements
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;
  EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table system_announcements already in publication';
  END;
END $$;

-- Set replica identity to FULL to ensure full payloads are delivered in realtime
ALTER TABLE public.system_announcements REPLICA IDENTITY FULL;
