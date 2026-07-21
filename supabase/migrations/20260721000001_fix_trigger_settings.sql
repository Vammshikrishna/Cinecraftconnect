-- Create a secure table to hold custom app settings (url, anon key, etc.) without committing secrets to git
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Enable Row Level Security to prevent unauthorized access
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Note: We intentionally DO NOT define any SELECT/INSERT/UPDATE/DELETE policies for public, anon, or authenticated roles.
-- This ensures only superusers, database triggers running as SECURITY DEFINER, or service_role can read/write this table.

-- Recreate the trigger function to dynamically read values from public.app_settings, falling back to local settings
CREATE OR REPLACE FUNCTION public.trigger_push_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_url TEXT;
    v_key TEXT;
BEGIN
    -- Try to read from secure app_settings table first
    SELECT value INTO v_url FROM public.app_settings WHERE key = 'supabase_url';
    SELECT value INTO v_key FROM public.app_settings WHERE key = 'supabase_anon_key';

    -- Fallback to local settings if table is empty (e.g. in local development)
    IF v_url IS NULL OR v_url = '' THEN
        v_url := current_setting('app.settings.supabase_url', true);
    END IF;
    IF v_key IS NULL OR v_key = '' THEN
        v_key := current_setting('app.settings.supabase_anon_key', true);
    END IF;

    -- Only make HTTP post if we resolved both the URL and the key
    IF v_url IS NOT NULL AND v_key IS NOT NULL AND v_url <> '' AND v_key <> '' THEN
        PERFORM net.http_post(
            url := v_url || '/functions/v1/push-delivery',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_key
            ),
            body := jsonb_build_object(
                'type', TG_OP,
                'table', TG_TABLE_NAME,
                'schema', TG_TABLE_SCHEMA,
                'record', row_to_json(NEW)
            )
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors to prevent blocking the transaction
    RETURN NEW;
END;
$function$
;
