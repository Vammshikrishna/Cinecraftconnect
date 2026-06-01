-- Drop duplicate and unsafe synchronous triggers that block transactions and make external network calls
DROP TRIGGER IF EXISTS "Push Delivery - DMs" ON public.direct_messages;
DROP TRIGGER IF EXISTS "Push Delivery - Notifications" ON public.notifications;
DROP TRIGGER IF EXISTS "Push Delivery - Projects" ON public.project_space_messages;
DROP TRIGGER IF EXISTS "Push Delivery - Rooms" ON public.room_messages;
