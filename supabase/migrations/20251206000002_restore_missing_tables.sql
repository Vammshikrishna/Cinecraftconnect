-- ============================================================================
-- MASSIVE RESTORATION: MISSING PROJECT TABLES (FIXED V2)
-- ============================================================================
-- This script restores all tables that are returning 404 Not Found errors.
-- It uses IF NOT EXISTS to be safe to run on any environment.
-- FIXED: Removed 'tasks' from generic loop to avoid column name error.
-- ============================================================================

-- 1. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. FILES
CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    size bigint,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- 3. CALL SHEETS
CREATE TABLE IF NOT EXISTS public.call_sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    shoot_date date NOT NULL,
    call_time time NOT NULL,
    location text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.call_sheets ENABLE ROW LEVEL SECURITY;

-- 4. SHOT LIST
CREATE TABLE IF NOT EXISTS public.shot_list (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    scene text NOT NULL,
    shot text NOT NULL,
    description text,
    equipment text,
    camera_angle text,
    movement text,
    status text DEFAULT 'planned' CHECK (status IN ('planned', 'shot', 'cut')),
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.shot_list ENABLE ROW LEVEL SECURITY;

-- 5. SCHEDULE ITEMS
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    type text DEFAULT 'shoot' CHECK (type IN ('shoot', 'meeting', 'prep', 'wrap')),
    location text,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

-- 6. BUDGET ITEMS
CREATE TABLE IF NOT EXISTS public.budget_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(10, 2) NOT NULL DEFAULT 0,
    status text DEFAULT 'estimated' CHECK (status IN ('estimated', 'actual', 'paid')),
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- 7. LEGAL DOCS
CREATE TABLE IF NOT EXISTS public.legal_docs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    type text NOT NULL, -- 'contract', 'permit', 'release', etc.
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'expired')),
    url text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.legal_docs ENABLE ROW LEVEL SECURITY;

-- 8. CALLS SYSTEM
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type text NOT NULL CHECK (room_type IN ('project', 'discussion')),
    room_id uuid NOT NULL, 
    daily_room_name text UNIQUE NOT NULL,
    daily_room_url text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at timestamptz DEFAULT now() NOT NULL,
    ended_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.call_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'joined' CHECK (status IN ('requesting', 'joined', 'left')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    left_at timestamptz,
    UNIQUE(call_id, user_id)
);
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- 9. PROJECT APPLICATIONS
CREATE TABLE IF NOT EXISTS public.project_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message text,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- 10. FIX PROJECT MESSAGES COLUMN (Rename sender_id to user_id if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_messages' AND column_name = 'sender_id') THEN
    ALTER TABLE public.project_messages RENAME COLUMN sender_id TO user_id;
  END IF;
END $$;

-- 11. APPLY RLS POLICIES FOR NEW TABLES (Basic Member Access)
-- We use a generic function to apply policies to all these project tables
-- View: Members Only
-- Create/Edit: Members Only

DO $$ 
DECLARE
    t text;
BEGIN
    -- REMOVED 'tasks' from this array because it uses project_space_id
    FOR t IN SELECT unnest(ARRAY['files', 'call_sheets', 'shot_list', 'schedule_items', 'budget_items', 'legal_docs']) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Member View %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Member View %I" ON public.%I FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = %I.project_id AND user_id = auth.uid())
            OR 
            EXISTS (SELECT 1 FROM public.project_spaces WHERE id = %I.project_id AND creator_id = auth.uid())
        )', t, t, t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Member Manage %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Member Manage %I" ON public.%I FOR ALL USING (
            EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = %I.project_id AND user_id = auth.uid())
            OR 
            EXISTS (SELECT 1 FROM public.project_spaces WHERE id = %I.project_id AND creator_id = auth.uid())
        )', t, t, t, t);
    END LOOP;
END $$;

-- Special handling for 'tasks' which uses 'project_space_id' instead of 'project_id'
DROP POLICY IF EXISTS "Member View tasks" ON public.tasks;
CREATE POLICY "Member View tasks" ON public.tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = tasks.project_space_id AND user_id = auth.uid())
    OR 
    EXISTS (SELECT 1 FROM public.project_spaces WHERE id = tasks.project_space_id AND creator_id = auth.uid())
);

DROP POLICY IF EXISTS "Member Manage tasks" ON public.tasks;
CREATE POLICY "Member Manage tasks" ON public.tasks FOR ALL USING (
    EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = tasks.project_space_id AND user_id = auth.uid())
    OR 
    EXISTS (SELECT 1 FROM public.project_spaces WHERE id = tasks.project_space_id AND creator_id = auth.uid())
);

-- Fix Project Applications RLS
DROP POLICY IF EXISTS "Users can view own applications" ON public.project_applications;
CREATE POLICY "Users can view own applications" ON public.project_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creators can view applications" ON public.project_applications;
CREATE POLICY "Creators can view applications" ON public.project_applications FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_spaces WHERE id = project_applications.project_id AND creator_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can apply" ON public.project_applications;
CREATE POLICY "Users can apply" ON public.project_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
