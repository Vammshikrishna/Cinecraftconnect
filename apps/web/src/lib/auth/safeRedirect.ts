import { safeHref } from '@/lib/safeUrl';

/**
 * Returns the given post-login target only when it is a plain same-app path ("/jobs", "/profile/abc?tab=x"),
 * otherwise null so the caller falls back to its default landing page.
 * Rejects: absolute / protocol-relative URLs, backslashes, control characters, and the auth pages themselves
 * (which would loop).
 */
export function safeRedirectPath(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  const safe = safeHref(value);
  if (!safe || !safe.startsWith('/') || safe.startsWith('//')) return null;
  const pathOnly = safe.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  if (pathOnly === '/auth' || pathOnly === '/register') return null;
  return safe;
}
