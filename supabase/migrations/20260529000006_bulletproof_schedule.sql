-- 1. Ensure columns exist (just in case they were missed)
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS is_full_crew BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop any rogue moddatetime triggers that Supabase dashboard might have injected
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'schedule_items' 
        AND action_statement LIKE '%moddatetime%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS "' || trigger_record.trigger_name || '" ON public.schedule_items';
    END LOOP;
END $$;

-- 3. Ensure our safe update_updated_at_column trigger exists
DROP TRIGGER IF EXISTS update_schedule_items_updated_at ON public.schedule_items;
CREATE TRIGGER update_schedule_items_updated_at 
BEFORE UPDATE ON public.schedule_items 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
