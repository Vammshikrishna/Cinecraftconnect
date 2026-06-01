-- Create schedule_item_assignees join table
CREATE TABLE public.schedule_item_assignees (
    schedule_item_id UUID NOT NULL REFERENCES public.schedule_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (schedule_item_id, user_id)
);

-- Enable RLS
ALTER TABLE public.schedule_item_assignees ENABLE ROW LEVEL SECURITY;

-- Allow project members to read and manage assignees for their project
CREATE POLICY "Project members can read schedule assignees"
ON public.schedule_item_assignees FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.schedule_items si
        JOIN public.project_space_members pm ON pm.project_space_id = si.project_id
        WHERE si.id = schedule_item_assignees.schedule_item_id
        AND pm.user_id = auth.uid()
    )
);

CREATE POLICY "Project members can insert schedule assignees"
ON public.schedule_item_assignees FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.schedule_items si
        JOIN public.project_space_members pm ON pm.project_space_id = si.project_id
        WHERE si.id = schedule_item_assignees.schedule_item_id
        AND pm.user_id = auth.uid()
    )
);

CREATE POLICY "Project members can delete schedule assignees"
ON public.schedule_item_assignees FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.schedule_items si
        JOIN public.project_space_members pm ON pm.project_space_id = si.project_id
        WHERE si.id = schedule_item_assignees.schedule_item_id
        AND pm.user_id = auth.uid()
    )
);

-- Migrate existing assignments over
INSERT INTO public.schedule_item_assignees (schedule_item_id, user_id)
SELECT id, assigned_to 
FROM public.schedule_items 
WHERE assigned_to IS NOT NULL;

-- Update the notification trigger to pull from the join table
CREATE OR REPLACE FUNCTION notify_schedule_locked()
RETURNS TRIGGER AS $$
DECLARE
    member_record RECORD;
BEGIN
    IF NEW.is_locked = true AND OLD.is_locked = false THEN
        IF NEW.is_full_crew = true THEN
            -- Notify all project members
            FOR member_record IN 
                SELECT user_id FROM public.project_space_members WHERE project_space_id = NEW.project_id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, content, reference_id, reference_type
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A full-crew schedule phase ("' || NEW.title || '") has been locked.',
                    NEW.id, 'schedule_item'
                );
            END LOOP;
        ELSE
            -- Notify specific assigned members
            FOR member_record IN 
                SELECT user_id FROM public.schedule_item_assignees WHERE schedule_item_id = NEW.id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, content, reference_id, reference_type
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A schedule phase you are assigned to ("' || NEW.title || '") has been locked.',
                    NEW.id, 'schedule_item'
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old column
ALTER TABLE public.schedule_items DROP COLUMN assigned_to;
