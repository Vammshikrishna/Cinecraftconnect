SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
