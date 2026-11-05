/** Pure login-lockout maths (no react-native imports) so the counter can persist across screen visits. */
export interface LockoutState {
  attempts: number;
  /** epoch ms until which sign-in is blocked (0 = not locked) */
  lockedUntil: number;
  /** epoch ms of the last failed attempt */
  lastFailAt: number;
}

export const EMPTY_LOCKOUT: LockoutState = { attempts: 0, lockedUntil: 0, lastFailAt: 0 };
/** Failures older than this are forgotten. */
export const LOCKOUT_FORGET_MS = 60 * 60 * 1000;

export const lockoutDelaySeconds = (attempts: number): number => (attempts >= 3 ? Math.min(15 * Math.pow(2, attempts - 3), 15 * 60) : 0);

/** Record a failed attempt at time `now`. */
export const registerFailure = (state: LockoutState, now: number): LockoutState => {
  const base = now - state.lastFailAt > LOCKOUT_FORGET_MS ? EMPTY_LOCKOUT : state;
  const attempts = base.attempts + 1;
  const delay = lockoutDelaySeconds(attempts);
  return { attempts, lastFailAt: now, lockedUntil: delay ? now + delay * 1000 : 0 };
};

/** Whole seconds still locked at `now` (0 when free). */
export const remainingSeconds = (state: LockoutState, now: number): number =>
  state.lockedUntil > now ? Math.ceil((state.lockedUntil - now) / 1000) : 0;

/** Parse a stored value defensively. */
export const parseLockout = (raw: string | null | undefined): LockoutState => {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v && Number.isFinite(v.attempts) && Number.isFinite(v.lockedUntil) && Number.isFinite(v.lastFailAt)) {
      return { attempts: v.attempts, lockedUntil: v.lockedUntil, lastFailAt: v.lastFailAt };
    }
  } catch { /* ignore */ }
  return EMPTY_LOCKOUT;
};
