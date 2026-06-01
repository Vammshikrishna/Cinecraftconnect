-- Add is_full_crew to schedule_items
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS is_full_crew BOOLEAN NOT NULL DEFAULT false;

-- Update the trigger to notify everyone if is_full_crew is true
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
        ELSIF NEW.assigned_to IS NOT NULL THEN
            -- Notify specific member
            INSERT INTO public.notifications (
                user_id, type, title, content, reference_id, reference_type
            ) VALUES (
                NEW.assigned_to, 'schedule_locked', 'Schedule Locked',
                'A schedule phase you are assigned to ("' || NEW.title || '") has been locked.',
                NEW.id, 'schedule_item'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
