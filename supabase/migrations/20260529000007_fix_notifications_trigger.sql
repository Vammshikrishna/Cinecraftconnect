-- Fix the trigger to use the correct columns for the notifications table
-- (message instead of content, related_id instead of reference_id, and dropping reference_type)

CREATE OR REPLACE FUNCTION notify_schedule_locked()
RETURNS TRIGGER AS $$
DECLARE
    member_record RECORD;
BEGIN
    IF NEW.is_locked = true AND OLD.is_locked = false THEN
        IF NEW.is_full_crew = true THEN
            -- Notify everyone in the project
            FOR member_record IN 
                SELECT user_id FROM public.project_space_members WHERE project_space_id = NEW.project_id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, message, related_id
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A schedule phase ("' || NEW.title || '") has been locked for the entire crew.',
                    NEW.id
                );
            END LOOP;
        ELSE
            -- Notify specific assigned members
            FOR member_record IN 
                SELECT user_id FROM public.schedule_item_assignees WHERE schedule_item_id = NEW.id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, message, related_id
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A schedule phase you are assigned to ("' || NEW.title || '") has been locked.',
                    NEW.id
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
