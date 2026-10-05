/**
 * Turns user-written link text into something safe to open: an http(s) link as is, a plain domain with https:// added.
 * Anything else (tel:, sms:, intent:, javascript: ...) returns null so it is never opened.
 */
export const toSafeUrl = (input?: string | null): string | null => {
  const v = (input || '').trim();
  if (!v || v.length > 300) return null;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s]*)?$/i.test(v)) return `https://${v}`;
  return null;
};
