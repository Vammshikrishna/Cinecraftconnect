-- Add columns for E2EE keys
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS public_key text,
ADD COLUMN IF NOT EXISTS encrypted_private_key text,
ADD COLUMN IF NOT EXISTS key_salt text;

-- Add comment
COMMENT ON COLUMN profiles.public_key IS 'User ECDH Public Key (Base64)';
COMMENT ON COLUMN profiles.encrypted_private_key IS 'User ECDH Private Key encrypted with password (Base64)';
COMMENT ON COLUMN profiles.key_salt IS 'Salt used for password-based key derivation (Base64)';
