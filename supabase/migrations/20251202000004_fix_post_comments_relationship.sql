-- Ensure post_comments table exists
CREATE TABLE IF NOT EXISTS public.post_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Public view post_comments'
    ) THEN
        CREATE POLICY "Public view post_comments" ON public.post_comments FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Authenticated users can create post_comments'
    ) THEN
        CREATE POLICY "Authenticated users can create post_comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can update own post_comments'
    ) THEN
        CREATE POLICY "Users can update own post_comments" ON public.post_comments FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can delete own post_comments'
    ) THEN
        CREATE POLICY "Users can delete own post_comments" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Ensure Foreign Key to profiles exists
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_user_id_fkey_profiles'
    ) THEN
        -- If user_id already references auth.users (from previous creation), we can add a second FK or replace it.
        -- Since profiles.id is same as auth.users.id, referencing profiles is safe and preferred for PostgREST embedding.
        
        -- We'll try to add it. If user_id references auth.users, it's fine.
        -- However, if the table was created with REFERENCES auth.users(id), it has a FK.
        -- We want to ensure it explicitly references profiles for the embedding to work.
        
        ALTER TABLE public.post_comments 
        ADD CONSTRAINT post_comments_user_id_fkey_profiles 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;
