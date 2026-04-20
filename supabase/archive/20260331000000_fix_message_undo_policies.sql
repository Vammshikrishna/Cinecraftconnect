-- Correct RLS policies for message "Undo" (UPDATE) and "Delete" (DELETE) features
-- Standardized Version (using verified column names for each distinct table)

-- 1. Direct Messages (sender_id, receiver_id)
DROP POLICY IF EXISTS "Users Clear Own Direct Messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users Update Own Direct Messages" ON public.direct_messages;

CREATE POLICY "Users Clear Own Direct Messages" ON public.direct_messages 
FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users Update Own Direct Messages" ON public.direct_messages
FOR UPDATE USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);


-- 2. Room Messages (user_id)
DROP POLICY IF EXISTS "Users Clear Own Room Messages" ON public.room_messages;
DROP POLICY IF EXISTS "Users Update Own Room Messages" ON public.room_messages;

CREATE POLICY "Users Clear Own Room Messages" ON public.room_messages 
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users Update Own Room Messages" ON public.room_messages
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- 3. Project Space Messages (user_id)
DROP POLICY IF EXISTS "Member Clear Project Space Messages" ON public.project_space_messages;
DROP POLICY IF EXISTS "Users Update Own Project Space Messages" ON public.project_space_messages;

CREATE POLICY "Member Clear Project Space Messages" ON public.project_space_messages 
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users Update Own Project Space Messages" ON public.project_space_messages
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- 4. Project Messages (user_id)
DROP POLICY IF EXISTS "Member Clear Project Messages" ON public.project_messages;
DROP POLICY IF EXISTS "Users Update Own Project Messages" ON public.project_messages;

CREATE POLICY "Member Clear Project Messages" ON public.project_messages 
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users Update Own Project Messages" ON public.project_messages
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- 5. General Messages (sender_id)
DROP POLICY IF EXISTS "Users Clear Own General Messages" ON public.messages;
DROP POLICY IF EXISTS "Users Update Own General Messages" ON public.messages;

CREATE POLICY "Users Clear Own General Messages" ON public.messages 
FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "Users Update Own General Messages" ON public.messages 
FOR UPDATE USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);
