/**
 * Jobs & hiring: the one place both apps get their vocabulary, formatting and scoring from, so a job, an applicant
 * or a pipeline stage looks and behaves the same on web and mobile.
 */

// ─── Vocabulary ───────────────────────────────────────────────────────────────────────────────────────────────────

export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'project-based';
export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'project';
export type ApplicationStatus = 'pending' | 'reviewing' | 'interviewing' | 'offered' | 'accepted' | 'rejected';
export type InterviewMode = 'video' | 'call' | 'in_person';
export type InterviewStatus = 'proposed' | 'confirmed' | 'declined' | 'completed' | 'cancelled';

export const JOB_TYPES: JobType[] = ['full-time', 'part-time', 'contract', 'freelance', 'internship', 'project-based'];
export const EXPERIENCE_LEVELS: ExperienceLevel[] = ['entry', 'junior', 'mid', 'senior', 'lead'];
export const WORK_MODES: WorkMode[] = ['onsite', 'hybrid', 'remote'];
export const PAY_PERIODS: PayPeriod[] = ['hour', 'day', 'week', 'month', 'year', 'project'];

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
  'project-based': 'Project-based',
};
export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  entry: 'Entry level',
  junior: 'Junior',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead',
};
export const WORK_MODE_LABELS: Record<WorkMode, string> = { onsite: 'On set / on site', hybrid: 'Hybrid', remote: 'Remote' };
export const PAY_PERIOD_LABELS: Record<PayPeriod, string> = {
  hour: 'per hour',
  day: 'per day',
  week: 'per week',
  month: 'per month',
  year: 'per year',
  project: 'per project',
};

/** Film-industry departments (used for the job's department and for alerts). */
export const DEPARTMENTS = [
  'Direction',
  'Production',
  'Cinematography / Camera',
  'Lighting / Grip',
  'Sound',
  'Art / Production Design',
  'Costume',
  'Makeup & Hair',
  'Editing',
  'VFX / Animation',
  'Colour / DI',
  'Music',
  'Writing',
  'Acting / Casting',
  'Post-production',
  'Marketing / Distribution',
  'Other',
] as const;

export const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'AED', symbol: 'AED ' },
] as const;

export const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find((c) => c.code === (code || 'INR'))?.symbol ?? `${code} `;

// ─── Hiring pipeline ──────────────────────────────────────────────────────────────────────────────────────────────

export interface PipelineStage {
  key: ApplicationStatus;
  label: string;
  /** Short explanation shown to the hiring team. */
  hint: string;
  /** What the applicant sees. */
  applicantLabel: string;
  /** Design tokens (same on both apps). */
  color: string;
  tint: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'pending', label: 'New', hint: 'Not looked at yet', applicantLabel: 'Submitted', color: '#64748B', tint: 'rgba(100,116,139,0.14)' },
  { key: 'reviewing', label: 'Reviewing', hint: 'Being reviewed by the team', applicantLabel: 'In review', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  { key: 'interviewing', label: 'Interview', hint: 'Interview stage', applicantLabel: 'Interview', color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  { key: 'offered', label: 'Offer', hint: 'Offer sent', applicantLabel: 'Offer received', color: '#8B5CF6', tint: 'rgba(139,92,246,0.14)' },
  { key: 'accepted', label: 'Hired', hint: 'Hired', applicantLabel: 'Hired', color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  { key: 'rejected', label: 'Rejected', hint: 'Not moving forward', applicantLabel: 'Not selected', color: '#EF4444', tint: 'rgba(239,68,68,0.14)' },
];

export const getStage = (status?: string | null): PipelineStage =>
  PIPELINE_STAGES.find((s) => s.key === status) || PIPELINE_STAGES[0];

/** Forward progress of an application for a progress bar (rejected shows as a stopped bar). */
export const stageProgress = (status?: string | null): { index: number; total: number; stopped: boolean } => {
  const flow: ApplicationStatus[] = ['pending', 'reviewing', 'interviewing', 'offered', 'accepted'];
  if (status === 'rejected') return { index: 0, total: flow.length, stopped: true };
  const idx = Math.max(0, flow.indexOf((status as ApplicationStatus) || 'pending'));
  return { index: idx, total: flow.length, stopped: false };
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ScreeningQuestion {
  id: string;
  label: string;
  type: 'text' | 'yesno' | 'choice';
  required: boolean;
  options?: string[];
}

export const MAX_SCREENING_QUESTIONS = 5;

/** Cleans up what the form/DB hands us so the UI can trust it. */
export const normalizeScreeningQuestions = (raw: unknown): ScreeningQuestion[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q: any) => q && typeof q.label === 'string' && q.label.trim().length > 0)
    .slice(0, MAX_SCREENING_QUESTIONS)
    .map((q: any, i: number) => ({
      id: typeof q.id === 'string' && q.id ? q.id : `q${i + 1}`,
      label: String(q.label).trim().slice(0, 200),
      type: q.type === 'yesno' || q.type === 'choice' ? q.type : 'text',
      required: !!q.required,
      options: q.type === 'choice' && Array.isArray(q.options) ? q.options.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 8) : undefined,
    }));
};

export interface SalaryLike {
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  pay_period?: string | null;
}

const compactNumber = (n: number): string => {
  if (n >= 10_000_000) return `${+(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${+(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
};

/** "₹50K – ₹1.5L per month", "From ₹4K per day", or null when no pay is given. */
export const formatSalary = (job: SalaryLike): string | null => {
  const min = job.salary_min ?? null;
  const max = job.salary_max ?? null;
  if (min == null && max == null) return null;
  const sym = currencySymbol(job.currency);
  const period = job.pay_period ? ` ${PAY_PERIOD_LABELS[job.pay_period as PayPeriod] || ''}`.trimEnd() : '';
  let range: string;
  if (min != null && max != null && min !== max) range = `${sym}${compactNumber(min)} – ${sym}${compactNumber(max)}`;
  else if (min != null && max == null) range = `From ${sym}${compactNumber(min)}`;
  else if (max != null && min == null) range = `Up to ${sym}${compactNumber(max)}`;
  else range = `${sym}${compactNumber((min ?? max) as number)}`;
  return period ? `${range} ${period.trim()}` : range;
};

export interface DeadlineInfo {
  label: string;
  /** closing within 3 days */
  urgent: boolean;
  expired: boolean;
}

export const getDeadlineInfo = (deadline?: string | null, now: number = Date.now()): DeadlineInfo | null => {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - now;
  if (diff <= 0) return { label: 'Applications closed', urgent: false, expired: true };
  const hours = diff / 3_600_000;
  if (hours < 1) return { label: 'Closes in under an hour', urgent: true, expired: false };
  if (hours < 24) return { label: `Closes in ${Math.floor(hours)}h`, urgent: true, expired: false };
  const days = Math.ceil(hours / 24);
  if (days <= 3) return { label: `Closes in ${days} day${days === 1 ? '' : 's'}`, urgent: true, expired: false };
  return {
    label: `Apply by ${new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    urgent: false,
    expired: false,
  };
};

export interface ShootDatesLike {
  shoot_start?: string | null;
  shoot_end?: string | null;
}

export const formatShootDates = (job: ShootDatesLike): string | null => {
  if (!job.shoot_start && !job.shoot_end) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (job.shoot_start && job.shoot_end) return `${fmt(job.shoot_start)} → ${fmt(job.shoot_end)}`;
  return fmt((job.shoot_start || job.shoot_end) as string);
};

export interface JobFormInput {
  title: string;
  company: string;
  description: string;
  salary_min?: number | null;
  salary_max?: number | null;
  deadline?: string | null;
  shoot_start?: string | null;
  shoot_end?: string | null;
  openings?: number | null;
  pay_period?: string | null;
}

/** Returns a map of field -> message. Empty when valid. `asDraft` relaxes the content requirements. */
export const validateJobForm = (input: JobFormInput, asDraft = false): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!input.title?.trim()) errors.title = 'Give the job a title';
  if (!asDraft) {
    if (!input.company?.trim()) errors.company = 'Add the company or production name';
    if (!input.description?.trim() || input.description.trim().length < 20) errors.description = 'Describe the role (at least 20 characters)';
  }
  const { salary_min: min, salary_max: max } = input;
  if (min != null && min < 0) errors.salary_min = 'Pay cannot be negative';
  if (max != null && max < 0) errors.salary_max = 'Pay cannot be negative';
  if (min != null && max != null && min > max) errors.salary_max = 'Maximum must be higher than minimum';
  if ((min != null || max != null) && !input.pay_period) errors.pay_period = 'Choose how the pay is counted (per day, per month, …)';
  if (input.deadline && !asDraft && new Date(input.deadline).getTime() < Date.now()) errors.deadline = 'The deadline is in the past';
  if (input.shoot_start && input.shoot_end && new Date(input.shoot_start) > new Date(input.shoot_end)) {
    errors.shoot_end = 'The shoot cannot end before it starts';
  }
  if (input.openings != null && (input.openings < 1 || input.openings > 500)) errors.openings = 'Openings must be between 1 and 500';
  return errors;
};

/** The link people share for a job (opens the job page on web and, with the app installed, in the app). */
export const jobShareUrl = (jobId: string): string => `https://cinecraftconnect.com/jobs/${jobId}`;

export const jobShareMessage = (job: { title: string; company: string; location?: string | null } & SalaryLike, jobId: string): string => {
  const pay = formatSalary(job);
  return [`${job.title} at ${job.company}`, job.location ? `📍 ${job.location}` : null, pay ? `💰 ${pay}` : null, jobShareUrl(jobId)]
    .filter(Boolean)
    .join('\n');
};

// ─── Applicant match score ────────────────────────────────────────────────────────────────────────────────────────

export interface MatchJob {
  title?: string | null;
  description?: string | null;
  requirements?: string | null;
  department?: string | null;
  location?: string | null;
  work_mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  pay_period?: string | null;
}

export interface MatchApplicant {
  skills?: string[] | null;
  craft?: string | null;
  location?: string | null;
  availability_status?: string | null;
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  is_verified?: boolean | null;
  credits_count?: number | null;
}

export interface MatchResult {
  /** 0–100 */
  score: number;
  label: 'Strong match' | 'Good match' | 'Partial match' | 'Low match';
  /** Human readable reasons, best first (shown to the hiring team). */
  reasons: string[];
}

const norm = (s?: string | null) => (s || '').toLowerCase().trim();

/**
 * A transparent score (not a black box): every point comes from something we can name in `reasons`.
 *   skills in the posting 40 · craft/department 20 · location / remote 15 · availability 10 · rate fit 10 · proof 5
 */
export const computeMatchScore = (job: MatchJob, applicant: MatchApplicant): MatchResult => {
  const reasons: string[] = [];
  let score = 0;

  const haystack = norm([job.title, job.description, job.requirements, job.department].filter(Boolean).join(' '));
  const skills = (applicant.skills || []).map(norm).filter(Boolean);
  if (skills.length > 0 && haystack) {
    const hits = skills.filter((s) => haystack.includes(s));
    const points = Math.min(40, Math.round((hits.length / Math.min(skills.length, 5)) * 40));
    score += points;
    if (hits.length) reasons.push(`Has ${hits.length} skill${hits.length === 1 ? '' : 's'} from the posting: ${hits.slice(0, 4).join(', ')}`);
  }

  const dept = norm(job.department);
  const craft = norm(applicant.craft);
  if (dept && craft) {
    const deptWords = dept.split(/[\s/&,-]+/).filter((w) => w.length > 3);
    if (deptWords.some((w) => craft.includes(w)) || dept.includes(craft)) {
      score += 20;
      reasons.push(`Works in ${applicant.craft}`);
    }
  } else if (craft && haystack.includes(craft)) {
    score += 14;
    reasons.push(`Craft matches the role (${applicant.craft})`);
  }

  if (norm(job.work_mode) === 'remote') {
    score += 15;
    reasons.push('Role is remote');
  } else if (norm(job.location) && norm(applicant.location)) {
    const jl = norm(job.location);
    const al = norm(applicant.location);
    const jc = jl.split(',')[0].trim();
    if (al.includes(jc) || jl.includes(al.split(',')[0].trim())) {
      score += 15;
      reasons.push(`Based in ${applicant.location}`);
    }
  }

  if (norm(applicant.availability_status) === 'available') {
    score += 10;
    reasons.push('Available now');
  }

  const jobMax = job.salary_max ?? job.salary_min ?? null;
  const rateMin = applicant.day_rate_min ?? null;
  if (jobMax != null && rateMin != null && job.pay_period === 'day') {
    if (rateMin <= jobMax) {
      score += 10;
      reasons.push('Day rate fits the budget');
    } else {
      reasons.push('Day rate is above the budget');
    }
  }

  if (applicant.is_verified || (applicant.credits_count || 0) > 0) {
    score += 5;
    reasons.push(applicant.is_verified ? 'Verified profile' : `${applicant.credits_count} verified credit${applicant.credits_count === 1 ? '' : 's'}`);
  }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? 'Strong match' : score >= 50 ? 'Good match' : score >= 25 ? 'Partial match' : 'Low match';
  return { score, label, reasons };
};

export const matchColor = (score: number): string => (score >= 75 ? '#10B981' : score >= 50 ? '#3B82F6' : score >= 25 ? '#F59E0B' : '#94A3B8');

// ─── Interview helpers ────────────────────────────────────────────────────────────────────────────────────────────

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = { video: 'Video call', call: 'Phone call', in_person: 'In person' };

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  proposed: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** An .ics file body for an interview so either side can add it to their calendar. */
export const interviewIcs = (opts: {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location?: string | null;
  description?: string | null;
}): string => {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(opts.startsAt);
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CineCraft Connect//Jobs//EN',
    'BEGIN:VEVENT',
    `UID:${opts.id}@cinecraftconnect.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.location ? `LOCATION:${esc(opts.location)}` : '',
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
};

// ─── Rejection reasons (quick picks, shared) ──────────────────────────────────────────────────────────────────────

export const REJECTION_REASONS = [
  'Role was filled',
  'Not enough relevant experience',
  'Schedule or location does not work',
  'Rate expectations too high',
  'Portfolio does not fit the project',
  'Other',
] as const;

// ─── Job alerts ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface JobAlertCriteria {
  keywords?: string | null;
  job_type?: string | null;
  work_mode?: string | null;
  department?: string | null;
  location?: string | null;
  min_salary?: number | null;
}

export const describeAlert = (a: JobAlertCriteria): string => {
  const parts = [
    a.keywords?.trim() ? `“${a.keywords.trim()}”` : null,
    a.job_type ? JOB_TYPE_LABELS[a.job_type as JobType] || a.job_type : null,
    a.work_mode ? WORK_MODE_LABELS[a.work_mode as WorkMode] || a.work_mode : null,
    a.department || null,
    a.location ? `in ${a.location}` : null,
    a.min_salary ? `pays ${a.min_salary}+` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Any new job';
};
