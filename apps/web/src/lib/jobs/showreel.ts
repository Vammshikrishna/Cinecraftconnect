/**
 * Turns a pasted showreel link into something safe to embed. Pasting a normal YouTube or Vimeo page URL into an
 * <iframe> is refused by those sites (X-Frame-Options), which is why the old preview was blank. Only providers we
 * know are embedded; anything else is shown as a normal "open link" so we never frame arbitrary websites.
 */
export function toEmbedUrl(raw?: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.searchParams.get('v') || (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : null);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

/** A link that is safe to open in a new tab (http/https only). */
export function safeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
