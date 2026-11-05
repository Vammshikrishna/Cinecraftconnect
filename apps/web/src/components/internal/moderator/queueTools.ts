// Pure helpers for the moderator queue tools: CSV export, keyboard shortcuts, handover notes, duplicate search.
// Free of React and the database so they can be tested on their own.

// ── queue CSV export (part_gh_mod_queue_export.sql) ───────────────────────────────────────────────
/** The database refuses more than this too. */
export const QUEUE_EXPORT_CAP = 1000;

export const QUEUE_EXPORT_COLUMNS = [
  { key: 'case_id', label: 'Case id' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' }, { key: 'sla', label: 'SLA state' }, { key: 'created_at', label: 'Created' },
  { key: 'claimed_by', label: 'Claimed by' }, { key: 'escalation_reason', label: 'Escalation reason' },
] as const;

/** The ids to send: the cases on screen, in order, without repeats, cut at the cap. */
export const queueExportIds = (cases: Array<{ id: string }>): { ids: string[]; cut: boolean } => {
  const ids = Array.from(new Set(cases.map((c) => c.id)));
  return { ids: ids.slice(0, QUEUE_EXPORT_CAP), cut: ids.length > QUEUE_EXPORT_CAP };
};

export const queueExportFileName = (now: Date = new Date()): string => `cinecraft-moderation-queue-${now.toISOString().slice(0, 10)}.csv`;

// ── keyboard shortcuts ────────────────────────────────────────────────────────────────────────────
export type ShortcutAction = 'next' | 'prev' | 'claim' | 'dismiss' | 'escalate' | 'goQueue' | 'help' | 'close';

export const SHORTCUTS: Array<{ keys: string; what: string }> = [
  { keys: 'J / K', what: 'Next / previous case in the queue' },
  { keys: 'C', what: 'Claim (take) the open case' },
  { keys: 'D', what: 'Dismiss the open case (asks you to confirm)' },
  { keys: 'E', what: 'Escalate the open case (asks for a reason)' },
  { keys: 'G then Q', what: 'Go to the queue (closes the open case)' },
  { keys: '?', what: 'Show this list' },
  { keys: 'Esc', what: 'Close a dialog' },
];

export const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable === true || el.getAttribute?.('role') === 'combobox';
};

export interface KeyLike { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: EventTarget | null }

/**
 * Turns a key press into an action. `pendingG` is true when the previous key was G (the "go to" chord).
 * Ignored while typing and with Ctrl/Cmd/Alt held (browser shortcuts such as Ctrl+C, Ctrl+D, Cmd+K keep working).
 */
export const shortcutFor = (e: KeyLike, pendingG: boolean): { action: ShortcutAction | null; pendingG: boolean } => {
  if (isTypingTarget(e.target ?? null) || e.ctrlKey || e.metaKey || e.altKey) return { action: null, pendingG: false };
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (pendingG) return k === 'q' ? { action: 'goQueue', pendingG: false } : { action: null, pendingG: false };
  switch (k) {
    case 'g': return { action: null, pendingG: true };
    case 'j': return { action: 'next', pendingG: false };
    case 'k': return { action: 'prev', pendingG: false };
    case 'c': return { action: 'claim', pendingG: false };
    case 'd': return { action: 'dismiss', pendingG: false };
    case 'e': return { action: 'escalate', pendingG: false };
    case '?': return { action: 'help', pendingG: false };
    default: return { action: null, pendingG: false };
  }
};

/** The id of the case j/k moves to; stays put at either end, and starts at the first case when none is open. */
export const stepCase = (ids: string[], current: string | null, dir: 1 | -1): string | null => {
  if (ids.length === 0) return null;
  const i = current ? ids.indexOf(current) : -1;
  if (i < 0) return ids[dir === 1 ? 0 : ids.length - 1];
  return ids[Math.min(ids.length - 1, Math.max(0, i + dir))];
};

// ── handover notes (part_gh_mod_handover.sql) ─────────────────────────────────────────────────────
export const HANDOVER_MAX = 1000;
export const HANDOVER_MAX_CASES = 10;
export const HANDOVER_EDIT_MINUTES = 15;

export const handoverError = (body: string): string | null => {
  const t = body.trim();
  if (!t) return 'Write a note first.';
  if (t.length > HANDOVER_MAX) return `Keep the note to ${HANDOVER_MAX} characters or less.`;
  return null;
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Case ids found in pasted text (full ids), without repeats, at most 10. */
export const parseCaseIds = (text: string): string[] =>
  Array.from(new Set((text.match(UUID_RE) || []).map((s) => s.toLowerCase()))).slice(0, HANDOVER_MAX_CASES);

export interface HandoverNote {
  id: string; author: string; body: string; case_ids: string[]; created_at: string; edited_at: string | null;
  mine: boolean; can_edit: boolean; read_by_me: boolean; read_by: string[];
}

/** Ids of notes by other people that this moderator has not read yet. */
export const unreadNoteIds = (notes: HandoverNote[]): string[] => notes.filter((n) => !n.mine && !n.read_by_me).map((n) => n.id);

// ── duplicate search ──────────────────────────────────────────────────────────────────────────────
/** "#1a2b3c4d " becomes "1a2b3c4d" so a pasted case label works. */
export const normalizeCaseQuery = (q: string): string => q.trim().replace(/^#/, '').toLowerCase().slice(0, 60);
export const duplicateLabel = (id: string): string => `#${id.slice(0, 8)}`;
