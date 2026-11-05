/**
 * Feed helpers shared by web and mobile: "not interested", mute, impressions and post insights.
 * The database does the real work (supabase/manual/part_az_feed_features.sql). See docs/FEED.md.
 */

export const FEED_TABS = ['For You', 'Following'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/** Craft chips and the word the database matches against a person's craft. */
export const FEED_CRAFTS: { label: string; keyword: string }[] = [
  { label: 'Directing', keyword: 'director' },
  { label: 'Cinematography', keyword: 'cinematographer' },
  { label: 'Screenwriting', keyword: 'screenwriter' },
  { label: 'Acting', keyword: 'actor' },
  { label: 'VFX', keyword: 'vfx' },
];

export function postLink(postId: string, origin = 'https://cinecraftconnect.com'): string {
  return `${origin.replace(/\/$/, '')}/post/${postId}`;
}

/** "Not interested": this post never comes back in my feed. */
export async function hidePost(client: any, me: string, postId: string): Promise<void> {
  const { error } = await client.from('hidden_posts').upsert({ user_id: me, post_id: postId }, { onConflict: 'user_id,post_id' });
  if (error) throw error;
}
export async function unhidePost(client: any, me: string, postId: string): Promise<void> {
  const { error } = await client.from('hidden_posts').delete().eq('user_id', me).eq('post_id', postId);
  if (error) throw error;
}

/** Mute: their posts leave my feed. They can still see mine, and nothing is shown to them. */
export async function muteAuthor(client: any, me: string, authorId: string): Promise<void> {
  const { error } = await client.from('muted_authors').upsert({ user_id: me, author_id: authorId }, { onConflict: 'user_id,author_id' });
  if (error) throw error;
}
export async function unmuteAuthor(client: any, me: string, authorId: string): Promise<void> {
  const { error } = await client.from('muted_authors').delete().eq('user_id', me).eq('author_id', authorId);
  if (error) throw error;
}

export interface MutedAuthor { author_id: string; created_at: string; profile: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null }
export async function fetchMutedAuthors(client: any, me: string): Promise<MutedAuthor[]> {
  const { data, error } = await client
    .from('muted_authors')
    .select('author_id, created_at, profile:author_id(id, username, full_name, avatar_url)')
    .eq('user_id', me)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as MutedAuthor[];
}

export async function unfollowAuthor(client: any, me: string, authorId: string): Promise<void> {
  const { error } = await client.from('user_follows').delete().eq('follower_id', me).eq('following_id', authorId);
  if (error) throw error;
}

export interface PostInsights { people_reached: number; views: number; likes: number; comments: number; shares: number; saves: number }
export async function fetchPostInsights(client: any, postId: string): Promise<PostInsights | null> {
  const { data, error } = await client.rpc('get_post_insights', { p_post: postId });
  if (error) throw error;
  return (data as PostInsights | null) ?? null;
}

export interface ImpressionLogger { see: (postId: string) => void; flush: () => Promise<void>; stop: () => void }

/**
 * Collects the posts a person has really looked at and sends them in small batches.
 * Each post is counted once per session; a failed batch is dropped (this is only a ranking signal).
 */
export function createImpressionLogger(client: any, opts: { flushMs?: number; maxBatch?: number } = {}): ImpressionLogger {
  const flushMs = opts.flushMs ?? 5000;
  const maxBatch = Math.min(opts.maxBatch ?? 40, 50);
  const sent = new Set<string>();
  let queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (queue.length === 0) return;
    const batch = queue.slice(0, maxBatch);
    queue = queue.slice(maxBatch);
    try { await client.rpc('log_post_impressions', { p_post_ids: batch }); } catch { /* a ranking signal only */ }
    if (queue.length > 0) timer = setTimeout(flush, flushMs);
  };

  return {
    see: (postId: string) => {
      if (!postId || sent.has(postId)) return;
      sent.add(postId);
      queue.push(postId);
      if (queue.length >= maxBatch) { void flush(); return; }
      if (!timer) timer = setTimeout(flush, flushMs);
    },
    flush,
    stop: () => { if (timer) { clearTimeout(timer); timer = null; } },
  };
}

// ── part BA (supabase/manual/part_ba_feed_personalization.sql) ────────────────────────────────────────────────────

/** Why a post is in the feed (the database sends this with every post). */
export function feedReasonText(reason?: string | null): string {
  return reason && reason.trim() ? reason : 'Suggested for you';
}

// muted words (a word, a phrase, or a hashtag): posts that contain them never show
export const MUTED_WORD_MAX = 40;
export function cleanMutedWord(input: string): string | null {
  const w = input.trim().toLowerCase().replace(/^#+/, '');
  return w.length >= 2 && w.length <= MUTED_WORD_MAX ? w : null;
}
export async function fetchMutedWords(client: any, me: string): Promise<string[]> {
  const { data, error } = await client.from('muted_words').select('word').eq('user_id', me).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => r.word as string);
}
export async function addMutedWord(client: any, me: string, input: string): Promise<string> {
  const word = cleanMutedWord(input);
  if (!word) throw new Error(`Use 2 to ${MUTED_WORD_MAX} characters.`);
  const { error } = await client.from('muted_words').upsert({ user_id: me, word }, { onConflict: 'user_id,word' });
  if (error) throw error;
  return word;
}
export async function removeMutedWord(client: any, me: string, word: string): Promise<void> {
  const { error } = await client.from('muted_words').delete().eq('user_id', me).eq('word', word);
  if (error) throw error;
}

export interface HiddenPost { post_id: string; created_at: string; post: { id: string; content: string | null; author: { full_name: string | null; username: string | null } | null } | null }
/** Posts I marked "not interested", newest first, so they can be brought back. */
export async function fetchHiddenPosts(client: any, me: string, limit = 50): Promise<HiddenPost[]> {
  const { data, error } = await client
    .from('hidden_posts')
    .select('post_id, created_at, post:post_id(id, content, author:author_id(full_name, username))')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as HiddenPost[];
}

// ── widgets: what is really active, and one layout for both apps ────────────────────────────────────────────────

export type TrendingKind = 'rooms' | 'projects' | 'vendors' | 'marketplace';
/** Ids ranked by recent activity, or an empty list when the database part has not been run yet. */
export async function fetchTrendingIds(client: any, kind: TrendingKind, limit = 10): Promise<string[]> {
  try {
    const { data, error } = await client.rpc('get_trending_ids', { p_kind: kind, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data as string[];
  } catch { return []; }
}
/** Puts rows in the order of the ids (rows that are not in the list keep their place at the end). */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  if (ids.length === 0) return rows;
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
}

export const FEED_WIDGETS = [
  { id: 'announcements', label: 'Announcements' },
  { id: 'people', label: 'People to connect with' },
  { id: 'projects', label: 'Trending projects' },
  { id: 'rooms', label: 'Active discussions' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'ratings', label: 'Ratings and releases' },
] as const;
export type FeedWidgetId = (typeof FEED_WIDGETS)[number]['id'];

/** OLD rule (3rd post, then every 5th). No longer used by the feeds: see buildFeedLayout in feedLayout.ts (a widget after every 3 posts). */
export const FEED_WIDGET_FIRST_INDEX = 3;
export const FEED_WIDGET_EVERY = 5;
export function widgetSlotForPost(postIndex: number): number {
  if (postIndex >= FEED_WIDGET_FIRST_INDEX && (postIndex - FEED_WIDGET_FIRST_INDEX) % FEED_WIDGET_EVERY === 0) {
    return Math.floor((postIndex - FEED_WIDGET_FIRST_INDEX) / FEED_WIDGET_EVERY);
  }
  return -1;
}

/** The sections I turned off. */
export function toggleHiddenSection(hidden: string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

/** The same widget can come round again: each pass shows the next few items. */
export function rotateItems<T>(items: T[], pass: number, pageSize: number): T[] {
  if (items.length === 0) return [];
  const start = (pass * pageSize) % items.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(pageSize, items.length); i++) out.push(items[(start + i) % items.length]);
  return out;
}

/** Index of the first post I had already seen before this session, once there were new ones above it. */
export function caughtUpIndex(posts: { was_seen?: boolean | null }[]): number {
  const first = posts.findIndex((p) => p.was_seen);
  return first > 0 ? first : -1;
}

/** Keeps the first row for each id (pages of an infinite feed can overlap when new posts arrive). Rows without an id are kept. */
export function dedupeById<T extends { id?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = row?.id;
    if (id == null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
