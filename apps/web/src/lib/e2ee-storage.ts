import { getSecureKeyStore } from '@cinecraft/storage';

export const getLocalPrivateKey = async (userId: string): Promise<string | null> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    const val = await getSecureKeyStore().getKey(key);
    if (val) {
      console.log('🔐 [E2EE Storage] Private key loaded from secure key store');
      return val;
    }
    return null;
  } catch (err) {
    console.error('🔐 [E2EE Storage] Failed to get local private key:', err);
    return null;
  }
};

export const setLocalPrivateKey = async (userId: string, privateKeyStr: string): Promise<void> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    await getSecureKeyStore().setKey(key, privateKeyStr);
    console.log('🔐 [E2EE Storage] Private key saved to secure key store');
  } catch (err) {
    console.error('🔐 [E2EE Storage] Failed to set local private key:', err);
  }
};

export const removeLocalPrivateKey = async (userId: string): Promise<void> => {
  const key = `e2ee_private_key_${userId}`;
  try {
    await getSecureKeyStore().deleteKey(key);
    console.log('🔐 [E2EE Storage] Private key deleted from secure key store');
  } catch (err) {
    console.error('🔐 [E2EE Storage] Failed to remove local private key:', err);
  }
};
