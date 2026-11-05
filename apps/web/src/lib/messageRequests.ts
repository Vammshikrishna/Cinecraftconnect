/** Message requests (database parts GF and GM): pure helpers, so the rules can be tested without a database.
 *  The mobile app has a mirror of this file (apps/mobile/src/utils/messageRequests.ts): keep both in sync. */

/** The cap for a sender before the receiver accepts. The database trigger (part GF) uses the same number. */
export const DM_REQUEST_CAP = 3;

/** How long a deleted request stays in "Recently deleted". */
export const REQUEST_DELETED_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Words that move a request to Hidden requests. Same list as the room chat filter and as part GM (app_private.dm_content_flagged). */
export const REQUEST_PROFANITY = [
  'fuck', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'cunt', 'slut', 'whore', 'dickhead', 'prick', 'wanker', 'bollocks',
] as const;

export type RequestBucket = 'main' | 'hidden' | 'deleted' | 'expired';

export interface MessageRequestRow {
  partner_id: string;
  full_name: string | null;
  avatar_url: string | null;
  account_type: string | null;
  first_message: string | null;
  first_message_at: string | null;
  message_count: number | null;
  unread_count: number | null;
  mutual_count: number | null;
  /** old function (part GF): true for anything that is not waiting in the main list */
  hidden: boolean | null;
  /** new function (part GM) */
  username?: string | null;
  is_verified?: boolean | null;
  last_message_at?: string | null;
  bucket?: RequestBucket | null;
  deleted_at?: string | null;
}

export interface SenderRequestState {
  waiting: boolean;
  sent: number;
  cap: number;
  remaining: number;
  closed: boolean;
}

export const EMPTY_SENDER_STATE: SenderRequestState = { waiting: false, sent: 0, cap: DM_REQUEST_CAP, remaining: DM_REQUEST_CAP, closed: false };

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|me|xyz|info|ru|cn|app|link|site|top)\b)/i;
const PROFANITY_RE = new RegExp('\\b(' + REQUEST_PROFANITY.join('|') + ')(s|es|ed|ing|in|y)?\\b', 'i');

/** Mirror of the database rule (text part): a link or a word from the profanity list. Encrypted payloads and share cards are not scanned. */
export const requestTextLooksUnwanted = (text: string | null | undefined): boolean => {
  if (!text) return false;
  if (/^\s*\{/.test(text) || text.includes('__e2ee') || /^[A-Z_]+_SHARE::/.test(text)) return false;
  return URL_RE.test(text) || PROFANITY_RE.test(text);
};

/** Mirror of the database rule (sender part): no profile photo and an account younger than 24 hours. */
export const senderLooksNew = (avatarUrl: string | null | undefined, accountCreatedAt: string | null | undefined, now: number = Date.now()): boolean => {
  if ((avatarUrl || '').trim() !== '') return false;
  const t = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN;
  return Number.isFinite(t) && now - t < DAY_MS;
};

/** True when a request that was deleted at `deletedAt` is still inside the 30 day "Recently deleted" window. */
export const isWithinDeletedWindow = (deletedAt: string | null | undefined, now: number = Date.now()): boolean => {
  const t = deletedAt ? Date.parse(deletedAt) : NaN;
  return Number.isFinite(t) && now - t <= REQUEST_DELETED_WINDOW_DAYS * DAY_MS;
};

/** Which list a row belongs to. Rows from the old function (no bucket) are main when not hidden, otherwise kept out of every list ('expired'). */
export const bucketOf = (r: MessageRequestRow, now: number = Date.now()): RequestBucket => {
  if (r.bucket === 'main' || r.bucket === 'hidden' || r.bucket === 'expired') return r.bucket;
  if (r.bucket === 'deleted') return isWithinDeletedWindow(r.deleted_at ?? null, now) || !r.deleted_at ? 'deleted' : 'expired';
  return r.hidden ? 'expired' : 'main';
};

const lastTime = (r: MessageRequestRow) => Date.parse(r.last_message_at || r.first_message_at || '') || 0;

/** Splits the rows from get_message_requests_v2 (or the old get_message_requests). Every request partner is kept out of the normal chat list. */
export const splitRequests = (rows: MessageRequestRow[] | null | undefined, now: number = Date.now()) => {
  const list = Array.isArray(rows) ? rows : [];
  const main: MessageRequestRow[] = [];
  const hiddenList: MessageRequestRow[] = [];
  const deleted: MessageRequestRow[] = [];
  for (const r of list) {
    const b = bucketOf(r, now);
    if (b === 'main') main.push(r);
    else if (b === 'hidden') hiddenList.push(r);
    else if (b === 'deleted') deleted.push(r);
  }
  const byRecent = (a: MessageRequestRow, b: MessageRequestRow) => lastTime(b) - lastTime(a);
  main.sort(byRecent);
  hiddenList.sort(byRecent);
  deleted.sort((a, b) => (Date.parse(b.deleted_at || '') || 0) - (Date.parse(a.deleted_at || '') || 0));
  const requestPartnerIds = new Set(list.map((r) => r.partner_id));
  // hidden requests never count in the badge or the dot
  const pendingUnread = main.reduce((n, r) => n + (r.unread_count || 0), 0);
  return { pending: main, main, hidden: hiddenList, deleted, requestPartnerIds, pendingUnread };
};

/** The "Message requests" row at the top of the inbox: up to 3 overlapping avatars, the count text and the unread dot. */
export const requestsEntrySummary = (main: MessageRequestRow[], maxAvatars = 3) => ({
  count: main.length,
  avatars: main.slice(0, maxAvatars).map((r) => ({ id: r.partner_id, url: r.avatar_url, name: r.full_name || '' })),
  unread: main.some((r) => (r.unread_count || 0) > 0),
  label: main.length === 1 ? '1 request' : `${main.length} requests`,
});

/** Reads the jsonb from get_dm_request_state; anything unexpected means "no limits" so the chat keeps working. */
export const parseSenderState = (raw: unknown): SenderRequestState => {
  if (!raw || typeof raw !== 'object') return EMPTY_SENDER_STATE;
  const r = raw as Record<string, unknown>;
  const cap = typeof r.cap === 'number' ? r.cap : DM_REQUEST_CAP;
  const sent = typeof r.sent === 'number' ? r.sent : 0;
  const remaining = typeof r.remaining === 'number' ? r.remaining : Math.max(0, cap - sent);
  return { waiting: r.waiting === true, sent, cap, remaining, closed: r.closed === true };
};

export const canSendWhileWaiting = (s: SenderRequestState): boolean => !s.waiting || (!s.closed && s.remaining > 0);

export const WAITING_TEXT = 'Waiting for them to accept';

export const HIDDEN_REQUESTS_EXPLAINER = "Messages that may be spam or offensive are filtered here. You won't be notified about them.";

export const requestExplainer = (name: string) => `${name} wants to send you a message. They won't know you've seen it until you accept.`;

export const mutualText = (n: number | null | undefined): string => {
  const c = n || 0;
  return c > 0 ? `${c} mutual connection${c === 1 ? '' : 's'}` : 'No mutual connections';
};

/** Days left before a deleted request disappears for good (never below 0). */
export const daysLeftInDeletedWindow = (deletedAt: string | null | undefined, now: number = Date.now()): number => {
  const t = deletedAt ? Date.parse(deletedAt) : NaN;
  if (!Number.isFinite(t)) return REQUEST_DELETED_WINDOW_DAYS;
  return Math.max(0, Math.ceil((t + REQUEST_DELETED_WINDOW_DAYS * DAY_MS - now) / DAY_MS));
};
