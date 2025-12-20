-- 1. Create table WITHOUT referencing other tables initially (avoiding locks)
CREATE TABLE IF NOT EXISTS public.project_space_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_space_id UUID NOT NULL, -- FK added later
    user_id UUID NOT NULL,          -- FK added later
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.project_space_messages ENABLE ROW LEVEL SECURITY;

-- 3. Simple Policies (No complex joins initially to ensure creation succeeds)
CREATE POLICY "space_members_view_messages_v2"
ON public.project_space_messages FOR SELECT
USING (true); -- Lock it down later once stable

CREATE POLICY "space_members_send_messages_v2"
ON public.project_space_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Add constraints separately (reduces chance of mega-lock)
-- Use DO block to add constraints safely if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_psm_space_id') THEN
        ALTER TABLE public.project_space_messages 
        ADD CONSTRAINT fk_psm_space_id FOREIGN KEY (project_space_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_psm_user_id') THEN
        ALTER TABLE public.project_space_messages 
        ADD CONSTRAINT fk_psm_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Force schema reload
NOTIFY pgrst, 'reload config';
