-- ============================================================
-- 25_platform_policy_governance.sql
-- CineCraft Connect — Global Policy & Announcement Engine
-- ============================================================

-- 1. Platform Policies Table
CREATE TABLE IF NOT EXISTS public.platform_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'terms', 'privacy', 'announcement', 'emergency'
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 2. Insert Default Policies
INSERT INTO public.platform_policies (type, title, content)
VALUES 
  ('announcement', 'Welcome to CineCraft Connect', 'The platform is now in public beta. Enjoy the creator network!'),
  ('terms', 'Terms of Service v1.0', 'Standard platform usage terms apply...'),
  ('privacy', 'Privacy Policy v1.0', 'We value your privacy and security...')
ON CONFLICT DO NOTHING;

-- 3. Enable Realtime for Policies
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_policies;

-- 4. RLS for Policies
ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all" ON public.platform_policies FOR SELECT USING (true);
CREATE POLICY "Enable write for super_admin" ON public.platform_policies 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
