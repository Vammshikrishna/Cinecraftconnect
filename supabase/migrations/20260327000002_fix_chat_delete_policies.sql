-- Allow authenticated users to delete messages in their respective chat contexts
-- This enables the "Clear Chat History" features previously added to the UI

-- 1. Project Space Messages
DROP POLICY IF EXISTS "Member Clear Project Space Messages" ON public.project_space_messages;
CREATE POLICY "Member Clear Project Space Messages" ON public.project_space_messages 
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- 2. Project Messages (main project chat if used)
DROP POLICY IF EXISTS "Member Clear Project Messages" ON public.project_messages;
CREATE POLICY "Member Clear Project Messages" ON public.project_messages 
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- 3. Direct Messages
-- Users can delete messages they are involved in
DROP POLICY IF EXISTS "Users Clear Own Direct Messages" ON public.direct_messages;
CREATE POLICY "Users Clear Own Direct Messages" ON public.direct_messages 
FOR DELETE USING (
    (select auth.role()) = 'authenticated' AND 
    ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id)
);

-- 4. General Messages (Ensure DELETE is fully covered if it wasn't by 'ALL')
DROP POLICY IF EXISTS "Users Clear Own General Messages" ON public.messages;
CREATE POLICY "Users Clear Own General Messages" ON public.messages 
FOR DELETE USING ((select auth.role()) = 'authenticated');
