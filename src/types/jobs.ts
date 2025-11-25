export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'project-based';
export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead';

export interface Job {
    id: string;
    title: string;
    description: string;
    company: string;
    location: string | null;
    type: JobType;
    salary_min: number | null;
    salary_max: number | null;
    experience_level: ExperienceLevel;
    requirements: string | null;
    posted_by: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
        username: string | null;
    };
}

export const JOB_TYPES: JobType[] = [
    'full-time',
    'part-time',
    'contract',
    'freelance',
    'internship',
    'project-based'
];

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
    'entry',
    'junior',
    'mid',
    'senior',
    'lead'
];
