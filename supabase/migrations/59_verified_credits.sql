-- 59_verified_credits.sql
-- Enables Verified Production Credits: director tags crew on project wrap, locked to profile

-- Create project_credits table
CREATE TABLE IF NOT EXISTS public.project_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    project_title text NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL,
    verifier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_credits_uniq UNIQUE (project_id, user_id, role)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_credits_user ON public.project_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_project_credits_project ON public.project_credits(project_id);

-- Enable RLS
ALTER TABLE public.project_credits ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can view project credits" ON public.project_credits;
CREATE POLICY "Anyone can view project credits" ON public.project_credits
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Project creators can insert project credits" ON public.project_credits;
CREATE POLICY "Project creators can insert project credits" ON public.project_credits
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_credits.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project creators can delete project credits" ON public.project_credits;
CREATE POLICY "Project creators can delete project credits" ON public.project_credits
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = project_credits.project_id AND creator_id = auth.uid()
    ) OR user_id = auth.uid()
);

-- Disable updates: Credits are locked once wrapped
DROP POLICY IF EXISTS "No one can update project credits" ON public.project_credits;
CREATE POLICY "No one can update project credits" ON public.project_credits
FOR UPDATE USING (false);

-- Notification function & trigger on tagging crew
CREATE OR REPLACE FUNCTION public.notify_on_project_credit()
RETURNS TRIGGER AS $$
DECLARE
    v_project_title text;
    v_director_name text;
BEGIN
    -- Resolve project title
    SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;
    IF v_project_title IS NULL THEN
        v_project_title := NEW.project_title;
    END IF;

    -- Resolve director (verifier) name
    SELECT full_name INTO v_director_name FROM public.profiles WHERE id = NEW.verifier_id;
    IF v_director_name IS NULL THEN
        v_director_name := 'A director';
    END IF;

    -- Create notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        action_url,
        related_id,
        related_type,
        priority
    ) VALUES (
        NEW.user_id,
        'verified_credit',
        'New Verified Credit Tagged!',
        v_director_name || ' tagged you as ' || NEW.role || ' on "' || v_project_title || '".',
        '/profile?tab=credits',
        NEW.id,
        'project_credit',
        'high'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_project_credit_created ON public.project_credits;
CREATE TRIGGER tr_on_project_credit_created
AFTER INSERT ON public.project_credits
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_project_credit();
