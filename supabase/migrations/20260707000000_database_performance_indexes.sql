-- Create optimized composite indexes for message history pagination and filters
CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_id_created_at 
ON public.direct_messages (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id 
ON public.direct_messages (receiver_id);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_id_created_at 
ON public.room_messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_space_messages_space_id_created_at 
ON public.project_space_messages (project_space_id, created_at DESC);

-- Drop redundant push delivery triggers on message tables to consolidate all push notifications
-- under the notifications table insert trigger notifications_push_delivery
DROP TRIGGER IF EXISTS direct_messages_push_delivery ON public.direct_messages;
DROP TRIGGER IF EXISTS room_messages_push_delivery ON public.room_messages;
DROP TRIGGER IF EXISTS project_space_messages_push_delivery ON public.project_space_messages;
