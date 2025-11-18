-- Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    due_date date,
    status text DEFAULT 'todo'::text NOT NULL,
    assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS Policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in project spaces they are part of" ON public.tasks FOR SELECT
    USING (is_project_space_member(project_space_id, auth.uid()));

CREATE POLICY "Users can create tasks in project spaces they are part of" ON public.tasks FOR INSERT
    WITH CHECK (is_project_space_member(project_space_id, auth.uid()));

CREATE POLICY "Users can update tasks in project spaces they are part of" ON public.tasks FOR UPDATE
    USING (is_project_space_member(project_space_id, auth.uid()));

CREATE POLICY "Users can delete tasks in project spaces they are part of" ON public.tasks FOR DELETE
    USING (is_project_space_member(project_space_id, auth.uid()));
