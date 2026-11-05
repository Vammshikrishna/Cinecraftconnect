import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Tiny module-level store that decides which feed video plays.
 * - lists publish the ids of the posts that are at least ~60% visible (in on-screen order)
 * - posts with a video register themselves
 * - the first visible post that has a video is "active"; only that one plays
 * - the mute choice is remembered for the session (once the user unmutes, the next videos start unmuted)
 */
interface State {
  visibleIds: string[];
  videoIds: ReadonlySet<string>;
  forcedId: string | null;
  muted: boolean;
  wifi: boolean;
  activeId: string | null;
}

let state: State = {
  visibleIds: [],
  videoIds: new Set<string>(),
  forcedId: null,
  muted: true,
  wifi: true,
  activeId: null,
};
const listeners = new Set<() => void>();

const computeActive = (s: Omit<State, 'activeId'>): string | null => {
  if (s.forcedId) return s.forcedId;
  return s.visibleIds.find((id) => s.videoIds.has(id)) ?? null;
};

const set = (patch: Partial<Omit<State, 'activeId'>>) => {
  const next = { ...state, ...patch };
  next.activeId = computeActive(next);
  const changed = (Object.keys(next) as (keyof State)[]).some((k) => next[k] !== state[k]);
  if (!changed) return;
  state = next;
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getState = () => state;

let netStarted = false;
const startNet = () => {
  if (netStarted) return;
  netStarted = true;
  try {
    NetInfo.addEventListener((n) => {
      set({ wifi: n.type === 'wifi' || n.type === 'ethernet' || n.type === 'unknown' || n.type === 'other' });
    });
  } catch {
    /* keep the default */
  }
};

export const videoPlayback = {
  /** called by a list with the ids of the posts that are currently visible, in on-screen order */
  setVisibleIds(ids: string[]) {
    const prev = state.visibleIds;
    if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) return;
    set({ visibleIds: ids, forcedId: state.forcedId && ids.includes(state.forcedId) ? state.forcedId : null });
  },
  registerVideoPost(id: string) {
    startNet();
    if (state.videoIds.has(id)) return;
    const next = new Set(state.videoIds);
    next.add(id);
    set({ videoIds: next });
  },
  unregisterVideoPost(id: string) {
    if (!state.videoIds.has(id)) return;
    const next = new Set(state.videoIds);
    next.delete(id);
    set({ videoIds: next });
  },
  /** the user tapped play on a card that was not autoplaying */
  forcePlay(id: string) {
    set({ forcedId: id });
  },
  setMuted(muted: boolean) {
    set({ muted });
  },
};

export function useVideoPlayback() {
  return useSyncExternalStore(subscribe, getState, getState);
}

/**
 * Subscribe to one primitive slice of the store. The component re-renders only when that slice changes
 * (e.g. `useVideoPlaybackSelector(s => s.activeId === id)` re-renders just the card that gains/loses playback).
 */
export function useVideoPlaybackSelector<T extends string | number | boolean | null>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}
