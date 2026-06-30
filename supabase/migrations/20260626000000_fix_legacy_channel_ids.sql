-- Migration: Fix legacy channel IDs in direct_messages
-- Converts old 73-character UUID-UUID channel IDs to the correct 36-character hashed channel IDs.

UPDATE public.direct_messages
SET channel_id = substring(LEAST(sender_id::text, receiver_id::text) from 1 for 18) || substring(GREATEST(sender_id::text, receiver_id::text) from 19)
WHERE length(channel_id) > 36;
