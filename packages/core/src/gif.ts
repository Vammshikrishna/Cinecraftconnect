/**
 * GIF search for the post composer. Goes through the `gif-search` edge function, which holds the provider key
 * (GIPHY_API_KEY). Without the function or the key the apps hide the GIF button's results with a clear message.
 * Providers ask for the "Powered by GIPHY" credit to be shown in the picker.
 */

export interface GifItem {
  id: string;
  title: string;
  /** the animated GIF added to the post */
  url: string;
  /** a small version for the picker grid */
  preview: string;
  width: number;
  height: number;
}

export const GIF_CREDIT = 'Powered by GIPHY';

export type GifResult = { ok: true; items: GifItem[] } | { ok: false; reason: 'not_configured' | 'failed'; message: string };

export const searchGifs = async (client: any, query: string, limit = 24): Promise<GifResult> => {
  try {
    const { data, error } = await client.functions.invoke('gif-search', { body: { q: query.trim(), limit } });
    if (error) {
      const status = (error as any)?.context?.status;
      if (status === 501 || status === 404) return { ok: false, reason: 'not_configured', message: 'GIFs are not set up yet.' };
      return { ok: false, reason: 'failed', message: 'Could not load GIFs. Try again.' };
    }
    if ((data as any)?.error === 'not_configured') return { ok: false, reason: 'not_configured', message: 'GIFs are not set up yet.' };
    const items: GifItem[] = (Array.isArray((data as any)?.items) ? (data as any).items : [])
      .filter((g: any) => typeof g?.url === 'string' && g.url.startsWith('https://') && typeof g?.preview === 'string' && g.preview.startsWith('https://'))
      .map((g: any) => ({ id: String(g.id), title: String(g.title || 'GIF').slice(0, 120), url: g.url, preview: g.preview, width: Number(g.width) || 0, height: Number(g.height) || 0 }));
    return { ok: true, items };
  } catch {
    return { ok: false, reason: 'failed', message: 'Could not load GIFs. Try again.' };
  }
};
