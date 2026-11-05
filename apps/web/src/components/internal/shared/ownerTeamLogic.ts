// Small pure rules for the owner-team screens (team dashboards, on-call rota, status page, compliance, digests).
// Kept free of React so they are unit tested (src/tests/staff/ownerTeam.test.ts).

export type Team = 'support' | 'trust' | 'finance' | 'growth';

/** true when the database function is not there yet (its SQL part was not run): the screens show a friendly "not switched on" note */
export const isMissingFunction = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' ||
    /could not find the function|does not exist|schema cache/i.test(error.message || ''));

/** which team cards each console may show: (rank 1 moderator, 2 admin, 3 super admin) and the finance role. Mirrors get_team_stats() in part GI-1. */
export const teamsFor = (role: string | null | undefined): Team[] => {
  switch (role) {
    case 'super_admin': return ['support', 'trust', 'finance', 'growth'];
    case 'admin': return ['support', 'trust', 'finance', 'growth'];
    case 'moderator': return ['trust'];
    case 'finance': return ['finance'];
    default: return [];
  }
};

/** "n/a" for a missing number, otherwise a grouped number */
export const showCount = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US') : 'n/a');

/** hours as "5 h", "2 d 3 h" */
export const showHours = (v: unknown): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a';
  if (v < 1) return 'under 1 h';
  if (v < 48) return `${Math.round(v)} h`;
  const d = Math.floor(v / 24);
  const h = Math.round(v - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
};

/** minutes as "12 min", "3 h 5 min" */
export const showMinutes = (v: unknown): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a';
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.floor(v / 60);
  const m = Math.round(v - h * 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

export type OverallStatus = 'operational' | 'degraded' | 'outage';
export const STATUS_WORDS: Record<OverallStatus, { title: string; detail: string }> = {
  operational: { title: 'All systems operational', detail: 'Everything is working as expected.' },
  degraded: { title: 'Some systems are degraded', detail: 'We are aware of a problem and are working on it.' },
  outage: { title: 'Major outage', detail: 'A serious problem is affecting the platform. We are working on it.' },
};
/** an unexpected value from the server never shows a green "operational" by accident */
export const normalizeStatus = (s: unknown): OverallStatus => (s === 'operational' || s === 'degraded' || s === 'outage' ? s : 'degraded');

/** the day an erasure request is due, 30 days after it arrived (mirrors part GI-2) */
export const ERASURE_DAYS = 30;
export const erasureDueAt = (received: Date): Date => new Date(received.getTime() + ERASURE_DAYS * 86400000);
export const erasureUrgency = (daysLeft: number | null | undefined): 'done' | 'overdue' | 'soon' | 'ok' =>
  typeof daysLeft !== 'number' ? 'done' : daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'soon' : 'ok';

/** Monday-first week days starting at a given date (ISO yyyy-mm-dd, UTC) */
export const weekDays = (from: string): string[] => {
  const base = new Date(`${from}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10));
};
/** the Monday on or before a date (UTC) */
export const mondayOf = (d: Date): string => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * 86400000).toISOString().slice(0, 10);
};

/** download a JSON object as a file in the browser */
export const downloadJson = (name: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** a section of the export bundle as CSV (headers from the union of keys). Spreadsheet formula starters are neutralised. */
export const rowsToCsv = (rows: unknown): string => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r as object))));
  const cell = (v: unknown) => {
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [keys.map(cell).join(','), ...rows.map((r) => keys.map((k) => cell((r as any)[k])).join(','))].join('\n');
};
