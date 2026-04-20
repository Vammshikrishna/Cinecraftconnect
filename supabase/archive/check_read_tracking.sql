-- Check tracking columns for Project Spaces
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_space_members';

-- Check tracking columns for Discussion Rooms
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discussion_room_members';  -- or verification of where members are stored

-- Check message tables
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_space_messages';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discussion_room_messages';
