-- Migration: Add robust RPC to safely clear project space chat messages
-- Fixes foreign key constraints (project_space_messages_reply_to_id_fkey), RLS restrictions, and space/project ID resolution

CREATE OR REPLACE FUNCTION public.clear_project_space_messages(
    _space_id uuid DEFAULT NULL,
    _project_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_space_ids uuid[];
BEGIN
    -- Collect all possible IDs (space IDs, project IDs, and space_message space_ids)
    SELECT array_agg(DISTINCT space_id_val) INTO target_space_ids
    FROM (
        SELECT id AS space_id_val FROM public.project_spaces
        WHERE (_space_id IS NOT NULL AND (id = _space_id OR project_id = _space_id))
           OR (_project_id IS NOT NULL AND (id = _project_id OR project_id = _project_id))
        UNION
        SELECT project_space_id AS space_id_val FROM public.project_space_messages
        WHERE (_space_id IS NOT NULL AND project_space_id = _space_id)
           OR (_project_id IS NOT NULL AND project_space_id = _project_id)
        UNION
        SELECT _space_id AS space_id_val WHERE _space_id IS NOT NULL
        UNION
        SELECT _project_id AS space_id_val WHERE _project_id IS NOT NULL
    ) sub;

    IF target_space_ids IS NULL OR array_length(target_space_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- 1. Unpin messages in project_spaces
    UPDATE public.project_spaces
    SET pinned_message_id = NULL
    WHERE id = ANY(target_space_ids) OR project_id = ANY(target_space_ids);

    -- 2. Break reply_to_id self-referencing foreign keys in project_space_messages
    UPDATE public.project_space_messages
    SET reply_to_id = NULL
    WHERE project_space_id = ANY(target_space_ids);

    -- 3. Delete reactions associated with these messages
    DELETE FROM public.project_space_message_reactions
    WHERE message_id IN (
        SELECT id FROM public.project_space_messages
        WHERE project_space_id = ANY(target_space_ids)
    );

    -- 4. Delete all messages from project_space_messages
    DELETE FROM public.project_space_messages
    WHERE project_space_id = ANY(target_space_ids);

    -- 5. Delete messages from legacy project_messages table
    UPDATE public.project_messages
    SET reply_to_id = NULL
    WHERE project_id = ANY(target_space_ids);

    DELETE FROM public.project_messages
    WHERE project_id = ANY(target_space_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_project_space_messages(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_project_space_messages(uuid, uuid) TO service_role;
