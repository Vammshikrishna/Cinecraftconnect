-- Create project_messages table for project-specific chat
CREATE TABLE IF NOT EXISTS public.project_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON public.project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON public.project_messages(created_at);

-- Enable RLS
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only project members can access messages
CREATE POLICY "Project members can view messages"
ON public.project_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = project_messages.project_id
        AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_messages.project_id
        AND creator_id = auth.uid()
    )
);

CREATE POLICY "Project members can send messages"
ON public.project_messages FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    (
        EXISTS (
            SELECT 1 FROM public.project_space_members
            WHERE project_space_id = project_id
            AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces
            WHERE id = project_id
            AND creator_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can delete their own messages"
ON public.project_messages FOR DELETE
USING (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_project_messages_updated_at
BEFORE UPDATE ON public.project_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
