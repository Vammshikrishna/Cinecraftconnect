-- ============================================================================
-- CLEANUP DUPLICATE PROJECT SPACES
-- ============================================================================
-- The error "Results contain 2 rows" implies duplicates exist in project_spaces.
-- We must identify and delete the extras, keeping the one that is actually being used (or the oldest/newest).
-- Since all data is usually tied to 'project_space_id', deleting the WRONG space could orphan data.
-- However, if both point to the same 'project', they are redundant.

DO $$
DECLARE
    dup RECORD;
BEGIN
    FOR dup IN 
        SELECT project_id 
        FROM public.project_spaces 
        GROUP BY project_id 
        HAVING count(*) > 1
    LOOP
        -- Keep the OLDEST space (min id) usually, assuming it was created first.
        -- OR Keep the one with the most relations? simpler to keep oldest for now.
        DELETE FROM public.project_spaces
        WHERE project_id = dup.project_id
        AND id NOT IN (
            SELECT id FROM public.project_spaces
            WHERE project_id = dup.project_id
            ORDER BY created_at ASC
            LIMIT 1
        );
        RAISE NOTICE 'Cleaned up duplicates for project %', dup.project_id;
    END LOOP;
END $$;

-- ADD UNIQUE CONSTRAINT to prevent future duplicates
ALTER TABLE public.project_spaces
DROP CONSTRAINT IF EXISTS unique_space_per_project;

ALTER TABLE public.project_spaces
ADD CONSTRAINT unique_space_per_project UNIQUE (project_id);
