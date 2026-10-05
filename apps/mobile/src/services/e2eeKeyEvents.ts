import { NativeSecureKeyStore } from './mobileStorage';
import {
  generateUserKeyPair,
  exportPublicKey,
  exportPrivateKey,
} from '@cinecraft/e2ee';
import { getSupabaseClient } from '@cinecraft/api';

type KeyChangeCallback = (userId: string, privateKey: string | null) => void;
const listeners = new Set<KeyChangeCallback>();

// In-memory cache for synchronous instant access
const inMemoryPrivateKeys = new Map<string, string>();

/**
 * Subscribe to private key availability/change events across the app.
 */
export function subscribeToKeyChanges(callback: KeyChangeCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Broadcast that a private key has been saved, recovered, or purged.
 */
export function notifyKeyChanged(userId: string, privateKey: string | null): void {
  if (userId) {
    if (privateKey) {
      inMemoryPrivateKeys.set(userId, privateKey);
    } else {
      inMemoryPrivateKeys.delete(userId);
    }
  } else {
    inMemoryPrivateKeys.clear();
  }

  listeners.forEach((listener) => {
    try {
      listener(userId, privateKey);
    } catch (e) {
      console.warn('[e2eeKeyEvents] Error in key changed listener:', e);
    }
  });
}

/**
 * Get synchronously cached private key for 0ms lookup.
 */
export function getSyncPrivateKey(userId: string): string | null {
  return inMemoryPrivateKeys.get(userId) || null;
}

/**
 * Set synchronously cached private key.
 */
export function setSyncPrivateKey(userId: string, privateKey: string): void {
  inMemoryPrivateKeys.set(userId, privateKey);
}

/**
 * Generates a fresh E2EE key pair for the user, stores it securely on device,
 * uploads public key to profiles in Supabase, and notifies all active listeners.
 */
export async function generateAndStoreFreshKeyPair(userId: string): Promise<string> {
  console.log('[e2eeKeyEvents] Generating fresh E2EE key pair for user:', userId);
  const keyPair = await generateUserKeyPair();
  const publicKeyStr = await exportPublicKey(keyPair.publicKey);
  const privateKeyStr = await exportPrivateKey(keyPair.privateKey);

  // 1. Save locally in Keychain & Secure Storage
  const secureStore = new NativeSecureKeyStore();
  await secureStore.setKey(`e2ee_private_key_${userId}`, privateKeyStr);
  await secureStore.setKey(`priv_${userId}`, privateKeyStr);
  setSyncPrivateKey(userId, privateKeyStr);

  // 2. Broadcast to all mounted screens (MessagesList, Conversation, DiscussionRoom, etc.)
  notifyKeyChanged(userId, privateKeyStr);

  // 3. Upload public key to profiles in Supabase
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('profiles')
      .update({ public_key: publicKeyStr })
      .eq('id', userId);

    if (error) {
      console.warn('[e2eeKeyEvents] Failed to update profiles public_key:', error);
    }
  } catch (err) {
    console.warn('[e2eeKeyEvents] Network error updating profiles public_key:', err);
  }

  return privateKeyStr;
}
