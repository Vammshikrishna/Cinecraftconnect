/**
 * Scheduled posts (web and mobile). The database hides a scheduled post from everyone but its author until its time and
 * sends the notifications then (supabase/manual/part_at_post_extras.sql). See docs/POST_EXTRAS.md.
 */

export const SCHEDULE_MIN_MINUTES = 5;
export const SCHEDULE_MAX_DAYS = 90;

export interface SchedulePreset {
  id: string;
  label: string;
  at: Date;
}

const atHour = (base: Date, dayOffset: number, hour: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** Quick choices that are always in the future: in an hour, this evening (or tomorrow's if it has passed), tomorrow morning, in three days. */
export const schedulePresets = (now: Date = new Date()): SchedulePreset[] => {
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  inHour.setSeconds(0, 0);
  let evening = atHour(now, 0, 20);
  if (evening.getTime() <= now.getTime() + SCHEDULE_MIN_MINUTES * 60_000) evening = atHour(now, 1, 20);
  let morning = atHour(now, 1, 9);
  if (morning.getTime() <= evening.getTime() && evening.getDate() !== now.getDate()) morning = atHour(now, 2, 9);
  const threeDays = atHour(now, 3, 9);
  return [
    { id: 'hour', label: 'In 1 hour', at: inHour },
    { id: 'evening', label: evening.getDate() === now.getDate() ? 'Tonight 8 PM' : 'Tomorrow 8 PM', at: evening },
    { id: 'morning', label: 'Tomorrow 9 AM', at: morning },
    { id: 'three', label: 'In 3 days', at: threeDays },
  ].filter((p, i, all) => all.findIndex((q) => q.at.getTime() === p.at.getTime()) === i);
};

export interface ScheduleCheck { ok: boolean; message?: string }

export const checkSchedule = (when: Date | null | undefined, now: Date = new Date()): ScheduleCheck => {
  if (!when || Number.isNaN(when.getTime())) return { ok: false, message: 'Choose a date and time.' };
  if (when.getTime() < now.getTime() + SCHEDULE_MIN_MINUTES * 60_000) return { ok: false, message: `Choose a time at least ${SCHEDULE_MIN_MINUTES} minutes from now.` };
  if (when.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 86_400_000) return { ok: false, message: `You can schedule up to ${SCHEDULE_MAX_DAYS} days ahead.` };
  return { ok: true };
};

/** "Tue 7 Oct, 8:00 PM" in the viewer's language and time zone. */
export const formatSchedule = (iso: string | Date, locale?: string): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export const isScheduledFuture = (iso: string | null | undefined, now: Date = new Date()): boolean =>
  !!iso && new Date(iso).getTime() > now.getTime();

/** For an <input type="datetime-local">: local time without a zone, "YYYY-MM-DDTHH:mm". */
export const toLocalInputValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const callFail = (error: any, fallback: string): never => {
  throw new Error(String(error?.message || fallback));
};

/** Publish a scheduled post now (`when` omitted) or move it to another time. */
export const reschedulePost = async (client: any, postId: string, when?: Date | null): Promise<{ published: boolean }> => {
  const { data, error } = await client.rpc('reschedule_post', { p_post: postId, p_when: when ? when.toISOString() : null });
  if (error) callFail(error, 'Could not change the schedule.');
  return { published: !!data?.published };
};

/** Sends the notifications for posts whose time has come. Safe to call as often as you like; it is throttled here. */
let lastRelease = 0;
export const releaseDuePosts = async (client: any): Promise<void> => {
  const now = Date.now();
  if (now - lastRelease < 60_000) return;
  lastRelease = now;
  try {
    await client.rpc('release_due_posts');
  } catch {
    /* the next feed load tries again */
  }
};
