-- Enable the moddatetime extension which is required for Supabase auto-updating updated_at columns
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Ensure the extension is accessible
GRANT EXECUTE ON FUNCTION extensions.moddatetime() TO PUBLIC;
