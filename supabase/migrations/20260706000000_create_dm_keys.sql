-- Create dm_keys table for Symmetric E2EE DMs
CREATE TABLE IF NOT EXISTS dm_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_symmetric_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE dm_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own keys (self-healing / provisioning)
CREATE POLICY "Users can insert dm_keys for themselves or others"
ON dm_keys
FOR INSERT
WITH CHECK (true); -- Anyone can encrypt a key for anyone else

-- Policy: Users can read their own keys
CREATE POLICY "Users can read their own dm_keys"
ON dm_keys
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own keys
CREATE POLICY "Users can update their own dm_keys"
ON dm_keys
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own keys
CREATE POLICY "Users can delete their own dm_keys"
ON dm_keys
FOR DELETE
USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dm_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_dm_keys_updated_at_trigger
BEFORE UPDATE ON dm_keys
FOR EACH ROW
EXECUTE FUNCTION update_dm_keys_updated_at();
