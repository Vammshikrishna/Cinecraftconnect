import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';
import { isNetworkConnectedSync, onNetworkReconnected } from './offlineCache';

/** Jobs saved while offline; posted again when the connection returns. Everything here fails soft. */
export interface QueuedJob {
  qid: string;
  mode: 'insert' | 'update';
  jobId?: string;
  userId: string;
  payload: Record<string, any>;
  title: string;
  queuedAt: number;
  attempts: number;
}

const KEY = 'cc_offline_job_queue_v1';
const MAX_ATTEMPTS = 3;
const listeners = new Set<(items: QueuedJob[]) => void>();
let running = false;

export const readJobQueue = async (): Promise<QueuedJob[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const write = async (items: QueuedJob[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  listeners.forEach((l) => {
    try { l(items); } catch {}
  });
};

export const subscribeJobQueue = (cb: (items: QueuedJob[]) => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export const enqueueJob = async (item: Omit<QueuedJob, 'qid' | 'queuedAt' | 'attempts'>) => {
  const list = await readJobQueue();
  await write([...list, { ...item, qid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, queuedAt: Date.now(), attempts: 0 }]);
};

export const cancelQueuedJob = async (qid: string) => {
  const list = await readJobQueue();
  await write(list.filter((q) => q.qid !== qid));
};

export const isNetworkError = (e: any) => {
  const m = String(e?.message || e || '').toLowerCase();
  return m.includes('network request failed') || m.includes('failed to fetch') || m.includes('network error') || m.includes('timed out');
};

/** Try to post everything waiting. Safe to call at any time; only one run at once. */
export const flushJobQueue = async (onPosted?: () => void) => {
  if (running || !isNetworkConnectedSync()) return;
  running = true;
  try {
    const sb = getSupabaseClient() as any;
    const { data: { session } } = await sb.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    let list = await readJobQueue();
    let posted = false;
    for (const q of list.filter((x) => x.userId === uid)) {
      try {
        const res = q.mode === 'update' && q.jobId
          ? await sb.from('jobs').update(q.payload).eq('id', q.jobId)
          : await sb.from('jobs').insert({ ...q.payload, posted_by: uid });
        if (res.error) throw res.error;
        list = list.filter((x) => x.qid !== q.qid);
        posted = true;
      } catch (e) {
        if (isNetworkError(e)) break;
        // a rejected posting is retried a couple of times, then dropped so it cannot loop forever
        list = q.attempts + 1 >= MAX_ATTEMPTS
          ? list.filter((x) => x.qid !== q.qid)
          : list.map((x) => (x.qid === q.qid ? { ...x, attempts: x.attempts + 1 } : x));
      }
    }
    await write(list);
    if (posted) onPosted?.();
  } catch {
    // fail soft
  } finally {
    running = false;
  }
};

try {
  onNetworkReconnected(() => { flushJobQueue(); });
} catch {}
