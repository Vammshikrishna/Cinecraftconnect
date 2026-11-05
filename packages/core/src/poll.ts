/**
 * Polls on posts (web and mobile). The database does the real checking (supabase/manual/part_as_post_polls.sql);
 * these helpers keep the two apps identical: limits, validation, percentages and the calls.
 * See docs/POLLS.md.
 */

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX = 60;
export const POLL_QUESTION_MAX = 140;

/** How long a poll stays open. `null` = until you remove the post. */
export const POLL_DURATIONS: { id: string; label: string; days: number | null }[] = [
  { id: '1d', label: '1 day', days: 1 },
  { id: '3d', label: '3 days', days: 3 },
  { id: '7d', label: '7 days', days: 7 },
  { id: 'none', label: 'No end', days: null },
];

export interface PollDraft {
  question: string;
  options: string[];
  durationId: string;
}

export const emptyPollDraft = (): PollDraft => ({ question: '', options: ['', ''], durationId: '3d' });

export interface PollView {
  post_id: string;
  question: string;
  closes_at: string | null;
  closed: boolean;
  is_author: boolean;
  my_option: string | null;
  total: number;
  options: { id: string; label: string; position: number; votes: number | null }[];
}

/** Options with text, trimmed and without repeats (ignoring capitals). */
export const cleanPollOptions = (options: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options) {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
};

export interface PollCheck { ok: boolean; message?: string }

export const checkPollDraft = (d: PollDraft): PollCheck => {
  if (d.question.length > POLL_QUESTION_MAX) return { ok: false, message: `The question can be up to ${POLL_QUESTION_MAX} characters.` };
  const opts = cleanPollOptions(d.options);
  if (opts.length < POLL_MIN_OPTIONS) return { ok: false, message: `Add at least ${POLL_MIN_OPTIONS} different options.` };
  if (opts.length > POLL_MAX_OPTIONS) return { ok: false, message: `A poll can have up to ${POLL_MAX_OPTIONS} options.` };
  if (opts.some((o) => o.length > POLL_OPTION_MAX)) return { ok: false, message: `Each option can be up to ${POLL_OPTION_MAX} characters.` };
  return { ok: true };
};

/** A poll draft counts as "in use" once anything is typed in it. */
export const pollDraftInUse = (d: PollDraft | null | undefined): boolean =>
  !!d && (d.question.trim() !== '' || d.options.some((o) => o.trim() !== ''));

export const pollClosesAt = (durationId: string, now: Date = new Date()): string | null => {
  const days = POLL_DURATIONS.find((x) => x.id === durationId)?.days ?? null;
  return days === null ? null : new Date(now.getTime() + days * 86_400_000).toISOString();
};

/** Whole-number percentages that add up to 100 (largest remainder), or null while results are hidden. */
export const pollPercentages = (poll: PollView): (number | null)[] => {
  const votes = poll.options.map((o) => o.votes);
  if (votes.some((v) => v === null)) return poll.options.map(() => null);
  const counts = votes as number[];
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) { if (left <= 0) break; floors[i] += 1; left--; }
  return floors;
};

export const pollStatusText = (poll: PollView, now: Date = new Date()): string => {
  const votes = `${poll.total} vote${poll.total === 1 ? '' : 's'}`;
  if (poll.closed) return `${votes} · Poll closed`;
  if (!poll.closes_at) return votes;
  const ms = new Date(poll.closes_at).getTime() - now.getTime();
  if (ms <= 0) return `${votes} · Poll closed`;
  const hours = Math.ceil(ms / 3_600_000);
  return `${votes} · ${hours < 24 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`}`;
};

// ── calls ──────────────────────────────────────────────────────────────────────────────────────────────────────

const fail = (error: any, fallback: string): never => {
  throw new Error(String(error?.message || fallback));
};

/** Adds the poll to a post that was just created. */
export const attachPoll = async (client: any, postId: string, draft: PollDraft): Promise<void> => {
  const check = checkPollDraft(draft);
  if (!check.ok) throw new Error(check.message);
  const { error } = await client.rpc('attach_post_poll', {
    p_post: postId,
    p_question: draft.question.trim(),
    p_options: cleanPollOptions(draft.options),
    p_closes_at: pollClosesAt(draft.durationId),
  });
  if (error) fail(error, 'Could not add the poll.');
};

/** Polls for several posts in one request. Missing/unavailable polls are simply absent. */
export const fetchPolls = async (client: any, postIds: string[]): Promise<Record<string, PollView>> => {
  const ids = Array.from(new Set(postIds)).slice(0, 50);
  if (ids.length === 0) return {};
  const { data, error } = await client.rpc('get_polls', { p_posts: ids });
  if (error) return {};
  const out: Record<string, PollView> = {};
  for (const p of (Array.isArray(data) ? data : []) as PollView[]) out[p.post_id] = p;
  return out;
};

export const voteInPoll = async (client: any, optionId: string): Promise<PollView> => {
  const { data, error } = await client.rpc('vote_in_poll', { p_option: optionId });
  if (error) fail(error, 'Could not record your vote.');
  return data as PollView;
};

export const removePollVote = async (client: any, postId: string): Promise<PollView> => {
  const { data, error } = await client.rpc('remove_poll_vote', { p_post: postId });
  if (error) fail(error, 'Could not remove your vote.');
  return data as PollView;
};
