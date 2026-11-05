/**
 * Pure rules for the admin work desks (support SLA and filters, bulk review, CSV export, saved views, staff workload).
 * Kept free of React and Supabase so they can be unit tested.
 */
import { csvRow } from './staffHelpers';

/** True when a Supabase error means "this database function or table is not there yet" (the SQL part has not been run). */
export const isMissingDbObject = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST205'
    || /could not find the (function|table)|does not exist|schema cache/i.test(error.message || ''));

// ── support: first-reply target and SLA state ──────────────────────────────────────────────────

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Hours allowed before the first staff reply, by priority. The database function staff_workload() uses the same numbers. */
export const FIRST_REPLY_HOURS: Record<TicketPriority, number> = { urgent: 1, high: 4, medium: 24, low: 72 };

const HOUR = 3_600_000;

export interface SlaTicket {
  priority?: string | null;
  status?: string | null;
  created_at: string;
  first_response_at?: string | null;
}

export type SlaState = 'met' | 'late' | 'ok' | 'soon' | 'overdue' | 'none';

export interface Sla {
  state: SlaState;
  /** when the first reply was due */
  dueAt: number;
  /** milliseconds left (negative when overdue); null once the ticket has had its first reply */
  msLeft: number | null;
}

export const slaWindowMs = (priority?: string | null): number =>
  (FIRST_REPLY_HOURS[(priority as TicketPriority) || 'medium'] ?? FIRST_REPLY_HOURS.medium) * HOUR;

/** Is the first reply on time, still fine, nearly due or overdue? A closed ticket nobody ever answered is "none". */
export const ticketSla = (t: SlaTicket, now: number = Date.now()): Sla => {
  const created = new Date(t.created_at).getTime();
  const window = slaWindowMs(t.priority);
  const dueAt = created + window;
  if (t.first_response_at) {
    const replied = new Date(t.first_response_at).getTime();
    return { state: replied <= dueAt ? 'met' : 'late', dueAt, msLeft: null };
  }
  if (t.status === 'resolved' || t.status === 'closed') return { state: 'none', dueAt, msLeft: null };
  const msLeft = dueAt - now;
  if (msLeft < 0) return { state: 'overdue', dueAt, msLeft };
  // the last quarter of the window counts as "due soon"
  return { state: msLeft <= window / 4 ? 'soon' : 'ok', dueAt, msLeft };
};

/** 45 min, 3 h 10 min, 2 d 4 h. Negative values are shown without the sign (the caller says "overdue"). */
export const formatDuration = (ms: number): string => {
  if (Math.abs(ms) < 60_000) return 'under 1 min';
  const total = Math.round(Math.abs(ms) / 60_000);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 48) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest ? `${d} d ${rest} h` : `${d} d`;
};

/** The short text on the SLA chip. */
export const slaLabel = (s: Sla): string => {
  switch (s.state) {
    case 'overdue': return `Overdue by ${formatDuration(s.msLeft ?? 0)}`;
    case 'soon': return `Reply due in ${formatDuration(s.msLeft ?? 0)}`;
    case 'ok': return `Reply due in ${formatDuration(s.msLeft ?? 0)}`;
    case 'met': return 'Answered in time';
    case 'late': return 'Answered late';
    default: return 'No reply needed';
  }
};

/** Minutes from the ticket being opened to the first staff reply, or null when there has been none. */
export const firstReplyMinutes = (t: Pick<SlaTicket, 'created_at' | 'first_response_at'>): number | null => {
  if (!t.first_response_at) return null;
  const ms = new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : null;
};

export const median = (values: number[]): number | null => {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
};

export interface DeskSummary {
  open: number;
  overdue: number;
  soon: number;
  unassigned: number;
  answered: number;
  medianFirstReplyMin: number | null;
}

export const summariseDesk = (tickets: (SlaTicket & { assigned_to?: string | null })[], now: number = Date.now()): DeskSummary => {
  let open = 0, overdue = 0, soon = 0, unassigned = 0, answered = 0;
  const times: number[] = [];
  for (const t of tickets) {
    const active = t.status === 'open' || t.status === 'in_progress';
    if (active) {
      open += 1;
      if (!t.assigned_to) unassigned += 1;
      const s = ticketSla(t, now).state;
      if (s === 'overdue') overdue += 1;
      if (s === 'soon') soon += 1;
    }
    const m = firstReplyMinutes(t);
    if (m !== null) { answered += 1; times.push(m); }
  }
  return { open, overdue, soon, unassigned, answered, medianFirstReplyMin: median(times) };
};

// ── support: filters ───────────────────────────────────────────────────────────────────────────

export interface TicketFilter {
  /** active = open + in progress */
  status: 'all' | 'active' | 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'all' | TicketPriority;
  /** all, mine, unassigned or a staff id */
  assignee: string;
  overdueOnly: boolean;
  query: string;
}

export const DEFAULT_TICKET_FILTER: TicketFilter = { status: 'all', priority: 'all', assignee: 'all', overdueOnly: false, query: '' };

export interface FilterableTicket extends SlaTicket {
  subject: string;
  category?: string | null;
  assigned_to?: string | null;
  profiles?: { username?: string | null } | null;
}

export const filterTickets = <T extends FilterableTicket>(tickets: T[], f: TicketFilter, me: string | null, now: number = Date.now()): T[] => {
  const q = f.query.trim().toLowerCase();
  return tickets.filter((t) => {
    if (f.status === 'active' && !(t.status === 'open' || t.status === 'in_progress')) return false;
    if (f.status !== 'all' && f.status !== 'active' && t.status !== f.status) return false;
    if (f.priority !== 'all' && (t.priority || 'medium') !== f.priority) return false;
    if (f.assignee === 'unassigned' && t.assigned_to) return false;
    if (f.assignee === 'mine' && (!me || t.assigned_to !== me)) return false;
    if (f.assignee !== 'all' && f.assignee !== 'unassigned' && f.assignee !== 'mine' && t.assigned_to !== f.assignee) return false;
    if (f.overdueOnly && ticketSla(t, now).state !== 'overdue') return false;
    if (q) {
      const hay = `${t.subject} ${t.category || ''} ${t.profiles?.username || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
};

/** Replace {{name}} and {{agent}} in a ready-made reply. A missing value is left out cleanly rather than printed as "undefined". */
export const applyMacro = (body: string, vars: { name?: string | null; agent?: string | null } = {}): string =>
  body
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name?.trim() || 'there')
    .replace(/\{\{\s*agent\s*\}\}/gi, vars.agent?.trim() || 'the support team');

// ── bulk review ────────────────────────────────────────────────────────────────────────────────

export interface BulkResult {
  ok: string[];
  failed: { id: string; message: string }[];
}

/** Run one decision per id, one after the other, and collect what worked and what did not. One failure never stops the rest. */
export const runBulk = async (ids: string[], fn: (id: string) => Promise<string | null | void>): Promise<BulkResult> => {
  const out: BulkResult = { ok: [], failed: [] };
  for (const id of ids) {
    try {
      const err = await fn(id);
      if (err) out.failed.push({ id, message: String(err) });
      else out.ok.push(id);
    } catch (e: any) {
      out.failed.push({ id, message: e?.message ? String(e.message) : 'Failed' });
    }
  }
  return out;
};

export const bulkSummary = (r: BulkResult, verb: 'approved' | 'rejected'): string => {
  const n = r.ok.length;
  const f = r.failed.length;
  const done = `${n} request${n === 1 ? '' : 's'} ${verb}`;
  return f ? `${done}, ${f} could not be saved.` : `${done}.`;
};

/** Toggle one id in a selection (returns a new array). */
export const toggleSelected = (selected: string[], id: string): string[] =>
  selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];

// ── CSV export ─────────────────────────────────────────────────────────────────────────────────

/** Mirrors the database check in staff_export_check(): both dates, the end not before the start, at most 366 days. */
export const validateRange = (from: string, to: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'Choose a start and an end date.';
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Choose a start and an end date.';
  if (b < a) return 'The end date is before the start date.';
  if ((b - a) / 86_400_000 > 366) return 'Choose a range of one year or less.';
  return null;
};

/** A CSV text (UTF-8 BOM so spreadsheets read accents correctly) from column names and rows; every cell is formula-neutralised. */
export const buildCsv = (columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string =>
  '﻿' + [csvRow(columns.map((c) => c.label))].concat(rows.map((r) => csvRow(columns.map((c) => r[c.key])))).join('\r\n') + '\r\n';

export const exportFileName = (what: string, from: string, to: string): string => `cinecraft-${what}-${from}-to-${to}.csv`;

export const EXPORTS = {
  users_summary: {
    rpc: 'staff_export_users_summary',
    title: 'People summary',
    hint: 'Handle, name, account type, verified, suspended, joined, last active, active strikes. No email or phone.',
    columns: [
      { key: 'username', label: 'Handle' }, { key: 'full_name', label: 'Name' }, { key: 'account_type', label: 'Account type' },
      { key: 'is_verified', label: 'Verified' }, { key: 'is_suspended', label: 'Suspended' }, { key: 'joined_at', label: 'Joined' },
      { key: 'last_active_at', label: 'Last active' }, { key: 'active_strikes', label: 'Active strikes' },
    ],
  },
  tickets: {
    rpc: 'staff_export_tickets',
    title: 'Support tickets',
    hint: 'Category, priority, status, owner, first reply time, resolved date, rating. No message text.',
    columns: [
      { key: 'ticket', label: 'Ticket' }, { key: 'created_at', label: 'Opened' }, { key: 'requester', label: 'Requester' },
      { key: 'category', label: 'Category' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
      { key: 'owner', label: 'Owner' }, { key: 'first_reply_at', label: 'First reply' }, { key: 'first_reply_minutes', label: 'First reply (minutes)' },
      { key: 'resolved_at', label: 'Resolved' }, { key: 'rating', label: 'Rating' },
    ],
  },
  verification_queue: {
    rpc: 'staff_export_verification_queue',
    title: 'Verification requests',
    hint: 'Handle, type, status, reviewer, decision date, rejection reason. No legal name or documents.',
    columns: [
      { key: 'request', label: 'Request' }, { key: 'created_at', label: 'Opened' }, { key: 'username', label: 'Handle' },
      { key: 'request_type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'reviewed_by', label: 'Reviewed by' },
      { key: 'reviewed_at', label: 'Reviewed' }, { key: 'rejection_reason', label: 'Rejection reason' },
    ],
  },
} as const;

export type ExportKind = keyof typeof EXPORTS;

// ── saved views ────────────────────────────────────────────────────────────────────────────────

export const SAVED_VIEW_NAME_MAX = 60;

export const cleanViewName = (raw: string): string => raw.replace(/\s+/g, ' ').trim().slice(0, SAVED_VIEW_NAME_MAX);

/** Read a stored filter back safely: only the allowed keys with the right type survive; anything else falls back to the default. */
export const readTicketFilter = (raw: unknown): TicketFilter => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const statuses = ['all', 'active', 'open', 'in_progress', 'resolved', 'closed'];
  const priorities = ['all', 'low', 'medium', 'high', 'urgent'];
  return {
    status: statuses.includes(o.status as string) ? (o.status as TicketFilter['status']) : DEFAULT_TICKET_FILTER.status,
    priority: priorities.includes(o.priority as string) ? (o.priority as TicketFilter['priority']) : DEFAULT_TICKET_FILTER.priority,
    assignee: typeof o.assignee === 'string' && o.assignee.length <= 40 ? o.assignee : DEFAULT_TICKET_FILTER.assignee,
    overdueOnly: o.overdueOnly === true,
    query: typeof o.query === 'string' ? o.query.slice(0, 80) : '',
  };
};

export const sameFilter = (a: TicketFilter, b: TicketFilter): boolean =>
  a.status === b.status && a.priority === b.priority && a.assignee === b.assignee && a.overdueOnly === b.overdueOnly && a.query.trim() === b.query.trim();

// ── staff workload ─────────────────────────────────────────────────────────────────────────────

export interface WorkloadRow {
  staff_id: string;
  username: string | null;
  full_name?: string | null;
  level: number;
  tickets_open: number;
  tickets_overdue: number;
  reports_open: number;
  last_active?: string | null;
}

export const workloadTotal = (r: Pick<WorkloadRow, 'tickets_open' | 'reports_open'>): number => (r.tickets_open || 0) + (r.reports_open || 0);

/** Busiest first; ties go to the one with more overdue tickets, then the name. */
export const sortWorkload = (rows: WorkloadRow[]): WorkloadRow[] =>
  [...rows].sort((a, b) =>
    workloadTotal(b) - workloadTotal(a)
    || (b.tickets_overdue || 0) - (a.tickets_overdue || 0)
    || (a.username || '').localeCompare(b.username || ''));

/** How loaded someone is compared to the busiest person: idle, light, busy, heavy (heavy = at least 75% of the busiest and at least 5 items). */
export const loadTone = (total: number, max: number): 'idle' | 'light' | 'busy' | 'heavy' => {
  if (total <= 0) return 'idle';
  if (max > 0 && total >= max * 0.75 && total >= 5) return 'heavy';
  if (total >= 3) return 'busy';
  return 'light';
};

export const LEVEL_LABEL: Record<number, string> = { 1: 'Moderator', 2: 'Admin', 3: 'Super admin' };

// ── account record: money and counts ───────────────────────────────────────────────────────────

/** Minor units to text for one currency. Falls back to "1234 XYZ" when the currency code is not one Intl knows. */
export const moneyFromMinor = (minor: number, currency: string): string => {
  const major = (Number(minor) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
};

/** {INR: 12000, USD: 500} -> "₹120.00, $5.00"; an empty object is "none". */
export const moneyMap = (m: Record<string, number> | null | undefined): string => {
  const parts = Object.entries(m || {}).filter(([, v]) => Number(v) > 0).map(([c, v]) => moneyFromMinor(v, c));
  return parts.length ? parts.join(', ') : 'none';
};
