/**
 * Opt-in state for end-to-end encrypted messages on mobile (see docs/E2EE_OPT_IN_DESIGN.md).
 *
 *  - enabled:      the person turned encrypted messages on (profiles.e2ee_enabled); null while unknown/offline
 *  - pendingMode:  what the PIN dialog would do if shown: 'setup' (create a recovery PIN) or 'recovery' (unlock this device)
 *  - promptRequested / dismissed: the PIN dialog only appears once a message screen asks for it, and not again after
 *    the person dismissed it in this session. Screens that are not about messages never ask.
 */
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@cinecraft/api';
import { NativeSecureKeyStore } from './mobileStorage';
import { extractPublicKeyFromPrivateKey } from '@cinecraft/e2ee';
import { generateAndStoreFreshKeyPair, getSyncPrivateKey, subscribeToKeyChanges } from './e2eeKeyEvents';
import { saveCache, getCache, getCurrentUserIdSync, resolveCurrentUserId } from './offlineCache';

export type E2EEPromptMode = 'setup' | 'recovery';

export interface E2EEState {
  enabled: boolean | null;
  pendingMode: E2EEPromptMode | null;
  promptRequested: boolean;
  dismissed: boolean;
}

let state: E2EEState = { enabled: null, pendingMode: null, promptRequested: false, dismissed: false };
const listeners = new Set<() => void>();

const set = (patch: Partial<E2EEState>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

export const getE2EEState = (): E2EEState => state;
export const isE2EEPromptVisible = (s: E2EEState = state): boolean => !!s.pendingMode && s.promptRequested && !s.dismissed;

export const useE2EEState = (): E2EEState => {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const fn = () => setSnapshot(state);
    listeners.add(fn);
    fn();
    return () => { listeners.delete(fn); };
  }, []);
  return snapshot;
};

export const setE2EEEnabled = (enabled: boolean | null) => set({ enabled });
export const setPendingE2EEMode = (pendingMode: E2EEPromptMode | null) => set({ pendingMode });
/** soft request from a message screen: shows the dialog unless it was dismissed this session */
export const requestE2EEPrompt = () => { if (!state.promptRequested) set({ promptRequested: true }); };
/** the person pressed a button for it: always show */
export const openE2EEPrompt = () => set({ promptRequested: true, dismissed: false });
export const dismissE2EEPrompt = () => set({ dismissed: true });
export const resetE2EEPromptState = () => set({ enabled: null, pendingMode: null, promptRequested: false, dismissed: false });

/** true when this device holds the private key (encrypted messages are unlocked here) */
export const useHasLocalE2EEKey = (): boolean => {
  const [has, setHas] = useState(() => {
    const id = getCurrentUserIdSync();
    return !!(id && getSyncPrivateKey(id));
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = getCurrentUserIdSync() || (await resolveCurrentUserId());
      if (!id) return;
      if (getSyncPrivateKey(id)) { if (alive) setHas(true); return; }
      const store = new NativeSecureKeyStore();
      const key = (await store.getKey(`e2ee_private_key_${id}`).catch(() => null)) || (await store.getKey(`priv_${id}`).catch(() => null));
      if (alive) setHas(!!key);
    })();
    const unsubscribe = subscribeToKeyChanges((_userId, newKey) => { if (alive) setHas(!!newKey); });
    return () => { alive = false; unsubscribe(); };
  }, []);
  return has;
};

const enabledCacheKey = (userId: string) => `e2ee_enabled_${userId}`;

/** Read the flag with an offline fallback, remember it, and publish it to the app. */
export const loadE2EEEnabled = async (userId: string, fromServer?: boolean | null): Promise<boolean | null> => {
  let enabled: boolean | null = fromServer === undefined ? null : fromServer;
  if (enabled === null) enabled = (await getCache<boolean>(enabledCacheKey(userId)).catch(() => null)) ?? null;
  else saveCache(enabledCacheKey(userId), enabled).catch(() => { });
  setE2EEEnabled(enabled);
  return enabled;
};

const readLocalKey = async (userId: string): Promise<string | null> => {
  const cached = getSyncPrivateKey(userId);
  if (cached) return cached;
  const store = new NativeSecureKeyStore();
  return (await store.getKey(`e2ee_private_key_${userId}`)) || (await store.getKey(`priv_${userId}`)) || null;
};

/**
 * Turn encrypted messages on: create (or keep) the key, publish it, flip the flag, then ask for the PIN.
 * A PIN backup that exists without a key on this device means "unlock", never "overwrite with a new key".
 */
export async function enableE2EE(userId: string): Promise<void> {
  const supabase: any = getSupabaseClient();
  const [localKey, backup, prof] = await Promise.all([
    readLocalKey(userId),
    supabase.from('key_backups').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('public_key').eq('id', userId).maybeSingle(),
  ]);
  const hasBackup = !!backup?.data;
  const hasPublicKey = !!prof?.data?.public_key;

  let mode: E2EEPromptMode | null = null;
  if (localKey) {
    if (!hasPublicKey) {
      // a key on this device that was never published: publish its public half
      const pub = await extractPublicKeyFromPrivateKey(localKey);
      const { error: pubErr } = await supabase.from('profiles').update({ public_key: pub }).eq('id', userId);
      if (pubErr) throw pubErr;
    }
    mode = hasBackup ? null : 'setup';
  } else if (hasBackup || hasPublicKey) {
    mode = 'recovery'; // a key exists elsewhere: restore it with the PIN (or reset) instead of overwriting it
  } else {
    await generateAndStoreFreshKeyPair(userId);
    mode = 'setup';
  }

  const { error } = await supabase.rpc('set_e2ee_enabled', { p_enabled: true });
  if (error) throw error;

  await loadE2EEEnabled(userId, true);
  setPendingE2EEMode(mode);
  if (mode) openE2EEPrompt();
}

/** Turn it off. Keys and the PIN backup stay, so history stays readable and it can be turned on again. */
export async function disableE2EE(userId: string): Promise<void> {
  const supabase: any = getSupabaseClient();
  const { error } = await supabase.rpc('set_e2ee_enabled', { p_enabled: false });
  if (error) throw error;
  await loadE2EEEnabled(userId, false);
  setPendingE2EEMode(null);
}
