import { getSecureItem, setSecureItem } from '../storage/keyStore';
import { getSupabaseClient } from '@cinecraft/api';

export interface DeviceRegistry {
  device_id: string;
  user_id: string;
  identity_public_key: string;  // Base64 SPKI (Curve25519/ECDH)
  signing_public_key: string;   // Base64 SPKI (Ed25519)
  fingerprint: string;          // Human readable safety code
  created_at: string;
  revoked_at?: string | null;
  status: 'active' | 'revoked';
}

export const getDeviceId = async (): Promise<string> => {
  const existing = await getSecureItem('device_id');
  if (existing) return existing;

  const newDeviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  await setSecureItem('device_id', newDeviceId);
  return newDeviceId;
};

export const registerDevice = async (
  userId: string,
  identityPublicKeyB64: string,
  signingPublicKeyB64: string,
  fingerprint: string
): Promise<DeviceRegistry | null> => {
  const deviceId = await getDeviceId();
  const supabase = getSupabaseClient();

  const record: DeviceRegistry = {
    device_id: deviceId,
    user_id: userId,
    identity_public_key: identityPublicKeyB64,
    signing_public_key: signingPublicKeyB64,
    fingerprint,
    created_at: new Date().toISOString(),
    status: 'active',
  };

  try {
    const { error } = await (supabase as any)
      .from('user_devices')
      .upsert({
        device_id: deviceId,
        user_id: userId,
        identity_public_key: identityPublicKeyB64,
        signing_public_key: signingPublicKeyB64,
        fingerprint,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' });

    if (error) {
      console.warn('[E2EE Devices] Supabase device upsert warning:', error.message);
    }
  } catch (err) {
    console.error('[E2EE Devices] Device registration network error:', err);
  }

  return record;
};

export const revokeDevice = async (deviceId: string): Promise<boolean> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await (supabase as any)
      .from('user_devices')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId);

    return !error;
  } catch (err) {
    console.error('[E2EE Devices] Failed to revoke device:', err);
    return false;
  }
};
