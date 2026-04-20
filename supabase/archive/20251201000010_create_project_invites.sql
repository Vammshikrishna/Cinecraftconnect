-- Create project_invites table for invite link management
CREATE TABLE IF NOT EXISTS public.project_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    invite_code text NOT NULL UNIQUE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at timestamp with time zone,
    max_uses integer DEFAULT NULL,
    used_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project members can view invites"
ON public.project_invites FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members
        WHERE project_space_id = project_invites.project_id
        AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_invites.project_id
        AND creator_id = auth.uid()
    )
);

CREATE POLICY "Project creators can create invites"
ON public.project_invites FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_id
        AND creator_id = auth.uid()
    )
);

CREATE POLICY "Project creators can delete invites"
ON public.project_invites FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.project_spaces
        WHERE id = project_invites.project_id
        AND creator_id = auth.uid()
    )
);

-- Create updated_at trigger
CREATE TRIGGER update_project_invites_updated_at
BEFORE UPDATE ON public.project_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
