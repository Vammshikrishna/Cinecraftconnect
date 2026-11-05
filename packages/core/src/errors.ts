/**
 * Turns whatever a failed call threw into one short sentence a person can act on.
 *
 * Plain messages we wrote ourselves (for example "Comments are turned off for this post") pass through unchanged.
 * Technical ones (database, network, session) are replaced, so people never see "violates row-level security policy".
 */
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const rawMessage = (err: unknown): string => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const e = err as { message?: unknown; error_description?: unknown; details?: unknown };
  if (typeof e.message === 'string') return e.message;
  if (typeof e.error_description === 'string') return e.error_description;
  return '';
};

const codeOf = (err: unknown): string => {
  const c = (err as { code?: unknown; status?: unknown } | null)?.code;
  return typeof c === 'string' || typeof c === 'number' ? String(c) : '';
};

const statusOf = (err: unknown): number => {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : 0;
};

/** Words that only appear in system messages, never in a sentence written for a person. */
const TECHNICAL = /(violates|row-level security|row level security|permission denied for|relation "|column "|schema cache|syntax error|constraint|null value in|invalid input syntax|function public\.|pgrst|postgrest|stack trace|unexpected token|undefined|\bat \w+\.\w+ \(|supabase|jwt|fetch failed|typeerror|referenceerror|rpc )/i;

export function friendlyError(err: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  const msg = rawMessage(err).trim();
  const code = codeOf(err);
  const status = statusOf(err);
  const low = msg.toLowerCase();

  // our own rule for staff (internal) accounts, written to be read as it is
  if (/^(staff accounts (do not|cannot)|two-step sign-in is required|a child-safety report can only)/i.test(msg)) return msg;

  // no connection
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|timed out|offline/.test(low)
      || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  // signed out
  if (/jwt (expired|invalid)|invalid refresh token|refresh token|not authenticated|auth session missing/.test(low) || status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  // not allowed
  if (code === '42501' || /row-level security|permission denied|not allowed|insufficient permissions|unauthorized|forbidden/.test(low) || status === 403) {
    // our own readable "only X can do Y" messages say so themselves
    if (msg && !TECHNICAL.test(msg) && !/^(unauthorized|forbidden|permission denied)/i.test(msg) && msg.length <= 160) return msg;
    return "You don't have permission to do that.";
  }
  // too many requests
  if (status === 429 || /rate limit|too many requests|too many attempts/.test(low)) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  // already exists / no longer there
  if (code === '23505' || /duplicate key|already exists/.test(low)) return 'That already exists.';
  if (code === '23503' || /foreign key/.test(low)) return 'That item is no longer available.';
  if (code === '23502' || code === '23514' || code === '22P02') return "Some of what you entered isn't valid. Please check it and try again.";
  if (status >= 500) return 'We had a problem on our side. Please try again in a moment.';

  if (!msg) return fallback;
  // a message we wrote on purpose (database exceptions use P0001) reads fine as it is
  if (code === 'P0001') return msg.length <= 200 ? msg : fallback;
  if (TECHNICAL.test(msg) || msg.length > 160 || /^[{\[]/.test(msg)) return fallback;
  return msg;
}
