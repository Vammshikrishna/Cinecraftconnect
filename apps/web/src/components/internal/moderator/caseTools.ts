// Pure helpers behind the moderator console: grouping, due times, claim locks, filters and repeat-offender wording.
// Kept free of React and the database so they can be tested on their own.

export const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

/** A claim that has seen no activity for this long goes back to the pool (the database uses the same number). */
export const CLAIM_IDLE_MINUTES = 30;
export const MIN_ESCALATION_REASON = 5;

export interface CaseRow {
  id: string;
  target_type: string;
  target_id: string;
  reason?: string | null;
  status?: string;
  priority?: string;
  created_at: string;
  due_at?: string | null;
  assigned_to?: string | null;
  claimed_at?: string | null;
  last_activity_at?: string | null;
  group_count?: number;
  /** usernames of everyone who reported the same thing (filled when reports are merged) */
  reporters?: string[];
  reporter?: { username?: string | null } | null;
  details?: string | null;
  [key: string]: unknown;
}

/** Several people reporting the same thing become one case: the oldest report stands for the group. */
export const groupCases = <T extends CaseRow>(list: T[]): T[] => {
  const groups = new Map<string, T>();
  for (const c of list) {
    const key = `${c.target_type}:${c.target_id}`;
    const g = groups.get(key);
    const name = c.reporter?.username || null;
    if (!g) {
      groups.set(key, { ...c, group_count: 1, reporters: name ? [name] : [] });
      continue;
    }
    g.group_count = (g.group_count || 1) + 1;
    if (name && !g.reporters!.includes(name)) g.reporters!.push(name);
    if ((PRIORITY_RANK[c.priority || ''] || 0) > (PRIORITY_RANK[g.priority || ''] || 0)) g.priority = c.priority;
    if (c.due_at && (!g.due_at || new Date(c.due_at) < new Date(g.due_at))) g.due_at = c.due_at;
    if (new Date(c.created_at) < new Date(g.created_at)) {
      g.id = c.id; g.created_at = c.created_at; g.reason = c.reason; g.reporter = c.reporter; g.details = c.details;
    }
    // somebody holding any report of the group holds the case
    if (c.assigned_to && !g.assigned_to) {
      g.assigned_to = c.assigned_to; g.claimed_at = c.claimed_at; g.last_activity_at = c.last_activity_at;
    }
  }
  return Array.from(groups.values());
};

export type SlaState = 'overdue' | 'soon' | 'ok' | 'none';

/** soon = due within the hour */
export const slaState = (due: string | null | undefined, now = Date.now()): SlaState => {
  if (!due) return 'none';
  const ms = new Date(due).getTime() - now;
  if (Number.isNaN(ms)) return 'none';
  if (ms < 0) return 'overdue';
  return ms < 3600000 ? 'soon' : 'ok';
};

/** A closed case has no deadline to miss. */
export const isOpenStatus = (status?: string | null) => !status || status === 'pending' || status === 'reviewing';

export const slaCounts =(cases: Array<Pick<CaseRow, 'due_at'>>, now = Date.now()) => {
  let overdue = 0;
  let soon = 0;
  for (const c of cases) {
    const s = slaState(c.due_at, now);
    if (s === 'overdue') overdue += 1;
    else if (s === 'soon') soon += 1;
  }
  return { overdue, soon };
};

/** "Overdue 4d", "25m left" ... */
export const dueText = (due: string | null | undefined, now = Date.now()): string | null => {
  if (!due) return null;
  const ms = new Date(due).getTime() - now;
  if (Number.isNaN(ms)) return null;
  const mins = Math.round(Math.abs(ms) / 60000);
  const text = mins < 60 ? `${mins}m` : mins < 60 * 48 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return ms < 0 ? `Overdue ${text}` : `${text} left`;
};

export interface ClaimInfo {
  held: boolean;
  mine: boolean;
  /** the owner has been quiet long enough that anyone may take the case */
  idle: boolean;
  idleMinutes: number;
  /** minutes until an idle claim frees itself, 0 when it already has */
  freesInMinutes: number;
}

export const claimInfo = (
  c: Pick<CaseRow, 'assigned_to' | 'claimed_at' | 'last_activity_at' | 'created_at'>,
  me: string | null | undefined,
  now = Date.now(),
  idleLimit = CLAIM_IDLE_MINUTES,
): ClaimInfo => {
  if (!c.assigned_to) return { held: false, mine: false, idle: false, idleMinutes: 0, freesInMinutes: 0 };
  const since = new Date(c.last_activity_at || c.claimed_at || c.created_at).getTime();
  const idleMinutes = Number.isNaN(since) ? 0 : Math.max(0, Math.floor((now - since) / 60000));
  const idle = idleMinutes >= idleLimit;
  return { held: true, mine: !!me && c.assigned_to === me, idle, idleMinutes, freesInMinutes: idle ? 0 : idleLimit - idleMinutes };
};

/** may this person act on the case? their own claim, no claim, an idle claim, or an admin stepping in */
export const canActOnCase = (info: ClaimInfo, rank: number): boolean => !info.held || info.mine || info.idle || rank >= 2;

export type SortKey = 'due' | 'newest' | 'oldest' | 'priority' | 'reports';
export interface QueueFilter {
  query: string;
  priority: 'all' | 'urgent' | 'high' | 'medium' | 'low';
  sla: 'all' | 'overdue' | 'soon';
  owner: 'all' | 'mine' | 'unclaimed';
  sort: SortKey;
}
export const DEFAULT_FILTER: QueueFilter = { query: '', priority: 'all', sla: 'all', owner: 'all', sort: 'due' };

export const isDefaultFilter = (f: QueueFilter) =>
  (Object.keys(DEFAULT_FILTER) as Array<keyof QueueFilter>).every((k) => f[k] === DEFAULT_FILTER[k]);

/** Reads a stored filter back, ignoring anything it does not recognise. */
export const parseFilter = (raw: unknown): QueueFilter => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <K extends keyof QueueFilter>(k: K, allowed: readonly string[]): QueueFilter[K] =>
    (typeof r[k] === 'string' && allowed.includes(r[k] as string) ? r[k] : DEFAULT_FILTER[k]) as QueueFilter[K];
  return {
    query: typeof r.query === 'string' ? r.query.slice(0, 80) : '',
    priority: pick('priority', ['all', 'urgent', 'high', 'medium', 'low']),
    sla: pick('sla', ['all', 'overdue', 'soon']),
    owner: pick('owner', ['all', 'mine', 'unclaimed']),
    sort: pick('sort', ['due', 'newest', 'oldest', 'priority', 'reports']),
  };
};

export const filterCases = <T extends CaseRow>(cases: T[], f: QueueFilter, me: string | null | undefined, now = Date.now()): T[] => {
  const q = f.query.trim().toLowerCase();
  const out = cases.filter((c) => {
    if (f.priority !== 'all' && c.priority !== f.priority) return false;
    if (f.sla !== 'all' && !(isOpenStatus(c.status) && slaState(c.due_at, now) === f.sla)) return false;
    if (f.owner === 'mine' && c.assigned_to !== me) return false;
    if (f.owner === 'unclaimed' && c.assigned_to) return false;
    if (q) {
      const hay = [c.id, c.target_id, c.reason, c.details, c.target_type, c.reporter?.username, ...(c.reporters || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const far = Number.POSITIVE_INFINITY;
  const t = (v?: string | null) => (v ? new Date(v).getTime() : far);
  const sorters: Record<SortKey, (a: T, b: T) => number> = {
    due: (a, b) => t(a.due_at) - t(b.due_at),
    newest: (a, b) => t(b.created_at) - t(a.created_at),
    oldest: (a, b) => t(a.created_at) - t(b.created_at),
    priority: (a, b) => (PRIORITY_RANK[b.priority || ''] || 0) - (PRIORITY_RANK[a.priority || ''] || 0) || t(a.due_at) - t(b.due_at),
    reports: (a, b) => (b.group_count || 1) - (a.group_count || 1) || t(a.due_at) - t(b.due_at),
  };
  return [...out].sort(sorters[f.sort]);
};

export interface RepeatFacts {
  strikes_90d?: number | null;
  strikes_active?: number | null;
  previous_bans?: number | null;
  reports_90d?: number | null;
  repeat?: boolean;
}

/** One line for the case or user lookup, or null when the record is clean. */
export const repeatSummary = (f: RepeatFacts | null | undefined): string | null => {
  if (!f) return null;
  const parts: string[] = [];
  const s = f.strikes_90d || 0;
  const b = f.previous_bans || 0;
  if (s > 0) parts.push(`${s} strike${s === 1 ? '' : 's'} in the last 90 days`);
  if (b > 0) parts.push(`${b} earlier ban${b === 1 ? '' : 's'}`);
  if ((f.reports_90d || 0) > 1) parts.push(`${f.reports_90d} reports in 90 days`);
  return parts.length ? parts.join(' · ') : null;
};

export const isRepeatOffender = (f: RepeatFacts | null | undefined): boolean =>
  !!f && (f.repeat === true || (f.strikes_90d || 0) >= 2 || (f.previous_bans || 0) >= 1);

export type EscalationTarget = 'admin' | 'super_admin';
export const escalationError = (reason: string, target: string): string | null => {
  if (target !== 'admin' && target !== 'super_admin') return 'Choose admin or super admin';
  if (reason.trim().length < MIN_ESCALATION_REASON) return `Say why in at least ${MIN_ESCALATION_REASON} characters`;
  return null;
};

/** True when a call failed only because its database function is not installed yet. */
export const missingFunction = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || ''));
