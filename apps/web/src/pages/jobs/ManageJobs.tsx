import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Briefcase, Building2, Clock, Edit2, Copy, Link2, Trash2, Search, Download, Star, Users, LayoutGrid, List, BarChart3, ChevronDown, Rocket, Lock, Unlock, FileEdit, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { JobCreationModal } from '@/components/jobs/JobCreationModal';
import { PipelineBoard } from '@/components/jobs/hiring/PipelineBoard';
import { ApplicantDrawer } from '@/components/jobs/hiring/ApplicantDrawer';
import { JobAnalyticsPanel } from '@/components/jobs/hiring/JobAnalyticsPanel';
import { RejectDialog } from '@/components/jobs/hiring/RejectDialog';
import { MatchBadge, StageBadge, StarRating } from '@/components/jobs/hiring/shared';
import {
  PIPELINE_STAGES, getDeadlineInfo, formatSalary, jobShareUrl, type ApplicationStatus,
} from '@cinecraft/core';
import {
  fetchHiringJobs, setApplicationStatus, setShortlisted, setJobOpen, deleteJob, type HiringJob, type HiringApplicant,
} from '@/lib/jobs/hiringApi';
import { cn } from '@/lib/utils';

type SortKey = 'match' | 'newest' | 'rating';

const jobState = (j: HiringJob): { label: string; tone: string } => {
  if (j.is_draft) return { label: 'Draft', tone: 'bg-slate-500/15 text-slate-500' };
  const dl = getDeadlineInfo(j.deadline);
  if (!j.is_active) return { label: dl?.expired ? 'Expired' : 'Closed', tone: 'bg-red-500/15 text-red-500' };
  if (dl?.urgent) return { label: dl.label, tone: 'bg-amber-500/15 text-amber-600' };
  return { label: 'Open', tone: 'bg-emerald-500/15 text-emerald-600' };
};

const ManageJobs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<HiringJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pipeline' | 'list' | 'analytics'>('pipeline');
  const [openAppId, setOpenAppId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<HiringApplicant | null>(null);

  // list tab controls (per open job)
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | ApplicationStatus>('all');
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('match');
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // Closes postings whose deadline has passed, so the list shows the truth.
      await (supabase as any).rpc('close_overdue_jobs'); // PostgREST builders only run when awaited
      setJobs(await fetchHiringJobs(user.id));
    } catch (e) {
      console.error('Error loading hiring data', e);
      toast({ title: 'Could not load your postings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: new applications, status changes, interview answers and job edits arrive without a refresh.
  const reloadTimer = useRef<any>(null);
  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 600);
    };
    const channel = supabase
      .channel(`hiring_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_interviews' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, schedule)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  // reset list controls when a different job is opened
  useEffect(() => {
    setSearch('');
    setStageFilter('all');
    setShortlistedOnly(false);
    setSelected([]);
    setTab('pipeline');
  }, [expandedId]);

  const openApp = useMemo(() => {
    for (const j of jobs) {
      const a = j.applications.find((x) => x.id === openAppId);
      if (a) return { job: j, app: a };
    }
    return null;
  }, [jobs, openAppId]);

  const move = async (a: HiringApplicant, status: ApplicationStatus) => {
    if (status === 'rejected') {
      setRejecting(a);
      return;
    }
    // optimistic
    setJobs((prev) => prev.map((j) => ({ ...j, applications: j.applications.map((x) => (x.id === a.id ? { ...x, status } : x)) })));
    try {
      await setApplicationStatus(a.id, status);
      toast({ title: `Moved to ${PIPELINE_STAGES.find((s) => s.key === status)?.label}`, description: 'The candidate was notified.' });
    } catch (e: any) {
      toast({ title: 'Could not move the candidate', description: e?.message, variant: 'destructive' });
      load();
    }
  };

  const confirmReject = async (reason: string) => {
    const a = rejecting;
    setRejecting(null);
    if (!a) return;
    setJobs((prev) => prev.map((j) => ({ ...j, applications: j.applications.map((x) => (x.id === a.id ? { ...x, status: 'rejected', rejection_reason: reason } : x)) })));
    try {
      await setApplicationStatus(a.id, 'rejected', reason);
      toast({ title: 'Candidate rejected', description: 'They were notified.' });
    } catch (e: any) {
      toast({ title: 'Could not reject', description: e?.message, variant: 'destructive' });
      load();
    }
  };

  const bulkMove = async (status: ApplicationStatus) => {
    if (selected.length === 0 || status === 'rejected') return;
    try {
      await Promise.all(selected.map((id) => setApplicationStatus(id, status)));
      toast({ title: `Moved ${selected.length} candidate${selected.length === 1 ? '' : 's'}`, description: 'They were notified.' });
      setSelected([]);
      load();
    } catch (e: any) {
      toast({ title: 'Some candidates could not be moved', description: e?.message, variant: 'destructive' });
      load();
    }
  };

  const bulkShortlist = async (value: boolean) => {
    try {
      await setShortlisted(selected, value);
      setSelected([]);
      load();
    } catch (e: any) {
      toast({ title: 'Could not update the shortlist', description: e?.message, variant: 'destructive' });
    }
  };

  const exportCsv = (job: HiringJob, apps: HiringApplicant[]) => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Name', 'Craft', 'Location', 'Stage', 'Match %', 'Rating', 'Shortlisted', 'Applied', 'Showreel'],
      ...apps.map((a) => [
        a.applicant?.full_name || a.applicant?.username || '', a.applicant?.craft || '', a.applicant?.location || '',
        PIPELINE_STAGES.find((s) => s.key === a.status)?.label || a.status, a.match.score, a.rating ?? '', a.is_shortlisted ? 'Yes' : '',
        new Date(a.created_at).toISOString().slice(0, 10), a.showreel_url || '',
      ]),
    ];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${job.title.replace(/[^\w-]+/g, '_')}_applicants.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const toggleOpen = async (job: HiringJob) => {
    try {
      await setJobOpen(job.id, !job.is_active || !!job.is_draft);
      toast({ title: job.is_draft ? 'Job published' : job.is_active ? 'Applications closed' : 'Job reopened' });
      load();
    } catch (e: any) {
      toast({ title: 'Could not update the job', description: e?.message, variant: 'destructive' });
    }
  };

  const removeDraft = async (job: HiringJob) => {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    try {
      await deleteJob(job.id);
      setExpandedId(null);
      load();
    } catch (e: any) {
      toast({ title: 'Could not delete the draft', description: e?.message, variant: 'destructive' });
    }
  };

  const copyLink = async (job: HiringJob) => {
    try {
      await navigator.clipboard.writeText(jobShareUrl(job.id));
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  };

  const visibleApps = (job: HiringJob) => {
    const q = search.trim().toLowerCase();
    let list = job.applications.filter((a) => {
      if (stageFilter !== 'all' && a.status !== stageFilter) return false;
      if (shortlistedOnly && !a.is_shortlisted) return false;
      if (q) {
        const hay = `${a.applicant?.full_name || ''} ${a.applicant?.username || ''} ${a.applicant?.craft || ''} ${(a.applicant?.skills || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((x, y) =>
      sortBy === 'match' ? y.match.score - x.match.score : sortBy === 'rating' ? (y.rating || 0) - (x.rating || 0) : +new Date(y.created_at) - +new Date(x.created_at)
    );
    return list;
  };

  const drafts = jobs.filter((j) => j.is_draft);
  const published = jobs.filter((j) => !j.is_draft);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderJob = (job: HiringJob) => {
    const state = jobState(job);
    const open = expandedId === job.id;
    const newCount = job.applications.filter((a) => a.status === 'pending').length;
    const pay = formatSalary(job as any);
    const apps = visibleApps(job);

    return (
      <div key={job.id} className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
        <button className="w-full text-left p-5 sm:p-6 flex items-start gap-4 hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(open ? null : job.id)}>
          <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
            {job.company_pages?.logo_url ? <img loading="lazy" decoding="async" src={job.company_pages.logo_url} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-muted-foreground/50" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-tight truncate">{job.title}</h3>
              <span className={cn('text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-1', state.tone)}>{state.label}</span>
              {job.company_pages && <Badge variant="secondary" className="text-[10px] font-black uppercase">{job.company_pages.name}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground font-semibold">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {job.applications.length} applicant{job.applications.length === 1 ? '' : 's'}</span>
              {newCount > 0 && <span className="text-primary font-black">{newCount} new</span>}
              {pay && <span>{pay}</span>}
              {job.openings && job.openings > 1 && <span>{job.openings} openings</span>}
              {job.deadline && !job.is_draft && <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {getDeadlineInfo(job.deadline)?.label}</span>}
            </div>
          </div>
          <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform shrink-0 mt-1', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="border-t border-border/60 p-5 sm:p-6 space-y-5 bg-muted/10">
            {/* posting actions */}
            <div className="flex flex-wrap gap-2">
              <JobCreationModal
                jobToEdit={job as any}
                onJobCreated={load}
                triggerButton={<Button variant="outline" size="sm" className="rounded-full"><Edit2 className="w-4 h-4 mr-1.5" /> {job.is_draft ? 'Edit draft' : 'Edit'}</Button>}
              />
              <JobCreationModal
                duplicateFrom={job as any}
                onJobCreated={load}
                triggerButton={<Button variant="outline" size="sm" className="rounded-full"><Copy className="w-4 h-4 mr-1.5" /> Duplicate</Button>}
              />
              {job.is_draft ? (
                <>
                  <Button size="sm" className="rounded-full" onClick={() => toggleOpen(job)}><Rocket className="w-4 h-4 mr-1.5" /> Publish</Button>
                  <Button variant="outline" size="sm" className="rounded-full text-red-500 border-red-500/30" onClick={() => removeDraft(job)}><Trash2 className="w-4 h-4 mr-1.5" /> Delete</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className={cn('rounded-full', job.is_active && 'text-red-500 border-red-500/30')} onClick={() => toggleOpen(job)}>
                    {job.is_active ? <><Lock className="w-4 h-4 mr-1.5" /> Close applications</> : <><Unlock className="w-4 h-4 mr-1.5" /> Reopen</>}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => copyLink(job)}><Link2 className="w-4 h-4 mr-1.5" /> Copy link</Button>
                  <Button variant="ghost" size="sm" className="rounded-full" asChild><Link to={`/jobs/${job.id}`}>View posting</Link></Button>
                </>
              )}
            </div>

            {job.is_draft ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <FileEdit className="w-8 h-8 mx-auto mb-2 opacity-50" />
                This draft is only visible to you. Publish it to start receiving applications.
              </div>
            ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="pipeline" className="rounded-full gap-1.5"><LayoutGrid className="w-4 h-4" /> Pipeline</TabsTrigger>
                  <TabsTrigger value="list" className="rounded-full gap-1.5"><List className="w-4 h-4" /> List</TabsTrigger>
                  <TabsTrigger value="analytics" className="rounded-full gap-1.5"><BarChart3 className="w-4 h-4" /> Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="pipeline" className="mt-4">
                  {job.applications.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No applications yet. Share the link to get candidates.</div>
                  ) : (
                    <PipelineBoard applications={job.applications} onOpen={(a) => setOpenAppId(a.id)} onMove={move} />
                  )}
                </TabsContent>

                <TabsContent value="list" className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9 rounded-full" placeholder="Search name, craft or skill" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
                      <SelectTrigger className="w-[140px] rounded-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All stages</SelectItem>
                        {PIPELINE_STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                      <SelectTrigger className="w-[140px] rounded-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">Best match</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="rating">Top rated</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant={shortlistedOnly ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setShortlistedOnly((v) => !v)}>
                      <Star className={cn('w-4 h-4 mr-1.5', shortlistedOnly && 'fill-current')} /> Shortlisted
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => exportCsv(job, apps)} disabled={apps.length === 0}>
                      <Download className="w-4 h-4 mr-1.5" /> CSV
                    </Button>
                  </div>

                  {selected.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5">
                      <span className="text-sm font-black">{selected.length} selected</span>
                      <Select onValueChange={(v) => bulkMove(v as ApplicationStatus)}>
                        <SelectTrigger className="w-[150px] h-8 rounded-full text-xs"><SelectValue placeholder="Move to…" /></SelectTrigger>
                        <SelectContent>{PIPELINE_STAGES.filter((s) => s.key !== 'rejected').map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => bulkShortlist(true)}>Shortlist</Button>
                      <Button size="sm" variant="ghost" className="rounded-full h-8" onClick={() => bulkShortlist(false)}>Remove shortlist</Button>
                      <Button size="sm" variant="ghost" className="rounded-full h-8 ml-auto" onClick={() => setSelected([])}>Clear</Button>
                    </div>
                  )}

                  {apps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No candidates match.</div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 divide-y divide-border/60 bg-card overflow-hidden">
                      {apps.map((a) => {
                        const name = a.applicant?.full_name || a.applicant?.username || 'Applicant';
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer" onClick={() => setOpenAppId(a.id)}>
                            <Checkbox
                              checked={selected.includes(a.id)}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => setSelected((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                            />
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={a.applicant?.avatar_url || ''} className="object-cover" />
                              <AvatarFallback className="bg-primary/15 text-primary font-black">{name[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold truncate leading-tight flex items-center gap-1.5">{name} {a.is_shortlisted && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}</p>
                              <p className="text-xs text-muted-foreground truncate">{[a.applicant?.craft, a.applicant?.location].filter(Boolean).join(' · ') || 'No details'}</p>
                            </div>
                            <div className="hidden sm:block"><StarRating value={a.rating} readOnly size={13} /></div>
                            <MatchBadge match={a.match} compact />
                            <StageBadge status={a.status} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <JobAnalyticsPanel jobId={job.id} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-24 selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 space-y-8">
        <BackButton label="BACK TO JOBS" to="/jobs" className="mb-2" />

        <PageHeader
          title="Manage Postings"
          subtitle="Move candidates through your hiring pipeline, schedule interviews and see how each posting performs."
          Icon={Briefcase}
          actions={
            <JobCreationModal
              onJobCreated={load}
              triggerButton={<Button className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform">Post a new job</Button>}
            />
          }
        />

        {jobs.length === 0 ? (
          <div className="bg-card/40 border border-border/50 border-dashed rounded-[3rem] text-center py-24">
            <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-6"><Search className="w-8 h-8 text-primary" /></div>
            <h3 className="text-2xl font-black tracking-tight mb-2">No postings yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8 font-medium">Post your first job, or manage a company page that has postings.</p>
            <JobCreationModal onJobCreated={load} triggerButton={<Button className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">Post your first job</Button>} />
          </div>
        ) : (
          <div className="space-y-8">
            {drafts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Drafts ({drafts.length})</h2>
                {drafts.map(renderJob)}
              </section>
            )}
            <section className="space-y-3">
              {drafts.length > 0 && <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Postings ({published.length})</h2>}
              {published.map(renderJob)}
            </section>
          </div>
        )}
      </div>

      <ApplicantDrawer job={openApp?.job || null} application={openApp?.app || null} onClose={() => setOpenAppId(null)} onChanged={load} />
      <RejectDialog
        open={!!rejecting}
        name={rejecting?.applicant?.full_name || rejecting?.applicant?.username || 'this candidate'}
        onCancel={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
    </div>
  );
};

export default ManageJobs;
