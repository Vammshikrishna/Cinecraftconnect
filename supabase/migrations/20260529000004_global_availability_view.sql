-- Create a unified view for personal availability and project schedule bookings
CREATE OR REPLACE VIEW public.global_user_availability_view WITH (security_invoker=on) AS

-- 1. Explicit personal calendar availability
SELECT 
    id::text as id, 
    user_id, 
    start_date, 
    end_date, 
    status, 
    notes,
    'personal' as source_type,
    NULL::uuid as source_project_id
FROM public.user_availability

UNION ALL

-- 2. Explicit schedule assignees (only locked items)
SELECT
    (si.id::text || '-' || sia.user_id::text) as id,
    sia.user_id,
    si.start_date,
    COALESCE(si.end_date, si.start_date) as end_date,
    'booked' as status,
    'Booked for project schedule: ' || si.title as notes,
    'schedule' as source_type,
    si.project_id as source_project_id
FROM public.schedule_item_assignees sia
JOIN public.schedule_items si ON si.id = sia.schedule_item_id
WHERE si.is_locked = true AND si.is_full_crew = false

UNION ALL

-- 3. Implicit full-crew assignments (only locked items)
SELECT
    (si.id::text || '-' || pm.user_id::text) as id,
    pm.user_id,
    si.start_date,
    COALESCE(si.end_date, si.start_date) as end_date,
    'booked' as status,
    'Booked for full-crew project schedule: ' || si.title as notes,
    'schedule' as source_type,
    si.project_id as source_project_id
FROM public.schedule_items si
JOIN public.project_space_members pm ON pm.project_space_id = si.project_id
WHERE si.is_full_crew = true AND si.is_locked = true;

-- Grant permissions so the frontend can query the view
GRANT SELECT ON public.global_user_availability_view TO authenticated;
GRANT SELECT ON public.global_user_availability_view TO anon;
GRANT SELECT ON public.global_user_availability_view TO service_role;
