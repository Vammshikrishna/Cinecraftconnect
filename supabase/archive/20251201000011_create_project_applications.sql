-- Create project_applications table
CREATE TABLE IF NOT EXISTS public.project_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    cover_letter text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view applications to their projects"
ON public.project_applications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_applications.project_id
        AND creator_id = auth.uid()
    ) OR user_id = auth.uid()
);

CREATE POLICY "Users can create applications"
ON public.project_applications FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    NOT EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = project_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Project creators can update applications"
ON public.project_applications FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_applications.project_id
        AND creator_id = auth.uid()
    )
);

CREATE POLICY "Applicants can delete their own applications"
ON public.project_applications FOR DELETE
USING (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_project_applications_updated_at
BEFORE UPDATE ON public.project_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
