import { REPORT_REASONS } from '@/lib/reportReasons';

/** One row of the signed-in person's own reports (RPC list_my_reports; only user-safe columns, never staff notes). */
export interface MyReport {
  id: string;
  target_type: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

const TARGET_LABEL: Record<string, string> = {
  post: 'Post', comment: 'Comment', user: 'Profile', job: 'Job', listing: 'Listing', room: 'Discussion room', message: 'Message',
  announcement: 'Announcement', review: 'Review', cinema: 'Cinema submission', pitch_call: 'Pitch call', pitch_submission: 'Pitch',
};

export const reportTargetLabel = (t: string): string => TARGET_LABEL[t] || 'Content';

export const reportReasonLabel = (reason: string): string =>
  REPORT_REASONS.find((r) => r.db === reason && r.id === reason)?.label || (reason ? reason.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Other');

export type ReportTone = 'open' | 'review' | 'done' | 'closed';

/** What the person sees for each moderation status. Unknown statuses read as "Received" so a new status never breaks the page. */
export const reportStatus = (status: string): { label: string; tone: ReportTone; outcome: string } => {
  switch (status) {
    case 'reviewing':
      return { label: 'Under review', tone: 'review', outcome: 'A moderator is looking at this now.' };
    case 'resolved':
      return { label: 'Resolved', tone: 'done', outcome: 'We reviewed this report and took action where our rules required it. Thank you for helping keep CineCraft safe.' };
    case 'dismissed':
      return { label: 'Closed', tone: 'closed', outcome: 'We reviewed this report and did not find a rule violation.' };
    default:
      return { label: 'Received', tone: 'open', outcome: 'Our team has your report and will review it.' };
  }
};

export type ReportFilter = 'all' | 'open' | 'done';

const FINISHED = ['resolved', 'dismissed'];

export const filterReports = (rows: MyReport[], filter: ReportFilter): MyReport[] =>
  rows.filter((r) => filter === 'all' || (filter === 'done' ? FINISHED.includes(r.status) : !FINISHED.includes(r.status)));
