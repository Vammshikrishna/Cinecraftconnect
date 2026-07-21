-- Create RPC to safely retrieve auth.uid() to prevent E2EE client token synchronization race conditions
CREATE OR REPLACE FUNCTION public.get_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN auth.uid();
END;
$$;
