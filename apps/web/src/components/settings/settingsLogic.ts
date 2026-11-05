/** Pure helpers for settings pages (kept free of React so they can be unit tested). */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (v: string | null | undefined): boolean => !!v && HHMM.test(v);

/** Returns an error message when the quiet-hours window cannot be saved, otherwise null. */
export const validateQuietHours = (start: string | null | undefined, end: string | null | undefined): string | null => {
  if (!isValidTime(start) || !isValidTime(end)) return 'Enter both a start and an end time.';
  if (start === end) return 'Start and end time cannot be the same.';
  return null;
};

/** Password rules used by the change-password dialog. Returns an error message or null. */
export const validateNewPassword = (next: string, confirm: string): string | null => {
  if (next.length < 8) return 'Password must be at least 8 characters long.';
  if (next !== confirm) return 'Passwords do not match.';
  return null;
};

/** Screenshots allowed on a support request. */
export const MAX_SCREENSHOTS = 3;

/** Splits newly picked files into those that fit under the cap and those dropped. */
export const takeScreenshots = <T,>(existing: T[], picked: T[], max = MAX_SCREENSHOTS): { next: T[]; dropped: number } => {
  const room = Math.max(0, max - existing.length);
  const accepted = picked.slice(0, room);
  return { next: [...existing, ...accepted], dropped: picked.length - accepted.length };
};

/** "1 star" / "3 stars". */
export const starLabel = (n: number): string => `${n} ${n === 1 ? 'star' : 'stars'}`;

/** Wording for the account-standing page when the ban is temporary or permanent. */
export const suspensionHeadline = (banType: string | null | undefined, expiresAt: string | null | undefined, fmt: (iso: string) => string): string =>
  banType === 'temporary' && expiresAt ? `Suspended until ${fmt(expiresAt)}` : 'Suspended';
