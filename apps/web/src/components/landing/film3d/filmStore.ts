import { useSyncExternalStore } from 'react';

/* A tiny shared store between the 3D background (which knows where the camera is) and the journey panel (which says what you are
   looking at). The canvas writes, the panel reads. */
export type FilmStage = 'intro' | 'craft' | 'outro';
interface FilmState { active: number; stage: FilmStage; ready: boolean; role: string | null }

let state: FilmState = { active: -1, stage: 'intro', ready: false, role: null };
const listeners = new Set<() => void>();

export const setFilmState = (next: Partial<FilmState>) => {
  const merged = { ...state, ...next };
  if (merged.active === state.active && merged.stage === state.stage && merged.ready === state.ready && merged.role === state.role) return;
  state = merged;
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useFilmState = (): FilmState => useSyncExternalStore(subscribe, () => state, () => state);

/** Can this browser draw WebGL at all? Checked once, so the page can reserve the journey's space from the first paint. */
export const canDrawWebGL = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
};
