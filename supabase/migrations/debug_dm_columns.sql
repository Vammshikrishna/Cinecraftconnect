DO $$
BEGIN
    RAISE NOTICE 'Checking DM Table Columns:';
    FOR r IN SELECT column_name FROM information_schema.columns WHERE table_name = 'direct_messages' LOOP
        RAISE NOTICE '%', r.column_name;
    END LOOP;
END $$;
