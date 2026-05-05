-- 38_internal_governance_expansion.sql
-- Expand internal tools: Verification, Broadcasts, VIP Invites, Shadowbans

-- 1. Add shadowban flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_shadowbanned boolean DEFAULT false;

-- 2. Verification Requests Table
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    portfolio_links text[] NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own requests" ON public.verification_requests FOR SELECT USING (user_id = auth.uid() OR public.is_current_user_internal());
CREATE POLICY "Users can insert their own requests" ON public.verification_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Internals can update requests" ON public.verification_requests FOR UPDATE USING (public.is_current_user_internal());

-- 3. Platform Announcements (Global Broadcasts)
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance', 'update')),
    target_audience text DEFAULT 'all' CHECK (target_audience IN ('all', 'creators', 'fans', 'studios')),
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_announcement_dismissals (
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    announcement_id uuid REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
    dismissed_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, announcement_id)
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active announcements" ON public.platform_announcements FOR SELECT USING (is_active = true OR public.is_current_user_internal());
CREATE POLICY "Internals can manage announcements" ON public.platform_announcements FOR ALL USING (public.is_current_user_internal());

ALTER TABLE public.user_announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their dismissals" ON public.user_announcement_dismissals FOR ALL USING (user_id = auth.uid());

-- 4. VIP Invite Codes
CREATE TABLE IF NOT EXISTS public.vip_invites (
    code text PRIMARY KEY,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_used boolean DEFAULT false,
    used_by_id uuid REFERENCES public.profiles(id),
    role_granted text DEFAULT 'creator_pro',
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.vip_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internals can manage invites" ON public.vip_invites FOR ALL USING (public.is_current_user_internal());
-- Everyone needs to be able to SELECT to validate a code, but only unused ones
CREATE POLICY "Public can view unused invites to validate" ON public.vip_invites FOR SELECT USING (is_used = false);
-- Public can UPDATE an invite to mark it as used during signup
CREATE POLICY "Public can use invite codes" ON public.vip_invites FOR UPDATE USING (is_used = false) WITH CHECK (is_used = true);
