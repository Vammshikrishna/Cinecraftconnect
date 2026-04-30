-- ============================================================
-- 19_support_and_transparency.sql
-- CineCraft Connect — Support System & Team Connectivity
-- ============================================================

-- ── 1. Support Tickets ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'report_abuse', 'feature_request')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Support Ticket Messages (The thread)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  is_internal boolean DEFAULT false, -- If true, only staff can see it
  created_at timestamp with time zone DEFAULT now()
);

-- ── 2. Staff Profiles & Metadata ─────────────────────────────

-- Add official team flag to profiles (can be derived from roles, but better to have a flag for flexibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_official_team boolean DEFAULT false;

-- Auto-update is_official_team based on user_roles
CREATE OR REPLACE FUNCTION public.sync_official_team_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.role IN ('moderator', 'admin', 'super_admin') THEN
    UPDATE public.profiles SET is_official_team = true WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_official_team = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_role_change_sync_official ON public.user_roles;
CREATE TRIGGER on_role_change_sync_official
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_official_team_status();

-- ── 3. RLS Policies ─────────────────────────────────────────

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: Users can see/create their own. Staff can see all.
CREATE POLICY "Users can manage own tickets" ON public.support_tickets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all tickets" ON public.support_tickets
  FOR ALL USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- Messages: Users can see non-internal messages in their tickets. Staff can see all.
CREATE POLICY "Users can see own ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    ) AND is_internal = false
  );

CREATE POLICY "Users can reply to own tickets" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all ticket messages" ON public.support_ticket_messages
  FOR ALL USING (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  );

-- ── 4. Realtime ─────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_incidents;
