/** Pure date-range helpers for the availability calendar (all dates are "yyyy-MM-dd" strings). */

const DAY = 86400000;
const toUtc = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
};
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

export const MAX_RANGE_DAYS = 3700;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the path segment is already a user id (otherwise it is treated as a username). */
export const isUserId = (v: string | undefined | null): boolean => !!v && UUID_RE.test(v);

export interface RangeSplit {
  /** true when at least one selected day falls inside the range */
  overlaps: boolean;
  /** the parts of the range that are NOT selected, as contiguous ranges */
  remainders: Array<{ start_date: string; end_date: string }>;
}

/** Removes the selected days from [start, end] and returns what is left of the range. */
export function splitRangeAroundDates(start: string, end: string | null | undefined, selected: Set<string>): RangeSplit {
  const s = toUtc(start);
  const e = toUtc(end || start);
  if (!(e >= s) || (e - s) / DAY > MAX_RANGE_DAYS) return { overlaps: false, remainders: [] };
  const remainders: Array<{ start_date: string; end_date: string }> = [];
  let overlaps = false;
  let runStart: number | null = null;
  for (let t = s; t <= e; t += DAY) {
    const isSel = selected.has(fromUtc(t));
    if (isSel) {
      overlaps = true;
      if (runStart !== null) { remainders.push({ start_date: fromUtc(runStart), end_date: fromUtc(t - DAY) }); runStart = null; }
    } else if (runStart === null) {
      runStart = t;
    }
  }
  if (runStart !== null) remainders.push({ start_date: fromUtc(runStart), end_date: fromUtc(e) });
  return { overlaps, remainders };
}
