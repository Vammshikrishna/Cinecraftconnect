-- Database migration: Migrate notification generation logic to Supabase Edge Functions
-- This migration:
-- 1. Drops the direct notifications insertion triggers to let the Edge Function handle generation
-- 2. Restores/recreates triggers on message tables to invoke public.trigger_push_delivery()

-- A. Drop triggers that insert notifications directly in PL/pgSQL
DROP TRIGGER IF EXISTS "trigger_notify_new_direct_message" ON public.direct_messages;
DROP TRIGGER IF EXISTS "trigger_notify_new_room_message" ON public.room_messages;
DROP TRIGGER IF EXISTS "trigger_notify_new_project_message" ON public.project_space_messages;

-- B. Recreate triggers to call public.trigger_push_delivery() Edge Function
DROP TRIGGER IF EXISTS direct_messages_push_delivery ON public.direct_messages;
CREATE TRIGGER direct_messages_push_delivery
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_delivery();

DROP TRIGGER IF EXISTS room_messages_push_delivery ON public.room_messages;
CREATE TRIGGER room_messages_push_delivery
AFTER INSERT ON public.room_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_delivery();

DROP TRIGGER IF EXISTS project_space_messages_push_delivery ON public.project_space_messages;
CREATE TRIGGER project_space_messages_push_delivery
AFTER INSERT ON public.project_space_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_delivery();
