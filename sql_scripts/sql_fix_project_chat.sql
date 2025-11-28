-- Run this SQL in your Supabase Dashboard SQL Editor to fix the Project Chat errors

-- Create project_messages table if it doesn't exist
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

-- RLS Policies
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
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

DROP POLICY IF EXISTS "Project members can send messages" ON public.project_messages;
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

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.project_messages;
CREATE POLICY "Users can delete their own messages"
ON public.project_messages FOR DELETE
USING (user_id = auth.uid());

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_project_messages_updated_at ON public.project_messages;
CREATE TRIGGER update_project_messages_updated_at
BEFORE UPDATE ON public.project_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Setup Storage for Project Files
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Project members can view project files" ON storage.objects;
CREATE POLICY "Project members can view project files" ON storage.objects FOR SELECT USING (
    bucket_id = 'project-files' AND (
        EXISTS (
            SELECT 1 FROM public.project_space_members 
            WHERE project_space_id::text = split_part(name, '/', 1) AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Project members can upload project files" ON storage.objects;
CREATE POLICY "Project members can upload project files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'project-files' AND (
        EXISTS (
            SELECT 1 FROM public.project_space_members 
            WHERE project_space_id::text = split_part(name, '/', 1) AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.project_spaces 
            WHERE id::text = split_part(name, '/', 1) AND creator_id = auth.uid()
        )
    )
);
