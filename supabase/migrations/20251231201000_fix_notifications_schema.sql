-- Add missing columns to notifications table if they don't exist
DO $$
BEGIN
    -- actor_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'actor_id') THEN
        ALTER TABLE public.notifications ADD COLUMN actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- related_id (renaming resource_id if exists/adding)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'resource_id') THEN
        ALTER TABLE public.notifications RENAME COLUMN resource_id TO related_id;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_id') THEN
        ALTER TABLE public.notifications ADD COLUMN related_id UUID;
    END IF;

    -- related_type (renaming resource_type if exists/adding)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'resource_type') THEN
        ALTER TABLE public.notifications RENAME COLUMN resource_type TO related_type;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_type') THEN
        ALTER TABLE public.notifications ADD COLUMN related_type TEXT;
    END IF;

    -- action_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
        ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
    END IF;

    -- priority
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
        ALTER TABLE public.notifications ADD COLUMN priority TEXT DEFAULT 'low';
    END IF;

    -- is_actionable
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_actionable') THEN
        ALTER TABLE public.notifications ADD COLUMN is_actionable BOOLEAN DEFAULT false;
    END IF;

    -- metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
