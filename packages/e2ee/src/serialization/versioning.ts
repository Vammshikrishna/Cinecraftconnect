/**
 * E2EE Protocol Versioning
 */

export const CURRENT_PROTOCOL_VERSION = 2;
export const LEGACY_RSA_PROTOCOL_VERSION = 1;

export interface ProtocolEnvelope {
  version: number;
  type: 'dm' | 'group';
  conversation_id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string; // Base64 encoded payload
  header: {
    dh_pub?: string;      // Ephemeral DH Public key for Double Ratchet
    n_msg: number;        // Message index in chain
    pn_msg?: number;       // Previous chain message count
    epoch?: number;       // Group Epoch index for MLS/Group Ratchet
    iv: string;           // AES-GCM Initialization Vector
  };
  signature?: string;     // Ed25519 digital signature
  attachment?: {
    encrypted_url: string;
    encrypted_type: string;
    file_key: string;     // Encrypted file symmetric key
    metadata?: string;    // Encrypted filename & type
  };
}

export const isValidProtocolEnvelope = (payload: any): payload is ProtocolEnvelope => {
  if (!payload || typeof payload !== 'object') return false;
  return (
    typeof payload.version === 'number' &&
    (payload.type === 'dm' || payload.type === 'group') &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.sender_device_id === 'string' &&
    typeof payload.header === 'object' &&
    typeof payload.header.iv === 'string'
  );
};
