-- 20251201000006_create_project_space_tables.sql
-- Create all missing tables for project space functionality

-- 1. Files table for file management
CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    size bigint NOT NULL,
    url text NOT NULL,
    file_type text,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Call Sheets table
CREATE TABLE IF NOT EXISTS public.call_sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    date date NOT NULL,
    call_time time,
    location text,
    director text,
    director_phone text,
    producer text,
    producer_phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Shot List table
CREATE TABLE IF NOT EXISTS public.shot_list (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    scene integer NOT NULL,
    shot integer NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Legal Documents table
CREATE TABLE IF NOT EXISTS public.legal_docs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    url text,
    document_type text,
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Budget Items table
CREATE TABLE IF NOT EXISTS public.budget_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    category text NOT NULL,
    item_name text NOT NULL,
    estimated_cost numeric(12, 2),
    actual_cost numeric(12, 2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. Schedule Items table
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'scheduled',
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shot_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Files
DROP POLICY IF EXISTS "Project members can view files" ON public.files;
CREATE POLICY "Project members can view files" ON public.files FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = files.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = files.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can upload files" ON public.files;
CREATE POLICY "Project members can upload files" ON public.files FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "File uploaders can delete their files" ON public.files;
CREATE POLICY "File uploaders can delete their files" ON public.files FOR DELETE USING (
    uploaded_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = files.project_id AND creator_id = auth.uid()
    )
);

-- RLS Policies for Call Sheets (same pattern for all)
DROP POLICY IF EXISTS "Project members can view call sheets" ON public.call_sheets;
CREATE POLICY "Project members can view call sheets" ON public.call_sheets FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = call_sheets.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = call_sheets.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can manage call sheets" ON public.call_sheets;
CREATE POLICY "Project members can manage call sheets" ON public.call_sheets FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = call_sheets.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = call_sheets.project_id AND creator_id = auth.uid()
    )
);

-- RLS Policies for Shot List
DROP POLICY IF EXISTS "Project members can view shot list" ON public.shot_list;
CREATE POLICY "Project members can view shot list" ON public.shot_list FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = shot_list.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = shot_list.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can manage shot list" ON public.shot_list;
CREATE POLICY "Project members can manage shot list" ON public.shot_list FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = shot_list.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = shot_list.project_id AND creator_id = auth.uid()
    )
);

-- RLS Policies for Legal Docs
DROP POLICY IF EXISTS "Project members can view legal docs" ON public.legal_docs;
CREATE POLICY "Project members can view legal docs" ON public.legal_docs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = legal_docs.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = legal_docs.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can manage legal docs" ON public.legal_docs;
CREATE POLICY "Project members can manage legal docs" ON public.legal_docs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = legal_docs.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = legal_docs.project_id AND creator_id = auth.uid()
    )
);

-- RLS Policies for Budget Items
DROP POLICY IF EXISTS "Project members can view budget" ON public.budget_items;
CREATE POLICY "Project members can view budget" ON public.budget_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = budget_items.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = budget_items.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can manage budget" ON public.budget_items;
CREATE POLICY "Project members can manage budget" ON public.budget_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = budget_items.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = budget_items.project_id AND creator_id = auth.uid()
    )
);

-- RLS Policies for Schedule Items
DROP POLICY IF EXISTS "Project members can view schedule" ON public.schedule_items;
CREATE POLICY "Project members can view schedule" ON public.schedule_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = schedule_items.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = schedule_items.project_id AND creator_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Project members can manage schedule" ON public.schedule_items;
CREATE POLICY "Project members can manage schedule" ON public.schedule_items FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.project_space_members 
        WHERE project_space_id = schedule_items.project_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.project_spaces 
        WHERE id = schedule_items.project_id AND creator_id = auth.uid()
    )
);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_call_sheets_updated_at ON public.call_sheets;
CREATE TRIGGER update_call_sheets_updated_at BEFORE UPDATE ON public.call_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shot_list_updated_at ON public.shot_list;
CREATE TRIGGER update_shot_list_updated_at BEFORE UPDATE ON public.shot_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_legal_docs_updated_at ON public.legal_docs;
CREATE TRIGGER update_legal_docs_updated_at BEFORE UPDATE ON public.legal_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_items_updated_at ON public.budget_items;
CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON public.budget_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_items_updated_at ON public.schedule_items;
CREATE TRIGGER update_schedule_items_updated_at BEFORE UPDATE ON public.schedule_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
