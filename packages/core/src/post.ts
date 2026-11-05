/**
 * Rules for creating a post, shared by web and mobile so a post made on either behaves the same.
 * Pure functions: no network, no storage. The database enforces the same limits (supabase/manual/part_aq_posts.sql).
 * See docs/CREATE_POST.md.
 */

export const POST_CAPTION_MAX = 2200;
export const POST_MEDIA_MAX = 10;
export const POST_VIDEO_MAX_SECONDS = 239;
export const POST_ALT_TEXT_MAX = 300;
export const POST_MAX_TAGS = 30;

/** Topic a post belongs to (separate from hashtags). "General" means no category. */
export const POST_CATEGORIES = [
  'General', 'Direction', 'Cinematography', 'Screenwriting', 'Acting', 'Editing', 'Sound Design', 'VFX & CGI',
  'Production', 'Music & Score', 'Casting', 'Equipment', 'Behind the scenes',
] as const;

export const normalizeCategory = (value: string | null | undefined): string | null => {
  const v = String(value ?? '').trim();
  if (!v || v === 'General') return null;
  return (POST_CATEGORIES as readonly string[]).includes(v) ? v : null;
};

// ── hashtags and mentions ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Hashtags in any language (letters, combining marks such as Hindi vowel signs, digits, underscore).
 * Lower-cased and unique so a search for #film finds #Film and #FILM.
 */
export const extractHashtags = (text: string | null | undefined): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(^|[^\p{L}\p{M}\p{N}_])#([\p{L}\p{M}\p{N}_]{1,50})(?![\p{L}\p{M}\p{N}_])/gu;
  let m: RegExpExecArray | null;
  const source = String(text ?? '');
  while ((m = re.exec(source)) !== null) {
    const tag = m[2].toLowerCase();
    if (/^\d+$/.test(tag)) continue; // "#1" is a number, not a tag
    if (!seen.has(tag)) { seen.add(tag); out.push(tag); }
    if (out.length >= POST_MAX_TAGS) break;
  }
  return out;
};

/** @usernames (letters, digits, underscore, 3-20), lower-cased and unique. */
export const extractMentionUsernames = (text: string | null | undefined): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,20})(?![a-zA-Z0-9_])/g;
  let m: RegExpExecArray | null;
  const source = String(text ?? '');
  while ((m = re.exec(source)) !== null) {
    const u = m[2].toLowerCase();
    if (!seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out;
};

// ── media ──────────────────────────────────────────────────────────────────────────────────────────────────────

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mpg|mpeg)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i;

const cleanPath = (v: string) => v.split('#')[0].split('?')[0];

/**
 * Is this file a video? Uses the declared type first, then the file extension (query string ignored).
 * Never guesses from the word "video" appearing somewhere in a URL.
 */
export const isVideoMedia = (urlOrName: string | null | undefined, mime?: string | null): boolean => {
  if (mime) {
    if (mime.startsWith('video/')) return true;
    if (mime.startsWith('image/')) return false;
  }
  return VIDEO_EXT.test(cleanPath(String(urlOrName ?? '')));
};

export const isImageMedia = (urlOrName: string | null | undefined, mime?: string | null): boolean => {
  if (mime) {
    if (mime === 'image/svg+xml') return false; // SVG can carry script; it is never a post photo
    if (mime.startsWith('image/')) return true;
    if (mime.startsWith('video/')) return false;
  }
  return IMAGE_EXT.test(cleanPath(String(urlOrName ?? '')));
};

export interface PostMediaItem {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  [extra: string]: any;
}

/**
 * The real shape of a picture or video, saved on its media item so every reader can reserve the right box before anything loads.
 * `width`/`height` are the shown size (camera turn already applied); `aspect_ratio` is width / height rounded to 4 decimals.
 * Returns {} when the size is not usable.
 */
export const mediaSizeFields = (width?: number | null, height?: number | null, rotation?: number | null) => {
  let w = Number(width);
  let h = Number(height);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return {} as { width?: number; height?: number; aspect_ratio?: number };
  const r = Math.abs(Number(rotation) || 0) % 360;
  if (r === 90 || r === 270) [w, h] = [h, w];
  w = Math.round(w);
  h = Math.round(h);
  return { width: w, height: h, aspect_ratio: Math.round((w / h) * 10000) / 10000 };
};

/** The saved width / height of a media item, or null when the post was made before sizes were saved. */
export const mediaItemRatio = (item: any): number | null => {
  if (!item || typeof item !== 'object') return null;
  const w = Number(item.width);
  const h = Number(item.height);
  if (w > 0 && h > 0) return w / h;
  const a = Number(item.aspect_ratio);
  return a > 0 && Number.isFinite(a) ? a : null;
};

/** Feed card shape: taller than 4:5 is cropped to 4:5, wider than 1.91:1 is cropped to 1.91:1 (like Instagram). */
export const FEED_RATIO_MIN = 0.8;
export const FEED_RATIO_MAX = 1.91;
export const clampFeedRatio = (r: number): number => Math.min(FEED_RATIO_MAX, Math.max(FEED_RATIO_MIN, r));

export interface PostMeta {
  location?: string | null;
  tagged_users?: { id: string; username?: string; full_name?: string; avatar_url?: string }[];
  comments_disabled?: boolean;
  hide_likes?: boolean;
}

/**
 * Builds the `media_items` array stored on the post.
 *  - the extra details (place, tagged people, comment/like switches) live on the FIRST item, which is where every feed reads them;
 *  - a post with no media gets a single details-only item (`type: 'meta'`, empty url) instead of a fake image, and readers skip items without a url.
 */
export const buildMediaItems = (items: PostMediaItem[], meta: PostMeta): any[] => {
  const hasMeta = !!(meta.location || (meta.tagged_users && meta.tagged_users.length) || meta.comments_disabled || meta.hide_likes);
  const real = items.filter((i) => i && i.url);
  if (real.length === 0) {
    return hasMeta ? [{ url: '', type: 'meta', ...cleanMeta(meta) }] : [];
  }
  return real.map((item, idx) => (idx === 0 ? { ...item, ...cleanMeta(meta) } : item));
};

const cleanMeta = (meta: PostMeta) => ({
  location: meta.location?.trim() || null,
  tagged_users: meta.tagged_users || [],
  comments_disabled: !!meta.comments_disabled,
  hide_likes: !!meta.hide_likes,
});

/** The post row columns that depend only on the media (kept the same on web and mobile). */
export const mediaColumns = (items: PostMediaItem[]) => {
  const real = items.filter((i) => i && i.url);
  // posts.media_url is a generated column (the first of media_urls): the database fills it in and refuses a value from us.
  return {
    media_type: real.length > 0 ? real[0].type : null,
    media_urls: real.map((i) => i.url),
  };
};

// ── validation ─────────────────────────────────────────────────────────────────────────────────────────────────

export type PostProblem = 'empty' | 'too_long' | 'too_many_media' | 'busy';

export interface PostCheck {
  ok: boolean;
  problem?: PostProblem;
  message?: string;
}

export const checkPost = (input: { caption: string; mediaCount: number; busy?: boolean; hasPoll?: boolean }): PostCheck => {
  if (input.busy) return { ok: false, problem: 'busy', message: 'Please wait for your media to finish uploading.' };
  const text = input.caption.trim();
  if (!text && input.mediaCount === 0 && !input.hasPoll) return { ok: false, problem: 'empty', message: 'Write a caption, add a photo or video, or add a poll first.' };
  if (input.caption.length > POST_CAPTION_MAX) return { ok: false, problem: 'too_long', message: `Your caption is ${input.caption.length - POST_CAPTION_MAX} characters too long (limit ${POST_CAPTION_MAX}).` };
  if (input.mediaCount > POST_MEDIA_MAX) return { ok: false, problem: 'too_many_media', message: `You can add up to ${POST_MEDIA_MAX} photos or videos.` };
  return { ok: true };
};

/** Turns a database or network error into something a person can act on. */
export const describePostError = (error: any): string => {
  const msg = String(error?.message || (typeof error === 'string' ? error : '') || '');
  if (/too many posts|posting too fast|rate/i.test(msg)) return msg.includes('Please') ? msg : 'You are posting very quickly. Please wait a little and try again.';
  if (/caption|too long/i.test(msg)) return msg;
  if (/page|admin|not allowed|permission|row-level security/i.test(msg)) return 'You do not have permission to post this way. Choose your personal profile or another page.';
  if (/network|fetch|offline|failed to fetch/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
  return msg || 'Something went wrong while posting. Please try again.';
};

// ── audience ───────────────────────────────────────────────────────────────────────────────────────────────────

export type PostAudience = 'public' | 'connections' | 'private';

export const POST_AUDIENCES: { id: PostAudience; label: string; description: string }[] = [
  { id: 'public', label: 'Everyone', description: 'Anyone on CineCraft can see this post.' },
  { id: 'connections', label: 'Connections', description: 'Only people you are connected with.' },
  { id: 'private', label: 'Only me', description: 'Only you. Good for drafts you want to keep on your profile.' },
];

export const normalizeAudience = (value: string | null | undefined): PostAudience =>
  value === 'connections' || value === 'private' ? value : 'public';
