/**
 * A link that is safe to put in an <a href> or window.open for links that other people can store
 * (documents, previews, attachments). Only web links (http/https), same-app paths ("/profile/…") and
 * blob: object URLs made by the browser itself pass; javascript:, data:, vbscript: and anything else is refused.
 * Returns undefined when the link is not safe, so an <a href={safeHref(x)}> simply becomes inert.
 */
export function safeHref(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  // Browsers silently drop tab, CR and LF inside a URL, so "/<TAB>/evil.com" would become "//evil.com". Strip them first.
  const value = raw.replace(/[\t\r\n]/g, '').trim();
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'blob:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
