/**
 * Small pure helpers shared by the staff consoles (kept free of React and Supabase so they can be unit tested).
 */

/** A name to show for a profile that may be missing (deleted user, automatic report with no reporter). */
export const safeUsername = (p?: { username?: string | null } | null, fallback = 'unknown'): string =>
  (p && typeof p.username === 'string' && p.username.trim()) || fallback;

/** Two letters for an avatar fallback; never throws on a missing profile. */
export const safeInitials = (p?: { username?: string | null } | null, fallback = '??'): string => {
  const name = p && typeof p.username === 'string' ? p.username.trim() : '';
  return name ? name.slice(0, 2).toUpperCase() : fallback;
};

/** A stored trust score of 0 is a real value; only a missing score falls back to the default. */
export const trustScoreOr = (score: number | null | undefined, fallback = 100): number =>
  typeof score === 'number' && Number.isFinite(score) ? score : fallback;

/** Spreadsheet programs run cells that start with = + - @ tab or CR as formulas. A leading single quote makes them text. */
export const neutraliseCsvCell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

/** One CSV field: formula-neutralised, then always quoted with inner quotes doubled. */
export const csvField = (value: unknown): string => `"${neutraliseCsvCell(value).replace(/"/g, '""')}"`;

export const csvRow = (values: unknown[]): string => values.map(csvField).join(',');

/** Escape the LIKE wildcards and the escape character itself so a name is matched literally by ilike. */
export const escapeIlike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The maker of a queued item can neither approve nor reject it (the database enforces the same rule). */
export const canDecideApproval = (makerId: string | null | undefined, userId: string | null | undefined): boolean =>
  !!userId && !!makerId && makerId !== userId;

export type UrlCheck = { ok: true; value: string | null } | { ok: false; error: string };

/** Action link for a broadcast: empty, a same-app path ("/x", not "//host"), or an https URL. */
export const validateActionUrl = (raw: string): UrlCheck => {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s\\]/.test(v)) return { ok: false, error: 'The link must not contain spaces or control characters.' };
  if (v.startsWith('/')) {
    if (v.startsWith('//')) return { ok: false, error: 'Use a path inside the app (like /feed) or a full https link.' };
    return { ok: true, value: v };
  }
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return { ok: false, error: 'Only https links are allowed.' };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'Use a path inside the app (like /feed) or a full https link.' };
  }
};

/** Image link for a broadcast: empty or https only. */
export const validateImageUrl = (raw: string): UrlCheck => {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return { ok: false, error: 'The image link must start with https://.' };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'The image link is not a valid https link.' };
  }
};

/** "in_progress" -> "in progress" for toasts and labels. */
export const humanStatus = (s: string): string => s.replace(/_/g, ' ');

const INVITE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Random part of an invite code from a cryptographic source (rejection sampling, no modulo bias).
 * Fallback only: the preferred path is the server function staff_create_vip_invite.
 */
export const randomInviteCode = (
  length = 12,
  fill: (a: Uint8Array) => Uint8Array = (a) => crypto.getRandomValues(a),
): string => {
  const limit = 256 - (256 % INVITE_CHARS.length);
  let out = '';
  while (out.length < length) {
    const buf = fill(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out += INVITE_CHARS[b % INVITE_CHARS.length];
    }
  }
  return `VIP-${out}`;
};

/** Longest allowed broadcast text. */
export const BROADCAST_TITLE_MAX = 100;
export const BROADCAST_BODY_MAX = 500;
