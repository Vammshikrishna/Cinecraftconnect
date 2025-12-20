-- 1. Drop ALL potentially conflicting policies on project_messages
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
DROP POLICY IF EXISTS "Project members can send messages" ON public.project_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.project_messages;
-- Drop potentially old/renamed policies just in case
DROP POLICY IF EXISTS "Enable read access for project members" ON public.project_messages;
DROP POLICY IF EXISTS "Enable insert for project members" ON public.project_messages;

-- 2. Create SIMPLIFIED, unambiguous policies
-- We use a completely different approach to avoid ambiguity:
-- We select from the relationships WITHOUT referencing project_messages.project_id in the subquery's WHERE clause if possible,
-- OR we force the table reference to be explicit.

-- View Policy
CREATE POLICY "project_messages_select_policy"
ON public.project_messages FOR SELECT
USING (
    -- Direct member check
    EXISTS (
        SELECT 1 
        FROM public.project_space_members 
        WHERE project_space_members.project_space_id = project_messages.project_id 
        AND project_space_members.user_id = auth.uid()
    )
    OR
    -- Creator check (via explicit join)
    EXISTS (
        SELECT 1 
        FROM public.project_spaces
        JOIN public.projects ON projects.id = project_spaces.project_id
        WHERE project_spaces.id = project_messages.project_id
        AND projects.creator_id = auth.uid()
    )
);

-- Insert Policy
CREATE POLICY "project_messages_insert_policy"
ON public.project_messages FOR INSERT
WITH CHECK (
    -- User can only post as themselves
    auth.uid() = user_id 
    AND (
        -- Member check
        EXISTS (
            SELECT 1 
            FROM public.project_space_members 
            WHERE project_space_members.project_space_id = project_messages.project_id 
            AND project_space_members.user_id = auth.uid()
        )
        OR
        -- Creator check
        EXISTS (
            SELECT 1 
            FROM public.project_spaces
            JOIN public.projects ON projects.id = project_spaces.project_id
            WHERE project_spaces.id = project_messages.project_id
            AND projects.creator_id = auth.uid()
        )
    )
);

-- Update/Delete Policy (Own messages only)
CREATE POLICY "project_messages_modify_policy"
ON public.project_messages FOR DELETE
USING (auth.uid() = user_id);

-- 3. Verify Trigger Function Functionality (Fix for potential ambiguity in trigger)
CREATE OR REPLACE FUNCTION public.notify_new_project_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  project_name_rel TEXT; -- Renamed variable
  member_record RECORD;
BEGIN
  -- safe check
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  SELECT name INTO project_name_rel
  FROM public.project_spaces
  WHERE id = NEW.project_id;

  -- Create notifications
  FOR member_record IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      action_url,
      related_id,
      related_type,
      priority,
      is_read
    ) VALUES (
      member_record.user_id,
      NEW.user_id,
      'new_message',
      'New Project Message',
      sender_name || ' sent a message in ' || COALESCE(project_name_rel, 'a project'),
      '/projects/' || NEW.project_id || '/space',
      NEW.id,
      'project_message',
      'medium',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload
NOTIFY pgrst, 'reload config';
