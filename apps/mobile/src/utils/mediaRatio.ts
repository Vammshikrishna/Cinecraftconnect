import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { videoEditingAvailable, videoInfo } from '../services/photoRender';

/**
 * Real width / height of post pictures and videos, remembered per URL (in memory and on the phone) so a card
 * is the right height on its very first paint. New posts carry the size in media_items; this is for older posts.
 * expo-video 2.0.6 has no video-size API, so a video is measured once with the phone's own metadata reader
 * (Android/iOS native module), else from its poster picture.
 */
const KEY = 'media_ratio_cache_v1';
const MAX = 400;
const mem = new Map<string, number>();
const pending = new Map<string, Promise<number | null>>();
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const hydration = (async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, number>;
      Object.keys(obj).forEach((u) => { if (!mem.has(u) && obj[u] > 0) mem.set(u, obj[u]); });
    }
  } catch { /* the cache is only a speed-up */ }
  hydrated = true;
  listeners.forEach((l) => l());
})();

const scheduleSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const keys = Array.from(mem.keys()).slice(-MAX);
      const obj: Record<string, number> = {};
      keys.forEach((k) => { obj[k] = mem.get(k)!; });
      AsyncStorage.setItem(KEY, JSON.stringify(obj)).catch(() => { });
    } catch { /* ignore */ }
  }, 1500);
};

export const rememberRatio = (url: string, ratio: number) => {
  if (!url || !(ratio > 0) || !Number.isFinite(ratio)) return;
  const r = Math.round(ratio * 10000) / 10000;
  if (mem.get(url) === r) return;
  mem.set(url, r);
  scheduleSave();
};

export const cachedRatio = (url?: string | null): number | null => (url ? mem.get(url) ?? null : null);

/** calls back once the saved cache has been read from the phone (so a card can re-check) */
export const onRatioCacheReady = (cb: () => void): (() => void) => {
  if (hydrated) { cb(); return () => { }; }
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

const imageSize = (url: string): Promise<number | null> =>
  new Promise((resolve) => {
    Image.getSize(url, (w, h) => resolve(w > 0 && h > 0 ? w / h : null), () => resolve(null));
  });

/** Measures a picture or video once. Resolves null when nothing could be read (the caller keeps its fallback). */
export const measureRatio = (url: string, kind: 'image' | 'video', poster?: string | null): Promise<number | null> => {
  const hit = cachedRatio(url);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(url);
  if (running) return running;
  const job = (async () => {
    await hydration;
    const again = cachedRatio(url);
    if (again) return again;
    let r: number | null = null;
    if (kind === 'image') {
      r = await imageSize(url);
    } else {
      if (videoEditingAvailable()) {
        try {
          const info = await videoInfo(url);
          if (info.width > 0 && info.height > 0) r = info.width / info.height;
        } catch { /* fall through to the poster */ }
      }
      if (!r && poster) r = await imageSize(poster);
    }
    if (r) rememberRatio(url, r);
    return r;
  })().finally(() => { pending.delete(url); });
  pending.set(url, job);
  return job;
};
