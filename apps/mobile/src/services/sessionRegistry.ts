import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { isTabletDevice } from '../utils/pageType';

/* Records this phone in `user_sessions`, the table behind "Where you are logged in" (web and app), so it can be listed and logged out
   remotely. One row per device: the refresh token rotates all the time, so the row is updated in place instead of adding a new one.
   Only a hash of the token is stored. The device id uses a key that sign-out does not wipe, so the same phone keeps one identity. */

const DEVICE_ID_KEY = 'cinecraft.device.identity';
let cachedDeviceId: string | null = null;

const uuid = (): string => {
  const g = globalThis as any;
  if (g.nativeCrypto?.randomUUID) return g.nativeCrypto.randomUUID();
  const b = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return b.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (saved) return (cachedDeviceId = saved);
  } catch { /* fall through and make one */ }
  const id = `app_${uuid()}`;
  cachedDeviceId = id;
  AsyncStorage.setItem(DEVICE_ID_KEY, id).catch(() => {});
  return id;
};

export const getDeviceName = (): string => {
  const c: any = (Platform as any).constants || {};
  const model = [c.Brand, c.Model].filter(Boolean).join(' ').trim();
  const kind = isTabletDevice ? 'tablet' : 'phone';
  return model ? `${model} (${Platform.OS} ${kind})` : `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} ${kind}`;
};

const sha256 = (text: string): string => {
  const crypto = (globalThis as any).nativeCrypto;
  return crypto.createHash('sha256').update(text).digest('hex');
};

const authSessionId = (accessToken?: string | null): string | null => {
  try {
    const part = (accessToken || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const id = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))?.session_id;
    return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
};

let inFlight: Promise<void> | null = null;

/** Safe to call on every sign-in and token refresh; never throws. */
export const registerThisDevice = (session: any): Promise<void> => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      if (!session?.refresh_token || !session?.user?.id) return;
      const supabase = getSupabaseClient() as any;
      const deviceId = await getDeviceId();
      const tokenHash = sha256(session.refresh_token);
      const row: Record<string, unknown> = {
        user_id: session.user.id,
        device_id: deviceId,
        refresh_token_hash: tokenHash,
        device_name: getDeviceName(),
        platform: Platform.OS,
        app_version: 'app',
        last_active_at: new Date().toISOString(),
        is_current: true,
        trusted: true,
        suspicious: false,
        auth_session_id: authSessionId(session.access_token),
      };

      // The newest live row of this device (if any) is updated in place; older leftovers of the same device are retired
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('device_id', deviceId)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false })
        .limit(5);
      const [keep, ...extra] = (existing as { id: string }[] | null) || [];

      const write = (r: Record<string, unknown>) =>
        keep ? supabase.from('user_sessions').update(r).eq('id', keep.id) : supabase.from('user_sessions').insert(r);
      let res = await write(row);
      // The auth_session_id column only exists once part_dr_revoke_one_session.sql has been run: retry without it
      if (res.error && /auth_session_id/.test(`${res.error.message} ${res.error.details ?? ''}`)) {
        const { auth_session_id: _omit, ...legacy } = row;
        res = await write(legacy);
      }
      if (res.error) {
        console.warn('[Sessions] could not register this device:', res.error.message);
        return;
      }
      if (extra.length > 0) {
        await supabase.from('user_sessions').delete().in('id', extra.map((e) => e.id));
      }
    } catch (e) {
      console.warn('[Sessions] register failed:', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

export interface DeviceSession {
  id: string;
  device_id: string;
  device_name: string | null;
  platform: string | null;
  last_active_at: string;
  suspicious: boolean;
  is_current: boolean;
}

/** One entry per device, newest first, the device in use on top. */
export const loadDeviceSessions = async (userId: string): Promise<DeviceSession[]> => {
  const supabase = getSupabaseClient() as any;
  const myDevice = await getDeviceId();
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, device_id, device_name, platform, last_active_at, suspicious')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('last_active_at', { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  const list: DeviceSession[] = [];
  for (const s of (data as any[]) || []) {
    const key = s.device_id || s.id;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ ...s, is_current: s.device_id === myDevice });
  }
  return list.sort((a, b) => Number(b.is_current) - Number(a.is_current));
};

export const revokeDeviceSession = async (sessionId: string): Promise<void> => {
  const { error } = await (getSupabaseClient() as any).rpc('revoke_my_session', { p_session_id: sessionId });
  if (error) throw error;
};
