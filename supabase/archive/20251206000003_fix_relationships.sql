-- ============================================================================
-- FIX: RELATIONSHIPS & FOREIGN KEYS
-- ============================================================================
-- This script fixes the "400 Bad Request" errors when fetching data with joins.
-- PostgREST requires explicit Foreign Keys to the joined table (profiles).
-- We change references from auth.users to public.profiles to enable these joins.
-- ============================================================================

-- 1. PROJECT SPACE MEMBERS -> PROFILES
ALTER TABLE public.project_space_members 
DROP CONSTRAINT IF EXISTS project_space_members_user_id_fkey;

ALTER TABLE public.project_space_members 
ADD CONSTRAINT project_space_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. PROJECT APPLICATIONS -> PROFILES
ALTER TABLE public.project_applications 
DROP CONSTRAINT IF EXISTS project_applications_user_id_fkey;

ALTER TABLE public.project_applications 
ADD CONSTRAINT project_applications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. PROJECT MESSAGES -> PROFILES
-- Note: We already renamed sender_id to user_id in the previous step.
-- Now we ensure it references profiles for the UI to fetch names/avatars.
ALTER TABLE public.project_messages 
DROP CONSTRAINT IF EXISTS project_messages_user_id_fkey;

ALTER TABLE public.project_messages 
DROP CONSTRAINT IF EXISTS project_messages_sender_id_fkey; -- Cleanup old constraint if exists

ALTER TABLE public.project_messages 
ADD CONSTRAINT project_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. CALLS TABLE FIXES
-- Ensure columns exist (in case table existed but was malformed)
DO $$ 
BEGIN
    -- Check and add room_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'room_type') THEN
        ALTER TABLE public.calls ADD COLUMN room_type text CHECK (room_type IN ('project', 'discussion'));
    END IF;

    -- Check and add room_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'room_id') THEN
        ALTER TABLE public.calls ADD COLUMN room_id uuid;
    END IF;

    -- Check and add status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'status') THEN
        ALTER TABLE public.calls ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'ended'));
    END IF;
END $$;

-- Ensure RLS allows viewing calls
DROP POLICY IF EXISTS "Authenticated users can view calls" ON public.calls;
CREATE POLICY "Authenticated users can view calls" ON public.calls FOR SELECT USING (auth.role() = 'authenticated');

-- 5. FIX PROJECT MESSAGES RLS (403 Error)
-- Ensure members can view messages
DROP POLICY IF EXISTS "Member View Project Messages" ON public.project_messages;
CREATE POLICY "Member View Project Messages" ON public.project_messages 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = project_messages.project_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.project_spaces WHERE id = project_messages.project_id AND creator_id = auth.uid())
);

-- Ensure members can insert messages
DROP POLICY IF EXISTS "Member Send Project Messages" ON public.project_messages;
CREATE POLICY "Member Send Project Messages" ON public.project_messages 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = project_messages.project_id AND user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.project_spaces WHERE id = project_messages.project_id AND creator_id = auth.uid())
  )
);
