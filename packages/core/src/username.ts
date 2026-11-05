/** Username rules shared by web and mobile (mirrors the database guard in part AG). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export const USERNAME_RESERVED = [
  'admin', 'administrator', 'support', 'help', 'cinecraft', 'cinecraftconnect', 'official', 'moderator', 'mod',
  'staff', 'team', 'security', 'system', 'root', 'null', 'undefined', 'api', 'www', 'me', 'profile', 'settings',
];

/** Lower-case and keep only letters, digits and underscores, so people cannot type an invalid name at all. */
export const sanitizeUsername = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);

export type UsernameIssue = 'empty' | 'too_short' | 'reserved' | null;

/** Problems we can tell without asking the server. */
export const usernameIssue = (value: string): UsernameIssue => {
  if (!value) return 'empty';
  if (value.length < USERNAME_MIN) return 'too_short';
  if (USERNAME_RESERVED.includes(value)) return 'reserved';
  return null;
};

export type UsernameStatus = 'idle' | 'too_short' | 'reserved' | 'checking' | 'available' | 'taken' | 'error';

export const USERNAME_STATUS_TEXT: Record<UsernameStatus, string> = {
  idle: `${USERNAME_MIN}-${USERNAME_MAX} characters: lowercase letters, numbers or underscores`,
  too_short: `Use at least ${USERNAME_MIN} characters`,
  reserved: 'That username is reserved. Please choose another',
  checking: 'Checking…',
  available: 'Available',
  taken: 'Already taken. Try another',
  error: "Couldn't check right now. Check your connection",
};
