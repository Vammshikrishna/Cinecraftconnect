/**
 * COPY of apps/web/src/lib/roomPrefsMerge.ts (keep identical).
 * Pure merge logic for per-user discussion-room notification prefs.
 * No imports, so the mobile service (apps/mobile/src/services/roomPrefs.ts)
 * carries an identical copy. Keep the two in sync.
 */

export interface RoomPrefs {
  muteRoom: boolean;
  mentionsOnly: boolean;
  soundAlerts: boolean;
}

export const ROOM_PREF_KEYS = ['muteRoom', 'mentionsOnly', 'soundAlerts'] as const;

export const DEFAULT_ROOM_PREFS: RoomPrefs = {
  muteRoom: false,
  mentionsOnly: false,
  soundAlerts: true,
};

export interface StampedPrefs {
  prefs: RoomPrefs;
  /** epoch milliseconds; 0 means unknown (legacy local copy) */
  updatedAt: number;
}

export interface MergeResult extends StampedPrefs {
  source: 'local' | 'remote' | 'default';
  /** true when the winning value should be written to the server */
  needsPush: boolean;
}

/** Keep only the known keys, only booleans, fill the rest with defaults. */
export function sanitizeRoomPrefs(raw: unknown): RoomPrefs {
  const out: RoomPrefs = { ...DEFAULT_ROOM_PREFS };
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const k of ROOM_PREF_KEYS) {
    if (typeof src[k] === 'boolean') out[k] = src[k] as boolean;
  }
  return out;
}

/** Parse an ISO string / number / Date into epoch ms; 0 when invalid. */
export function toEpochMs(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) && t > 0 ? t : 0;
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) && t > 0 ? t : 0;
  }
  return 0;
}

/** Read the locally cached JSON (legacy shape has no updatedAt). */
export function parseLocalPrefs(raw: string | null | undefined): StampedPrefs | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    return { prefs: sanitizeRoomPrefs(obj), updatedAt: toEpochMs((obj as any).updatedAt) };
  } catch {
    return null;
  }
}

/** Serialize for the local cache (same keys the old code wrote, plus updatedAt). */
export function serializeLocalPrefs(p: StampedPrefs): string {
  return JSON.stringify({ ...sanitizeRoomPrefs(p.prefs), updatedAt: p.updatedAt });
}

/**
 * Newest write wins. Ties go to the server copy. A legacy local copy
 * (updatedAt 0) loses to any server row, but is pushed when there is none.
 */
export function mergeRoomPrefs(local: StampedPrefs | null, remote: StampedPrefs | null): MergeResult {
  if (!local && !remote) {
    return { prefs: { ...DEFAULT_ROOM_PREFS }, updatedAt: 0, source: 'default', needsPush: false };
  }
  if (!remote) {
    return { prefs: sanitizeRoomPrefs(local!.prefs), updatedAt: local!.updatedAt, source: 'local', needsPush: true };
  }
  if (!local) {
    return { prefs: sanitizeRoomPrefs(remote.prefs), updatedAt: remote.updatedAt, source: 'remote', needsPush: false };
  }
  if (local.updatedAt > remote.updatedAt) {
    return { prefs: sanitizeRoomPrefs(local.prefs), updatedAt: local.updatedAt, source: 'local', needsPush: true };
  }
  return { prefs: sanitizeRoomPrefs(remote.prefs), updatedAt: remote.updatedAt, source: 'remote', needsPush: false };
}

// ---------------------------------------------------------------------------
// Storage + server sync (mobile)
// ---------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';

const userKey = (roomId: string, userId: string) => `@room_notif_${roomId}_${userId}`;
const legacyKey = (roomId: string) => `@room_notif_${roomId}`;

async function readLocal(roomId: string, userId: string): Promise<StampedPrefs | null> {
  try {
    const raw = (await AsyncStorage.getItem(userKey(roomId, userId))) ?? (await AsyncStorage.getItem(legacyKey(roomId)));
    return parseLocalPrefs(raw);
  } catch {
    return null;
  }
}

async function writeLocal(roomId: string, userId: string, v: StampedPrefs): Promise<void> {
  try {
    const s = serializeLocalPrefs(v);
    await AsyncStorage.setItem(userKey(roomId, userId), s);
    // Older readers (push handlers) also look at the key without a user id.
    await AsyncStorage.setItem(legacyKey(roomId), s);
  } catch {
    /* ignore */
  }
}

async function fetchRemote(roomId: string, userId: string): Promise<StampedPrefs | null> {
  try {
    const { data, error } = await (getSupabaseClient() as any)
      .from('user_room_prefs')
      .select('prefs, updated_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null; // offline, table missing or no row: keep local
    return { prefs: sanitizeRoomPrefs(data.prefs), updatedAt: toEpochMs(data.updated_at) };
  } catch {
    return null;
  }
}

async function pushRemote(roomId: string, userId: string, prefs: RoomPrefs): Promise<number | null> {
  try {
    const { data, error } = await (getSupabaseClient() as any)
      .from('user_room_prefs')
      .upsert({ user_id: userId, room_id: roomId, prefs: sanitizeRoomPrefs(prefs) }, { onConflict: 'user_id,room_id' })
      .select('updated_at')
      .maybeSingle();
    if (error) return null;
    return toEpochMs(data?.updated_at) || null;
  } catch {
    return null;
  }
}

/** Merge server row and local cache (newest wins), refresh the cache, push local if newer. Never throws. */
export async function loadRoomPrefs(roomId: string, userId: string | null | undefined): Promise<RoomPrefs> {
  const uid = userId || 'anonymous';
  const local = await readLocal(roomId, uid);
  if (!userId) return local?.prefs ?? { ...DEFAULT_ROOM_PREFS };
  const remote = await fetchRemote(roomId, userId);
  const merged = mergeRoomPrefs(local, remote);
  if (merged.source === 'remote') {
    await writeLocal(roomId, userId, merged);
  } else if (merged.source === 'local' && merged.needsPush) {
    const ts = await pushRemote(roomId, userId, merged.prefs);
    if (ts) await writeLocal(roomId, userId, { prefs: merged.prefs, updatedAt: ts });
  }
  return merged.prefs;
}

/** Cache locally right away, then write through. Server failure is silent (retried on next change/open). */
export async function saveRoomPrefs(roomId: string, userId: string | null | undefined, next: RoomPrefs): Promise<void> {
  const prefs = sanitizeRoomPrefs(next);
  const uid = userId || 'anonymous';
  await writeLocal(roomId, uid, { prefs, updatedAt: Date.now() });
  if (!userId) return;
  const ts = await pushRemote(roomId, userId, prefs);
  if (ts) await writeLocal(roomId, userId, { prefs, updatedAt: ts });
}
