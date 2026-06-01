-- Fix: Ensure room_members has the correct foreign key relationship to profiles
-- This ensures that the .select('*, profiles(*)') query works correctly in PostgREST

-- 1. Ensure the role column exists (if it was missing)
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
-- 2. Drop and recreate the foreign key to profiles if necessary
-- We use a DO block to safely check and add the constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_members_user_id_fkey' 
        AND table_name = 'room_members'
    ) THEN
        ALTER TABLE public.room_members 
        ADD CONSTRAINT room_members_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) 
        ON DELETE CASCADE;
    END IF;
END $$;
-- 3. Notify PostgREST to reload its schema cache (optional but helpful)
NOTIFY pgrst, 'reload schema';
