-- 1. Ensure project_spaces table exists with all required columns
CREATE TABLE IF NOT EXISTS public.project_spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_id)
);

-- 2. If table existed but was missing project_id (edge case), add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'project_spaces'
        AND column_name = 'project_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.project_spaces ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Force schema cache reload to resolve "Could not find column ... in schema cache" error
NOTIFY pgrst, 'reload config';
