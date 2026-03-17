DO $$
DECLARE
    col_name text;
BEGIN
    RAISE NOTICE '--- COLUMNS FOR direct_messages ---';
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'direct_messages' 
    LOOP
        RAISE NOTICE 'Column: %', col_name;
    END LOOP;
    RAISE NOTICE '----------------------------------';
END $$;
