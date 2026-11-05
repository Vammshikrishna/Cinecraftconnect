import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_ROOM_PREFS,
  RoomPrefs,
  StampedPrefs,
  mergeRoomPrefs,
  parseLocalPrefs,
  sanitizeRoomPrefs,
  serializeLocalPrefs,
  toEpochMs,
} from '@/lib/roomPrefsMerge';

const CHANGE_EVENT = 'room-prefs-changed';

/** Same key the app has always used, so GlobalNotificationListener keeps working. */
export const roomPrefsLocalKey = (roomId: string, userId: string | undefined | null) =>
  `room_notif_${roomId}_${userId || 'anonymous'}`;

function readLocal(roomId: string, userId: string): StampedPrefs | null {
  try {
    return parseLocalPrefs(localStorage.getItem(roomPrefsLocalKey(roomId, userId)));
  } catch {
    return null;
  }
}

function writeLocal(roomId: string, userId: string, v: StampedPrefs) {
  try {
    localStorage.setItem(roomPrefsLocalKey(roomId, userId), serializeLocalPrefs(v));
  } catch {
    /* storage unavailable: ignore */
  }
}

function notify(roomId: string, userId: string) {
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { roomId, userId } }));
  } catch {
    /* ignore */
  }
}

async function fetchRemote(roomId: string, userId: string): Promise<StampedPrefs | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('user_room_prefs')
      .select('prefs, updated_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null; // table missing, offline or no row: keep local
    return { prefs: sanitizeRoomPrefs(data.prefs), updatedAt: toEpochMs(data.updated_at) };
  } catch {
    return null;
  }
}

/** Upsert to the server. Returns the server timestamp or null on any failure (never throws). */
async function pushRemote(roomId: string, userId: string, prefs: RoomPrefs): Promise<number | null> {
  try {
    const { data, error } = await (supabase as any)
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

/**
 * Load prefs for a room: merge server row with the local cache (newest wins),
 * refresh the cache, and push the local copy up when it is newer. Never throws.
 */
export async function loadRoomPrefs(roomId: string, userId: string | undefined | null): Promise<RoomPrefs> {
  if (!userId) {
    return readLocal(roomId, 'anonymous')?.prefs ?? { ...DEFAULT_ROOM_PREFS };
  }
  const local = readLocal(roomId, userId);
  const remote = await fetchRemote(roomId, userId);
  const merged = mergeRoomPrefs(local, remote);
  if (merged.source === 'remote') {
    writeLocal(roomId, userId, merged);
    if (!local || local.prefs.muteRoom !== merged.prefs.muteRoom ||
        local.prefs.mentionsOnly !== merged.prefs.mentionsOnly ||
        local.prefs.soundAlerts !== merged.prefs.soundAlerts) {
      notify(roomId, userId);
    }
  } else if (merged.source === 'local' && merged.needsPush) {
    const ts = await pushRemote(roomId, userId, merged.prefs);
    if (ts) writeLocal(roomId, userId, { prefs: merged.prefs, updatedAt: ts });
  }
  return merged.prefs;
}

/** Save prefs: cache locally right away, then write through. Server failure is silent (retried on next change/open). */
export async function saveRoomPrefs(roomId: string, userId: string | undefined | null, next: RoomPrefs): Promise<void> {
  const prefs = sanitizeRoomPrefs(next);
  if (!userId) {
    writeLocal(roomId, 'anonymous', { prefs, updatedAt: Date.now() });
    return;
  }
  writeLocal(roomId, userId, { prefs, updatedAt: Date.now() });
  notify(roomId, userId);
  const ts = await pushRemote(roomId, userId, prefs);
  if (ts) writeLocal(roomId, userId, { prefs, updatedAt: ts });
}

export function useRoomPrefs(roomId: string | undefined, userId: string | undefined | null) {
  const [prefs, setPrefsState] = useState<RoomPrefs>(() =>
    (roomId && readLocal(roomId, userId || 'anonymous')?.prefs) || { ...DEFAULT_ROOM_PREFS },
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setPrefsState(readLocal(roomId, userId || 'anonymous')?.prefs ?? { ...DEFAULT_ROOM_PREFS });
    loadRoomPrefs(roomId, userId).then((p) => { if (!cancelled) setPrefsState(p); });
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.roomId === roomId && d?.userId === (userId || 'anonymous')) {
        const l = readLocal(roomId, userId || 'anonymous');
        if (l) setPrefsState(l.prefs);
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(CHANGE_EVENT, onChange); };
  }, [roomId, userId]);

  const setPrefs = useCallback((patch: Partial<RoomPrefs>) => {
    if (!roomId) return;
    const next = sanitizeRoomPrefs({ ...prefsRef.current, ...patch });
    setPrefsState(next);
    void saveRoomPrefs(roomId, userId, next);
  }, [roomId, userId]);

  return { prefs, setPrefs };
}
