-- Fix ambiguous column references and logic errors in project_messages RLS policies

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
DROP POLICY IF EXISTS "Project members can send messages" ON public.project_messages;

-- 2. "View" Policy - with fully qualified columns and correct creator check
CREATE POLICY "Project members can view messages"
ON public.project_messages FOR SELECT
USING (
    -- Access if user is a member of the space
    EXISTS (
        SELECT 1 FROM public.project_space_members psm
        WHERE psm.project_space_id = project_messages.project_id
        AND psm.user_id = auth.uid()
    ) 
    OR 
    -- Access if user is the creator of the PROJECT associated with this space
    EXISTS (
        SELECT 1 FROM public.project_spaces ps
        JOIN public.projects p ON p.id = ps.project_id
        WHERE ps.id = project_messages.project_id
        AND p.creator_id = auth.uid()
    )
);

-- 3. "Send" Policy - with fully qualified columns and correct creator check
CREATE POLICY "Project members can send messages"
ON public.project_messages FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    (
        -- Allow if user is a member of the space
        EXISTS (
            SELECT 1 FROM public.project_space_members psm
            WHERE psm.project_space_id = project_messages.project_id
            AND psm.user_id = auth.uid()
        ) 
        OR 
        -- Allow if user is the creator of the PROJECT associated with this space
        EXISTS (
            SELECT 1 FROM public.project_spaces ps
            JOIN public.projects p ON p.id = ps.project_id
            WHERE ps.id = project_messages.project_id
            AND p.creator_id = auth.uid()
        )
    )
);

-- Reload schema cache
NOTIFY pgrst, 'reload config';
