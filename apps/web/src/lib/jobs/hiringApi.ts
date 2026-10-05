import { supabase } from '@/integrations/supabase/client';
import { toSignedStorageUrl } from '@/lib/signedStorageUrl';
import { computeMatchScore, type MatchResult, type ApplicationStatus, type InterviewMode, type InterviewStatus } from '@cinecraft/core';
import type { Job } from '@/types/jobs';

const db = supabase as any;

export interface HiringInterview {
  id: string;
  application_id: string;
  job_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  location: string | null;
  notes: string | null;
  status: InterviewStatus;
}

export interface HiringApplicant {
  id: string;
  job_id: string;
  applicant_id: string;
  status: ApplicationStatus;
  cover_letter: string | null;
  resume_url: string | null;
  showreel_url: string | null;
  is_shortlisted: boolean | null;
  rating: number | null;
  rejection_reason: string | null;
  answers: Record<string, string> | null;
  created_at: string;
  status_updated_at: string | null;
  applicant: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    location: string | null;
    availability_status: string | null;
    craft: string | null;
    is_verified: boolean | null;
    union_membership: string[] | null;
    day_rate_min: number | null;
    day_rate_max: number | null;
    skills: string[];
    credits_count: number;
  } | null;
  match: MatchResult;
  interviews: HiringInterview[];
}

export interface HiringJob extends Job {
  applications: HiringApplicant[];
}

export interface ApplicantNote {
  id: string;
  application_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
}

/** Everything the hiring workspace needs, in a handful of queries (no per-job / per-applicant round trips). */
export async function fetchHiringJobs(userId: string): Promise<HiringJob[]> {
  const [{ data: owned }, { data: member }, { data: admin }] = await Promise.all([
    db.from('company_pages').select('id').eq('owner_id', userId),
    db.from('company_page_members').select('page_id').eq('user_id', userId),
    db.from('company_page_admins').select('page_id').eq('user_id', userId),
  ]);
  const pageIds = Array.from(
    new Set([...(owned || []).map((p: any) => p.id), ...(member || []).map((p: any) => p.page_id), ...(admin || []).map((p: any) => p.page_id)])
  );

  let query = db.from('jobs').select('*, company_pages(name, logo_url)');
  query = pageIds.length > 0 ? query.or(`posted_by.eq.${userId},page_id.in.(${pageIds.join(',')})`) : query.eq('posted_by', userId);
  const { data: jobs, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const jobIds: string[] = (jobs || []).map((j: any) => j.id);
  const appsByJob: Record<string, HiringApplicant[]> = {};

  if (jobIds.length > 0) {
    const { data: apps, error: appsErr } = await db
      .from('job_applications')
      .select(`
        id, job_id, applicant_id, status, cover_letter, resume_url, showreel_url, is_shortlisted, rating,
        rejection_reason, answers, created_at, status_updated_at,
        applicant:applicant_id ( full_name, username, avatar_url, location, availability_status, craft, is_verified,
          user_skills ( skill_name ) )
      `)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });
    if (appsErr) throw appsErr;

    const applicantIds: string[] = Array.from(new Set((apps || []).map((a: any) => a.applicant_id).filter(Boolean))) as string[];
    const appIds: string[] = (apps || []).map((a: any) => a.id);

    const [extrasRes, creditsRes, interviewsRes] = await Promise.all([
      applicantIds.length
        ? db.from('profile_extras').select('user_id, union_membership, day_rate_min, day_rate_max').in('user_id', applicantIds)
        : Promise.resolve({ data: [] }),
      applicantIds.length ? db.from('project_credits').select('user_id').in('user_id', applicantIds) : Promise.resolve({ data: [] }),
      appIds.length ? db.from('job_interviews').select('*').in('application_id', appIds).order('scheduled_at') : Promise.resolve({ data: [] }),
    ]);

    const extras: Record<string, any> = {};
    (extrasRes.data || []).forEach((r: any) => (extras[r.user_id] = r));
    const credits: Record<string, number> = {};
    (creditsRes.data || []).forEach((r: any) => (credits[r.user_id] = (credits[r.user_id] || 0) + 1));
    const interviewsByApp: Record<string, HiringInterview[]> = {};
    (interviewsRes.data || []).forEach((i: any) => (interviewsByApp[i.application_id] ||= []).push(i));

    const jobById = new Map<string, any>((jobs || []).map((j: any) => [j.id, j]));

    (apps || []).forEach((a: any) => {
      const p = a.applicant;
      const ex = extras[a.applicant_id] || {};
      const applicant = p
        ? {
            full_name: p.full_name,
            username: p.username,
            avatar_url: p.avatar_url,
            location: p.location,
            availability_status: p.availability_status,
            craft: p.craft,
            is_verified: p.is_verified,
            union_membership: ex.union_membership ?? null,
            day_rate_min: ex.day_rate_min ?? null,
            day_rate_max: ex.day_rate_max ?? null,
            skills: (p.user_skills || []).map((s: any) => s.skill_name).filter(Boolean),
            credits_count: credits[a.applicant_id] || 0,
          }
        : null;
      const job = jobById.get(a.job_id);
      const match = computeMatchScore(job || {}, applicant ? { ...applicant } : {});
      (appsByJob[a.job_id] ||= []).push({
        id: a.id,
        job_id: a.job_id,
        applicant_id: a.applicant_id,
        status: (a.status || 'pending') as ApplicationStatus,
        cover_letter: a.cover_letter,
        resume_url: a.resume_url,
        showreel_url: a.showreel_url,
        is_shortlisted: a.is_shortlisted,
        rating: a.rating,
        rejection_reason: a.rejection_reason,
        answers: a.answers || {},
        created_at: a.created_at,
        status_updated_at: a.status_updated_at,
        applicant,
        match,
        interviews: interviewsByApp[a.id] || [],
      });
    });
  }

  return (jobs || []).map((j: any) => ({ ...j, applications: appsByJob[j.id] || [] })) as HiringJob[];
}

export async function setApplicationStatus(applicationId: string, status: ApplicationStatus, rejectionReason?: string | null) {
  const patch: any = { status };
  if (status === 'rejected') patch.rejection_reason = rejectionReason?.trim() || null;
  else patch.rejection_reason = null;
  const { error } = await db.from('job_applications').update(patch).eq('id', applicationId);
  if (error) throw error;
}

export async function setShortlisted(applicationIds: string[], value: boolean) {
  if (applicationIds.length === 0) return;
  const { error } = await db.from('job_applications').update({ is_shortlisted: value }).in('id', applicationIds);
  if (error) throw error;
}

export async function setRating(applicationId: string, rating: number | null) {
  const { error } = await db.from('job_applications').update({ rating }).eq('id', applicationId);
  if (error) throw error;
}

export async function fetchNotes(applicationId: string): Promise<ApplicantNote[]> {
  const { data, error } = await db
    .from('job_applicant_notes')
    .select('id, application_id, author_id, body, created_at, author:author_id ( full_name, username, avatar_url )')
    .eq('application_id', applicationId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as ApplicantNote[];
}

export async function addNote(applicationId: string, authorId: string, body: string) {
  const { error } = await db.from('job_applicant_notes').insert({ application_id: applicationId, author_id: authorId, body: body.trim() });
  if (error) throw error;
}

export async function deleteNote(noteId: string) {
  const { error } = await db.from('job_applicant_notes').delete().eq('id', noteId);
  if (error) throw error;
}

export async function proposeInterview(input: {
  application_id: string;
  job_id: string;
  proposed_by: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  location?: string | null;
  notes?: string | null;
}) {
  const { error } = await db.from('job_interviews').insert({ ...input, status: 'proposed' });
  if (error) throw error;
  // Scheduling an interview moves the candidate into the Interview stage.
  await db.from('job_applications').update({ status: 'interviewing' }).eq('id', input.application_id).in('status', ['pending', 'reviewing']);
}

export async function updateInterview(id: string, patch: Partial<Pick<HiringInterview, 'status' | 'scheduled_at' | 'duration_minutes' | 'mode' | 'location' | 'notes'>>) {
  const { error } = await db.from('job_interviews').update(patch).eq('id', id);
  if (error) throw error;
}

export async function fetchAnalytics(jobId: string) {
  const { data, error } = await db.rpc('job_analytics', { p_job_id: jobId });
  if (error) throw error;
  return data as {
    error?: string;
    views: number;
    unique_viewers: number;
    saves: number;
    applications: number;
    shortlisted: number;
    by_status: Record<string, number>;
    daily: { day: string; views: number; applications: number }[];
  };
}

/** Opens a stored resume (private bucket) through a short-lived signed link. */
export async function openResume(resumeRef: string) {
  const url = await toSignedStorageUrl(resumeRef, ['resumes'], 300);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function setJobOpen(jobId: string, open: boolean) {
  const { error } = await db.from('jobs').update({ is_active: open, is_draft: false }).eq('id', jobId);
  if (error) throw error;
}

export async function deleteJob(jobId: string) {
  const { error } = await db.from('jobs').delete().eq('id', jobId);
  if (error) throw error;
}
