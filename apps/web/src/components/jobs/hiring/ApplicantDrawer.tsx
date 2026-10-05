import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, MessageSquare, Star, Trash2, CalendarPlus, Download, ExternalLink, Video, Phone, MapPin, CheckCircle2, ShieldCheck, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  PIPELINE_STAGES, INTERVIEW_MODE_LABELS, INTERVIEW_STATUS_LABELS, interviewIcs, matchColor,
  normalizeScreeningQuestions, type ApplicationStatus, type InterviewMode,
} from '@cinecraft/core';
import {
  type HiringApplicant, type HiringJob, type ApplicantNote,
  setApplicationStatus, setRating, setShortlisted, fetchNotes, addNote, deleteNote, proposeInterview, updateInterview, openResume,
} from '@/lib/jobs/hiringApi';
import { toEmbedUrl, safeExternalUrl } from '@/lib/jobs/showreel';
import { StarRating, MatchBadge, StageBadge } from './shared';
import { RejectDialog } from './RejectDialog';

interface Props {
  job: HiringJob | null;
  application: HiringApplicant | null;
  onClose: () => void;
  /** Called after any change so the workspace refreshes. */
  onChanged: () => void;
}

const downloadIcs = (title: string, i: { id: string; scheduled_at: string; duration_minutes: number; location: string | null; notes: string | null }) => {
  const blob = new Blob([interviewIcs({ id: i.id, title, startsAt: i.scheduled_at, durationMinutes: i.duration_minutes, location: i.location, description: i.notes })], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'interview.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export const ApplicantDrawer = ({ job, application, onClose, onChanged }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [iv, setIv] = useState({ when: '', duration: '30', mode: 'video' as InterviewMode, location: '', notes: '' });

  const open = !!application;
  const questions = useMemo(() => normalizeScreeningQuestions(job?.screening_questions), [job?.screening_questions]);

  useEffect(() => {
    setNotes([]);
    setNoteDraft('');
    setShowScheduler(false);
    if (!application) return;
    let active = true;
    fetchNotes(application.id).then((n) => active && setNotes(n)).catch(() => undefined);
    return () => { active = false; };
  }, [application?.id]);

  if (!application || !job) {
    return <Sheet open={false} onOpenChange={() => onClose()}><SheetContent /></Sheet>;
  }

  const a = application;
  const p = a.applicant;
  const name = p?.full_name || p?.username || 'Applicant';
  const embed = toEmbedUrl(a.showreel_url);
  const reelLink = safeExternalUrl(a.showreel_url);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast({ title: ok });
      onChanged();
    } catch (e: any) {
      toast({ title: 'Something went wrong', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const moveTo = (status: ApplicationStatus) => {
    if (status === a.status) return;
    if (status === 'rejected') {
      setRejectOpen(true);
      return;
    }
    void run(() => setApplicationStatus(a.id, status), `Moved to ${PIPELINE_STAGES.find((s) => s.key === status)?.label}`);
  };

  const confirmReject = (reason: string) => {
    setRejectOpen(false);
    void run(() => setApplicationStatus(a.id, 'rejected', reason), 'Candidate rejected. They have been notified.');
  };

  const submitNote = async () => {
    if (!noteDraft.trim() || !user) return;
    await run(async () => {
      await addNote(a.id, user.id, noteDraft);
      setNotes(await fetchNotes(a.id));
      setNoteDraft('');
    });
  };

  const schedule = async () => {
    if (!iv.when || !user) {
      toast({ title: 'Pick a date and time', variant: 'destructive' });
      return;
    }
    if (new Date(iv.when).getTime() < Date.now()) {
      toast({ title: 'That time is in the past', variant: 'destructive' });
      return;
    }
    await run(async () => {
      await proposeInterview({
        application_id: a.id,
        job_id: a.job_id,
        proposed_by: user.id,
        scheduled_at: new Date(iv.when).toISOString(),
        duration_minutes: Math.max(10, Math.min(480, parseInt(iv.duration, 10) || 30)),
        mode: iv.mode,
        location: iv.location.trim() || null,
        notes: iv.notes.trim() || null,
      });
      setShowScheduler(false);
      setIv({ when: '', duration: '30', mode: 'video', location: '', notes: '' });
    }, 'Interview proposed. The candidate has been notified.');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <div className="p-6 border-b border-border/60 bg-muted/20">
            <SheetHeader className="space-y-3 text-left">
              <div className="flex items-start gap-4">
                <Link to={`/profile/${a.applicant_id}`}>
                  <Avatar className="w-16 h-16 border-2 border-border/60">
                    <AvatarImage src={p?.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="bg-primary/20 text-primary font-black text-2xl">{name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                    <span className="truncate">{name}</span>
                    {p?.is_verified && <ShieldCheck className="w-4 h-4 text-primary shrink-0" />}
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    {[p?.craft, p?.location].filter(Boolean).join(' · ') || 'No craft or location added'}
                    <br />Applied {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })} for <b>{job.title}</b>
                  </SheetDescription>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StageBadge status={a.status} />
                    <MatchBadge match={a.match} />
                    {a.is_shortlisted && <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-black rounded-full px-3 py-1">Shortlisted</span>}
                  </div>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-8">
            {/* Stage */}
            <section className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hiring stage</Label>
              <div className="grid grid-cols-3 gap-2">
                {PIPELINE_STAGES.map((s) => (
                  <button
                    key={s.key}
                    disabled={busy}
                    onClick={() => moveTo(s.key)}
                    className={cn('rounded-xl border px-2 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all', a.status === s.key ? 'shadow-md' : 'hover:bg-muted/50')}
                    style={a.status === s.key ? { color: s.color, borderColor: s.color, backgroundColor: s.tint } : undefined}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {a.status === 'rejected' && a.rejection_reason && (
                <p className="text-xs text-muted-foreground">Reason shared with the candidate: <i>{a.rejection_reason}</i></p>
              )}
              <p className="text-[11px] text-muted-foreground">The candidate gets a notification whenever you move them.</p>
            </section>

            {/* Rating + shortlist */}
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Your rating</Label>
                <StarRating value={a.rating} onChange={(v) => run(() => setRating(a.id, v))} size={22} />
              </div>
              <Button
                variant={a.is_shortlisted ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => run(() => setShortlisted([a.id], !a.is_shortlisted))}
              >
                <Star className={cn('w-4 h-4 mr-1.5', a.is_shortlisted && 'fill-current')} />
                {a.is_shortlisted ? 'Shortlisted' : 'Shortlist'}
              </Button>
            </section>

            {/* Match */}
            <section className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Why this score</Label>
              <div className="rounded-2xl border border-border/60 p-4 space-y-2" style={{ borderColor: `${matchColor(a.match.score)}44` }}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-2xl" style={{ color: matchColor(a.match.score) }}>{a.match.score}%</span>
                  <span className="text-xs font-bold text-muted-foreground">{a.match.label}</span>
                </div>
                {a.match.reasons.length ? (
                  <ul className="text-sm space-y-1">
                    {a.match.reasons.map((r) => <li key={r} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{r}</li>)}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Not enough profile information to compare yet.</p>}
                {(p?.skills?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {p!.skills.slice(0, 12).map((s) => <span key={s} className="text-[11px] font-semibold bg-muted rounded-full px-2.5 py-0.5">{s}</span>)}
                  </div>
                )}
              </div>
            </section>

            {/* Application */}
            <section className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Application</Label>
              {a.cover_letter && <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-2xl p-4 italic">“{a.cover_letter}”</p>}

              {questions.length > 0 && (
                <div className="space-y-2">
                  {questions.map((q) => (
                    <div key={q.id} className="rounded-xl border border-border/60 p-3">
                      <p className="text-xs font-bold text-muted-foreground">{q.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{a.answers?.[q.id] || <span className="text-muted-foreground font-normal">No answer</span>}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {a.resume_url && (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => openResume(a.resume_url!).catch(() => toast({ title: 'Could not open the file', variant: 'destructive' }))}>
                    <FileText className="w-4 h-4 mr-1.5" /> Open CV / portfolio
                  </Button>
                )}
                {reelLink && (
                  <Button variant="outline" size="sm" className="rounded-full" asChild>
                    <a href={reelLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" /> Showreel link</a>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link to={`/messages/${a.applicant_id}`}><MessageSquare className="w-4 h-4 mr-1.5" /> Message</Link>
                </Button>
              </div>

              {embed && (
                <div className="aspect-video rounded-2xl overflow-hidden border border-border/60 bg-black">
                  <iframe src={embed} title="Showreel" className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
                </div>
              )}
            </section>

            {/* Interviews */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Interviews</Label>
                <Button variant="outline" size="sm" className="rounded-full h-8" onClick={() => setShowScheduler((v) => !v)}>
                  <CalendarPlus className="w-4 h-4 mr-1.5" /> Schedule
                </Button>
              </div>

              {showScheduler && (
                <div className="rounded-2xl border border-border/60 p-4 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Date &amp; time</Label>
                      <Input type="datetime-local" value={iv.when} onChange={(e) => setIv({ ...iv, when: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Length (minutes)</Label>
                      <Input type="number" min={10} max={480} value={iv.duration} onChange={(e) => setIv({ ...iv, duration: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">How</Label>
                      <Select value={iv.mode} onValueChange={(v) => setIv({ ...iv, mode: v as InterviewMode })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(INTERVIEW_MODE_LABELS) as InterviewMode[]).map((m) => <SelectItem key={m} value={m}>{INTERVIEW_MODE_LABELS[m]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">{iv.mode === 'in_person' ? 'Address' : 'Meeting link / number'}</Label>
                      <Input value={iv.location} placeholder={iv.mode === 'in_person' ? 'Studio address' : 'https://meet…'} onChange={(e) => setIv({ ...iv, location: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Notes for the candidate</Label>
                      <Textarea className="min-h-[60px]" value={iv.notes} onChange={(e) => setIv({ ...iv, notes: e.target.value })} />
                    </div>
                  </div>
                  <Button className="w-full rounded-xl" onClick={schedule} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send invitation'}
                  </Button>
                </div>
              )}

              {a.interviews.length === 0 && !showScheduler && <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>}
              {a.interviews.map((i) => (
                <div key={i.id} className="rounded-2xl border border-border/60 p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    {i.mode === 'video' ? <Video className="w-5 h-5" /> : i.mode === 'call' ? <Phone className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{format(new Date(i.scheduled_at), 'EEE d MMM, h:mm a')} · {i.duration_minutes} min</p>
                    <p className="text-xs text-muted-foreground">{INTERVIEW_MODE_LABELS[i.mode]}{i.location ? ` · ${i.location}` : ''}</p>
                    <p className={cn('text-[11px] font-black uppercase tracking-wider mt-1', i.status === 'confirmed' ? 'text-emerald-500' : i.status === 'declined' || i.status === 'cancelled' ? 'text-red-500' : 'text-amber-500')}>
                      {INTERVIEW_STATUS_LABELS[i.status]}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Add to calendar" onClick={() => downloadIcs(`Interview: ${name} – ${job.title}`, i)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    {(i.status === 'proposed' || i.status === 'confirmed') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Cancel interview" onClick={() => run(() => updateInterview(i.id, { status: 'cancelled' }), 'Interview cancelled')}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* Notes */}
            <section className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team notes (private)</Label>
              {notes.map((n) => (
                <div key={n.id} className="rounded-2xl bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold">{n.author?.full_name || n.author?.username || 'Team member'} <span className="text-muted-foreground font-normal">· {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span></p>
                    {n.author_id === user?.id && (
                      <button className="text-muted-foreground hover:text-red-500" onClick={() => run(async () => { await deleteNote(n.id); setNotes(await fetchNotes(a.id)); })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note only your team can see…" className="min-h-[60px]" maxLength={2000} />
                <Button onClick={submitNote} disabled={busy || !noteDraft.trim()} className="self-end rounded-xl">Add</Button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <RejectDialog open={rejectOpen} name={name} onCancel={() => setRejectOpen(false)} onConfirm={confirmReject} />
    </>
  );
};
