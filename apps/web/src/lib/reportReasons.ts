// One list of report reasons for every web report form, and the rules that turn a form into a database row.
// The database (content_reports_reason_check, part CC) only accepts the nine values in DB_REPORT_REASONS, and
// content_reports_target_type_check (part AX) only the target types in DB_REPORT_TARGETS. The mobile ReportModal
// uses the same labels and the same mapping.

export const DB_REPORT_REASONS = [
  'spam', 'harassment', 'hate_speech', 'misinformation', 'explicit_content', 'impersonation', 'fraud', 'other', 'child_safety',
] as const;
export type DbReportReason = (typeof DB_REPORT_REASONS)[number];

export const DB_REPORT_TARGETS = [
  'post', 'comment', 'user', 'job', 'listing', 'room', 'message', 'announcement', 'review', 'cinema', 'pitch_call', 'pitch_submission',
] as const;
export type DbReportTarget = (typeof DB_REPORT_TARGETS)[number];

export interface ReportReasonOption {
  /** what the form keeps while the person picks */
  id: string;
  label: string;
  description: string;
  /** the value stored in content_reports.reason */
  db: DbReportReason;
  /** text put in front of the details so moderators still see what was meant (there is no copyright reason) */
  tag?: string;
}

export const REPORT_REASONS: ReportReasonOption[] = [
  { id: 'spam', label: 'Spam', description: 'Repeated content or deceptive advertising', db: 'spam' },
  { id: 'harassment', label: 'Harassment', description: 'Attacking or bullying specific people', db: 'harassment' },
  { id: 'hate_speech', label: 'Hate Speech', description: 'Attacking protected groups or inciting violence', db: 'hate_speech' },
  { id: 'misinformation', label: 'Misinformation', description: 'False or misleading information', db: 'misinformation' },
  { id: 'explicit_content', label: 'Explicit Content', description: 'Adult content or graphic violence', db: 'explicit_content' },
  { id: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else', db: 'impersonation' },
  { id: 'fraud', label: 'Fraud / Scam', description: 'Scams, phishing or malicious links', db: 'fraud' },
  { id: 'copyright', label: 'Copyright Violation', description: 'Using work without permission', db: 'other', tag: 'Copyright violation' },
  { id: 'child_safety', label: 'Child safety concern', description: 'A child in danger, or sexual content involving a child', db: 'child_safety' },
  { id: 'other', label: 'Other', description: 'Anything else that breaks our rules', db: 'other' },
];

export const toDbReason = (id: string): DbReportReason | null => REPORT_REASONS.find((r) => r.id === id)?.db ?? null;

const MAX_DETAILS = 2000;

export interface ReportInput {
  reporterId: string;
  /** what the form is about; 'project' has no table of its own, so it is filed against the project owner */
  targetType: DbReportTarget | 'project';
  targetId: string;
  targetTitle?: string;
  /** required for 'project': the person who owns it */
  ownerId?: string | null;
  reasonId: string;
  details?: string;
}

/** The row to insert into content_reports, or an Error that explains what is missing. Only valid values come out. */
export function buildReportRow(input: ReportInput) {
  const option = REPORT_REASONS.find((r) => r.id === input.reasonId);
  if (!option) throw new Error('Please select a reason for this report.');
  if (!input.reporterId) throw new Error('Please sign in to report content.');

  let targetType: DbReportTarget;
  let targetId = input.targetId;
  let context = '';
  if (input.targetType === 'project') {
    if (!input.ownerId) throw new Error('This project could not be identified. Please try again later.');
    targetType = 'user';
    targetId = input.ownerId;
    context = `Project: ${input.targetTitle ?? 'untitled'} (${input.targetId})`;
  } else {
    targetType = input.targetType;
  }
  if (!targetId) throw new Error('This item could not be identified. Please try again later.');

  const parts = [option.tag, context, input.details?.trim()].filter(Boolean) as string[];
  const details = parts.length ? parts.join(' - ').slice(0, MAX_DETAILS) : null;

  return {
    reported_by: input.reporterId,
    target_type: targetType,
    target_id: targetId,
    reason: option.db,
    details,
    status: 'pending' as const,
  };
}
