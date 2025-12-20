-- 1. Create project_space_messages table (distinct from project_messages)
CREATE TABLE IF NOT EXISTS public.project_space_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_space_id UUID REFERENCES public.project_spaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Migrate data from old project_messages to new project_space_messages
-- Assumption: project_messages.project_id was actually pointing to a project_space.id
-- If project_messages.project_id pointed to projects.id, we need to join project_spaces to get the space ID.

-- Approach A: If project_messages.project_id -> project_spaces.id (the ambiguity case)
INSERT INTO public.project_space_messages (id, project_space_id, user_id, content, created_at)
SELECT pm.id, pm.project_id, pm.user_id, pm.content, pm.created_at
FROM public.project_messages pm
JOIN public.project_spaces ps ON ps.id = pm.project_id;

-- Approach B: If project_messages.project_id -> projects.id (unlikely given previous errors, but possible)
-- (We skip this for now safely because the constraints prevented mixed usage)

-- 3. Enable RLS
ALTER TABLE public.project_space_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for project_space_messages
CREATE POLICY "space_members_view_messages"
ON public.project_space_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = project_space_messages.project_space_id
        AND user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.project_spaces ps
        JOIN public.projects p ON p.id = ps.project_id
        WHERE ps.id = project_space_messages.project_space_id
        AND p.creator_id = auth.uid()
    )
);

CREATE POLICY "space_members_send_messages"
ON public.project_space_messages FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND (
        EXISTS (
            SELECT 1 FROM public.project_space_members
            WHERE project_space_id = project_space_messages.project_space_id
            AND user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.project_spaces ps
            JOIN public.projects p ON p.id = ps.project_id
            WHERE ps.id = project_space_messages.project_space_id
            AND p.creator_id = auth.uid()
        )
    )
);

-- 5. Force schema reload
NOTIFY pgrst, 'reload config';
