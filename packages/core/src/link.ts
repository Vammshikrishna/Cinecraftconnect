/**
 * Link previews under posts (web and mobile). The page is fetched by the `link-preview` edge function, never by the
 * phone or browser, so a link cannot be used to learn someone's IP address or reach private networks.
 * The database keeps only a sanitised preview and only if its link is in the caption (part AT).
 * See docs/POST_EXTRAS.md.
 */

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string | null;
  site?: string;
}

/** The first web address in a text, without trailing punctuation. */
export const firstUrl = (text: string | null | undefined): string | null => {
  const m = /\bhttps?:\/\/[^\s<>"']+/i.exec(String(text ?? ''));
  if (!m) return null;
  let url = m[0];
  // Trim trailing punctuation. A ")" is kept only when it closes a "(" inside the link, e.g. Wikipedia's Heat_(film).
  for (;;) {
    const trimmed = url.replace(/[.,;:!?\]}]+$/, '');
    if (trimmed !== url) { url = trimmed; continue; }
    if (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) { url = url.slice(0, -1); continue; }
    break;
  }
  if (url.length > 2048) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};

/** Anything that looks like it points at this machine or a private network is never previewed (the server checks again). */
export const isPreviewableUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/\.+$/, ''); // "localhost." is still localhost
    if (!/^https?:$/.test(u.protocol)) return false;
    if (u.username || u.password) return false;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    if (h.includes(':') || h.startsWith('[')) return false; // IPv6 literals
    return true;
  } catch {
    return false;
  }
};

/** Asks the edge function for a preview; null when there is nothing to show (or the function is not deployed). */
export const fetchLinkPreview = async (client: any, url: string): Promise<LinkPreview | null> => {
  if (!isPreviewableUrl(url)) return null;
  try {
    const { data, error } = await client.functions.invoke('link-preview', { body: { url } });
    if (error || !data || (data as any).error || !(data as any).title) return null;
    const d = data as any;
    return {
      url: String(d.url || url),
      title: String(d.title).slice(0, 200),
      description: d.description ? String(d.description).slice(0, 300) : undefined,
      image: typeof d.image === 'string' && d.image.startsWith('https://') ? d.image : null,
      site: d.site ? String(d.site).slice(0, 100) : undefined,
    };
  } catch {
    return null;
  }
};
