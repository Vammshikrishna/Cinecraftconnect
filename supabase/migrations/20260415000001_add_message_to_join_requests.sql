-- Migration to add an optional note to project space join requests
ALTER TABLE public.project_space_join_requests 
ADD COLUMN IF NOT EXISTS message TEXT;

-- Update RLS if necessary (it shouldn't be, since it's already using FOR ALL or FOR SELECT/INSERT)
-- Actually, let's verify if the existing policies are enough.
-- In migration 20251231180000_consolidated_project_security.sql:
-- CREATE POLICY "user_manage_own_requests" ON public.project_space_join_requests FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- This covers inserting and selecting the new column.
