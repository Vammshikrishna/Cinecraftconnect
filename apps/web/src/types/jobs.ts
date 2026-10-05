// Vocabulary, labels, formatting and scoring are shared with the mobile app (packages/core/src/jobs.ts) so both apps
// describe a job the same way. This file re-exports them and adds the row shapes the web app reads from Supabase.
import type {
  JobType,
  ExperienceLevel,
  WorkMode,
  PayPeriod,
  ApplicationStatus,
  ScreeningQuestion,
} from '@cinecraft/core';

export type { JobType, ExperienceLevel, WorkMode, PayPeriod, ApplicationStatus, ScreeningQuestion };
export {
  JOB_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  PAY_PERIODS,
  JOB_TYPE_LABELS,
  EXPERIENCE_LABELS,
  WORK_MODE_LABELS,
  PAY_PERIOD_LABELS,
  DEPARTMENTS,
  CURRENCIES,
} from '@cinecraft/core';

export interface Job {
    id: string;
    title: string;
    description: string;
    company: string;
    location: string | null;
    type: JobType;
    salary_min: number | null;
    salary_max: number | null;
    currency?: string | null;
    pay_period?: PayPeriod | null;
    experience_level: ExperienceLevel;
    requirements: string | null;
    department?: string | null;
    work_mode?: WorkMode | null;
    deadline?: string | null;
    shoot_start?: string | null;
    shoot_end?: string | null;
    openings?: number | null;
    screening_questions?: ScreeningQuestion[] | null;
    is_draft?: boolean | null;
    posted_by: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    auto_close_on_hire?: boolean;
    page_id: string | null;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
        username: string | null;
    };
    company_pages?: {
        id: string;
        name: string;
        logo_url: string | null;
        slug: string;
        tagline?: string | null;
        description?: string | null;
        headquarters?: string | null;
        company_size?: string | null;
    };
}
