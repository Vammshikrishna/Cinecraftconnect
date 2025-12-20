-- Add FK constraint if missing (although likely schema cache)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_members_user_id_fkey'
    ) THEN
        ALTER TABLE public.room_members
        ADD CONSTRAINT room_members_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Force schema cache reload (by notifying pgrst)
NOTIFY pgrst, 'reload config';
