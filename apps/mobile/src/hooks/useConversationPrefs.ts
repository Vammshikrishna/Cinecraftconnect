import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { resolveCurrentUserId, getCurrentUserIdSync } from '../services/offlineCache';

export const MAX_PINNED_CHATS = 3;
export type ChatPref = { muted?: boolean; pinned?: boolean };
export type ChatPrefs = Record<string, ChatPref>;

const EVENT = 'cc:convo-prefs';
const key = (userId: string) => `@cc_convo_prefs:${userId}`;

const readLocal = async (userId: string): Promise<ChatPrefs> => {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
};
const writeLocal = (userId: string, prefs: ChatPrefs) => { AsyncStorage.setItem(key(userId), JSON.stringify(prefs)).catch(() => { }); };

// one copy shared by every screen using the hook
let shared: { userId: string | null; prefs: ChatPrefs } = { userId: null, prefs: {} };

export const pinnedCount = (prefs: ChatPrefs) => Object.values(prefs).filter((p) => p?.pinned).length;

/** Pinned chats first (keeping their order), everything else unchanged. */
export function pinnedFirst<T extends { partner: { id: string } }>(items: T[], prefs: ChatPrefs): T[] {
  const pinned = items.filter((c) => prefs[c.partner.id]?.pinned);
  if (pinned.length === 0) return items;
  return [...pinned, ...items.filter((c) => !prefs[c.partner.id]?.pinned)];
}

/**
 * Per-person Mute and Pin for direct chats, kept in conversation_prefs. If the table is missing the choice
 * is kept on this phone only.
 */
export function useConversationPrefs() {
  const [userId, setUserId] = useState<string | null>(getCurrentUserIdSync());
  const [prefs, setPrefs] = useState<ChatPrefs>(shared.userId && shared.userId === userId ? shared.prefs : {});

  useEffect(() => {
    let alive = true;
    resolveCurrentUserId().then((id) => { if (alive && id) setUserId(id); }).catch(() => { });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const apply = (p: ChatPrefs) => { shared = { userId, prefs: p }; if (!cancelled) setPrefs(p); };
    (async () => {
      apply(await readLocal(userId));
      try {
        const { data, error } = await (getSupabaseClient() as any).from('conversation_prefs').select('partner_id, muted, pinned').eq('user_id', userId);
        if (cancelled || error || !Array.isArray(data)) return; // table missing: keep the local copy
        const next: ChatPrefs = {};
        for (const r of data) next[r.partner_id] = { muted: !!r.muted, pinned: !!r.pinned };
        writeLocal(userId, next);
        apply(next);
      } catch { /* keep local */ }
    })();
    const sub = DeviceEventEmitter.addListener(EVENT, () => { if (shared.userId === userId && !cancelled) setPrefs(shared.prefs); });
    return () => { cancelled = true; sub.remove(); };
  }, [userId]);

  const save = useCallback(async (partnerId: string, patch: { muted?: boolean; pinned?: boolean }): Promise<{ ok: boolean; message?: string }> => {
    if (!userId) return { ok: false, message: 'Sign in first' };
    const current = shared.userId === userId ? shared.prefs : await readLocal(userId);
    const merged = { muted: !!current[partnerId]?.muted, pinned: !!current[partnerId]?.pinned, ...patch };
    try {
      const { error } = await (getSupabaseClient() as any)
        .from('conversation_prefs')
        .upsert({ user_id: userId, partner_id: partnerId, ...merged }, { onConflict: 'user_id,partner_id' });
      const missing = !!error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message || ''));
      if (error && !missing) {
        return { ok: false, message: /pin up to 3/i.test(error.message || '') ? `You can pin up to ${MAX_PINNED_CHATS} chats` : 'Could not save that. Try again.' };
      }
    } catch { /* offline or no table: keep it on this phone */ }
    const next = { ...current, [partnerId]: merged };
    shared = { userId, prefs: next };
    writeLocal(userId, next);
    setPrefs(next);
    DeviceEventEmitter.emit(EVENT);
    return { ok: true };
  }, [userId]);

  const setMuted = useCallback((partnerId: string, muted: boolean) => save(partnerId, { muted }), [save]);
  const toggleMute = useCallback((partnerId: string) => save(partnerId, { muted: !prefs[partnerId]?.muted }), [save, prefs]);

  const togglePin = useCallback(async (partnerId: string) => {
    const pinned = !!prefs[partnerId]?.pinned;
    if (!pinned && pinnedCount(prefs) >= MAX_PINNED_CHATS) {
      return { ok: false, message: `You can pin up to ${MAX_PINNED_CHATS} chats. Unpin one first.` };
    }
    return save(partnerId, { pinned: !pinned });
  }, [save, prefs]);

  /** One time: copy mute choices from the old per-phone keys into the table for these partners. */
  const migrateLegacyMutes = useCallback(async (partnerIds: string[]) => {
    if (!userId) return;
    try {
      const flag = `@cc_prefs_migrated:${userId}`;
      if (await AsyncStorage.getItem(flag)) return;
      const isMuted = async (k: string) => {
        const raw = await AsyncStorage.getItem(k);
        if (!raw) return null;
        try { return JSON.parse(raw)?.muteConversation === true; } catch { return false; }
      };
      let allOk = true;
      const done = new Set<string>();
      for (const pid of partnerIds) {
        done.add(pid);
        if (prefs[pid]?.muted) continue;
        for (const k of [`@dm_notif_${pid}_${userId}`, `@dm_notif_${pid}`]) {
          const m = await isMuted(k);
          if (m === null) continue;
          if (m) { const r = await save(pid, { muted: true }); if (!r.ok) allOk = false; }
          break;
        }
      }
      // keys stored under a conversation/channel id: find the partner of each muted one
      try {
        const suffix = `_${userId}`;
        const mutedChannels: string[] = [];
        for (const k of await AsyncStorage.getAllKeys()) {
          if (!k.startsWith('@dm_notif_')) continue;
          let id = k.slice('@dm_notif_'.length);
          if (id.endsWith(suffix)) id = id.slice(0, -suffix.length);
          if (!id || done.has(id) || prefs[id]?.muted) continue;
          if (await isMuted(k)) mutedChannels.push(id);
        }
        const ids = Array.from(new Set(mutedChannels));
        if (ids.length > 0) {
          const { data, error } = await (getSupabaseClient() as any)
            .from('direct_messages').select('channel_id, sender_id, receiver_id').in('channel_id', ids).limit(500);
          if (error || !Array.isArray(data)) allOk = false;
          else {
            const partnerOf = new Map<string, string>();
            for (const r of data) partnerOf.set(r.channel_id, r.sender_id === userId ? r.receiver_id : r.sender_id);
            for (const id of ids) {
              const pid = partnerOf.get(id);
              if (!pid || done.has(pid) || prefs[pid]?.muted) continue;
              done.add(pid);
              const r = await save(pid, { muted: true });
              if (!r.ok) allOk = false;
            }
          }
        }
      } catch { allOk = false; }
      // legacy keys stay (mobilePush reads them); only mark done if nothing failed
      if (allOk) await AsyncStorage.setItem(flag, '1');
    } catch { /* try again next time */ }
  }, [userId, prefs, save]);

  return { prefs, setMuted, toggleMute, togglePin, migrateLegacyMutes };
}
