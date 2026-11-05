/** One-video-at-a-time store: a video that starts playing claims the slot and the previous owner is paused. */
type Pauser = () => void;

let current: { id: string; pause: Pauser } | null = null;

export function claimPlayback(id: string, pause: Pauser): void {
  if (current && current.id !== id) {
    const prev = current;
    current = { id, pause };
    try { prev.pause(); } catch { /* the old player is gone */ }
    return;
  }
  current = { id, pause };
}

export function releasePlayback(id: string): void {
  if (current?.id === id) current = null;
}

export function activePlaybackId(): string | null {
  return current?.id ?? null;
}

const SOUND_KEY = 'cc-video-sound';

/** Whether the person unmuted a video earlier in this session. */
export function soundPreferred(): boolean {
  try { return sessionStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}

export function rememberSound(on: boolean): void {
  try { sessionStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
