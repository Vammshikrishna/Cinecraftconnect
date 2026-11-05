/** Pure helpers for the content detail / category routes (kept separate so they can be unit tested). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContentType = 'movie' | 'tv';

export interface ParsedContentParams {
  type: ContentType;
  /** TMDB numeric id (movie/tv) or a platform_cinema uuid string. */
  id: string;
  isNative: boolean;
}

/** Validate the :type and :id route params. Returns null when either is not acceptable. */
export function parseContentParams(type: string | undefined, id: string | undefined): ParsedContentParams | null {
  if (type !== 'movie' && type !== 'tv') return null;
  if (!id) return null;
  if (UUID_RE.test(id)) return { type, id, isNative: true };
  if (/^[1-9]\d{0,9}$/.test(id)) return { type, id, isNative: false };
  return null;
}

/** Accessible label for one star button, e.g. "Rate 3 out of 5". */
export function starLabel(n: number, max = 5): string {
  return `Rate ${n} out of ${max}`;
}

/** Whether a category key is one of the known keys (guards against prototype keys like "constructor"). */
export function isKnownCategory(map: Record<string, unknown>, key: string | undefined): key is string {
  return !!key && Object.prototype.hasOwnProperty.call(map, key);
}
