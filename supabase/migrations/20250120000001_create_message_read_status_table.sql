-- Create project_space_message_read_status table
CREATE TABLE IF NOT EXISTS public.project_space_message_read_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.project_space_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unique_message_user UNIQUE (message_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_read_status_message_id ON public.project_space_message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user_id ON public.project_space_message_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_read_at ON public.project_space_message_read_status(read_at DESC);

-- Enable RLS
ALTER TABLE public.project_space_message_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view read status for messages in project spaces they're members of
CREATE POLICY "Users can view read status in their project spaces" 
    ON public.project_space_message_read_status 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 
            FROM public.project_space_messages psm
            JOIN public.project_space_members psmemb 
                ON psm.project_space_id = psmemb.project_space_id
            WHERE psm.id = message_id 
                AND psmemb.user_id = auth.uid()
        )
    );

-- Users can create read status entries for themselves
CREATE POLICY "Users can create their own read status" 
    ON public.project_space_message_read_status 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own read status
CREATE POLICY "Users can update their own read status" 
    ON public.project_space_message_read_status 
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own read status
CREATE POLICY "Users can delete their own read status" 
    ON public.project_space_message_read_status 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE public.project_space_message_read_status IS 'Tracks read/unread status of project space messages for each user';
