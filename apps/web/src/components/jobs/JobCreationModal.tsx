import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Plus, Briefcase, User, Building2, Trash2, GripVertical, CalendarClock, Wallet, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useJobMutation } from '@/hooks/mutations/useJobMutation';
import { useMyPages } from '@/hooks/useCompanyPages';
import {
  Job, JobType, ExperienceLevel, WorkMode, PayPeriod, ScreeningQuestion,
  JOB_TYPES, EXPERIENCE_LEVELS, WORK_MODES, PAY_PERIODS, JOB_TYPE_LABELS, EXPERIENCE_LABELS, WORK_MODE_LABELS,
  PAY_PERIOD_LABELS, DEPARTMENTS, CURRENCIES,
} from '@/types/jobs';
import { validateJobForm, normalizeScreeningQuestions, MAX_SCREENING_QUESTIONS } from '@cinecraft/core';

interface JobCreationModalProps {
  onJobCreated?: () => void;
  defaultOpen?: boolean;
  defaultPageId?: string;
  triggerButton?: React.ReactNode;
  /** Edit an existing posting (keeps its id). */
  jobToEdit?: Job;
  /** Start a NEW posting pre-filled from an existing one ("Duplicate"). */
  duplicateFrom?: Job;
}

interface FormState {
  title: string;
  description: string;
  company: string;
  location: string;
  type: JobType | '';
  department: string;
  work_mode: WorkMode;
  experience_level: ExperienceLevel | '';
  requirements: string;
  currency: string;
  salary_min: string;
  salary_max: string;
  pay_period: PayPeriod | '';
  deadline: string; // datetime-local
  shoot_start: string; // date
  shoot_end: string;
  openings: string;
  auto_close_on_hire: boolean;
  screening_questions: ScreeningQuestion[];
}

const EMPTY: FormState = {
  title: '', description: '', company: '', location: '', type: '', department: '', work_mode: 'onsite', experience_level: '',
  requirements: '', currency: 'INR', salary_min: '', salary_max: '', pay_period: '', deadline: '', shoot_start: '', shoot_end: '',
  openings: '1', auto_close_on_hire: false, screening_questions: [],
};

const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromJob = (j: Job): FormState => ({
  title: j.title || '',
  description: j.description || '',
  company: j.company || j.company_pages?.name || '',
  location: j.location || '',
  type: (j.type as JobType) || '',
  department: j.department || '',
  work_mode: (j.work_mode as WorkMode) || 'onsite',
  experience_level: (j.experience_level as ExperienceLevel) || '',
  requirements: j.requirements || '',
  currency: j.currency || 'INR',
  salary_min: j.salary_min != null ? String(j.salary_min) : '',
  salary_max: j.salary_max != null ? String(j.salary_max) : '',
  pay_period: (j.pay_period as PayPeriod) || '',
  deadline: toLocalInput(j.deadline),
  shoot_start: j.shoot_start || '',
  shoot_end: j.shoot_end || '',
  openings: String(j.openings ?? 1),
  auto_close_on_hire: !!j.auto_close_on_hire,
  screening_questions: normalizeScreeningQuestions(j.screening_questions),
});

export const JobCreationModal = ({
  onJobCreated, defaultOpen = false, defaultPageId = 'user', triggerButton, jobToEdit, duplicateFrom,
}: JobCreationModalProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: myPages } = useMyPages();
  const { createJob, updateJob } = useJobMutation();
  const [selectedPageId, setSelectedPageId] = useState<string | 'user'>(jobToEdit?.page_id || duplicateFrom?.page_id || defaultPageId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const source = jobToEdit || duplicateFrom;
  const isEditing = !!jobToEdit?.id;
  const editingDraft = isEditing && !!jobToEdit?.is_draft;

  useEffect(() => {
    if (defaultOpen) setIsOpen(true);
  }, [defaultOpen]);

  // (Re)load the form every time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (source) {
      const f = fromJob(source);
      // A duplicate starts fresh: new title marker and no old deadline.
      if (duplicateFrom && !jobToEdit) {
        f.title = `${f.title} (copy)`;
        f.deadline = '';
      }
      setForm(f);
      setSelectedPageId(source.page_id || 'user');
    } else {
      setForm(EMPTY);
      setSelectedPageId(defaultPageId);
    }
  }, [isOpen, source?.id, defaultPageId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const handlePageChange = (value: string) => {
    setSelectedPageId(value);
    if (value !== 'user') {
      const page = myPages?.find((p) => p.id === value);
      if (page) set('company', page.name);
    }
  };

  // ── screening questions ───────────────────────────────────────────────────────────────────────────────────────
  const addQuestion = () => {
    if (form.screening_questions.length >= MAX_SCREENING_QUESTIONS) return;
    set('screening_questions', [
      ...form.screening_questions,
      { id: `q${Date.now().toString(36)}`, label: '', type: 'text', required: true },
    ]);
  };
  const updateQuestion = (id: string, patch: Partial<ScreeningQuestion>) =>
    set('screening_questions', form.screening_questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removeQuestion = (id: string) => set('screening_questions', form.screening_questions.filter((q) => q.id !== id));

  const previewErrors = useMemo(() => errors, [errors]);

  const buildPayload = (asDraft: boolean) => ({
    title: form.title.trim(),
    description: form.description.trim(),
    company: form.company.trim(),
    location: form.location.trim() || null,
    type: form.type || 'full-time',
    department: form.department || null,
    work_mode: form.work_mode,
    experience_level: form.experience_level || 'mid',
    requirements: form.requirements.trim() || null,
    currency: form.currency || 'INR',
    salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
    salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
    pay_period: form.salary_min !== '' || form.salary_max !== '' ? form.pay_period || null : null,
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    shoot_start: form.shoot_start || null,
    shoot_end: form.shoot_end || null,
    openings: Math.max(1, Math.min(500, parseInt(form.openings || '1', 10) || 1)),
    screening_questions: normalizeScreeningQuestions(form.screening_questions),
    auto_close_on_hire: form.auto_close_on_hire,
    page_id: selectedPageId === 'user' ? null : selectedPageId,
    is_draft: asDraft,
    // a draft is never visible; publishing (re)opens the posting
    is_active: !asDraft,
  });

  const save = async (asDraft: boolean) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to post a job.', variant: 'destructive' });
      return;
    }
    const found = validateJobForm(
      {
        title: form.title, company: form.company, description: form.description,
        salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
        pay_period: form.pay_period || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        shoot_start: form.shoot_start || null, shoot_end: form.shoot_end || null,
        openings: parseInt(form.openings || '1', 10),
      },
      asDraft
    );
    // Every screening question needs text.
    if (form.screening_questions.some((q) => !q.label.trim())) found.screening = 'Every screening question needs some text (or remove it).';
    if (form.screening_questions.some((q) => q.type === 'choice' && (q.options || []).filter(Boolean).length < 2)) {
      found.screening = 'A multiple-choice question needs at least two options.';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
      return;
    }

    setSaving(asDraft ? 'draft' : 'publish');
    try {
      const payload = buildPayload(asDraft);
      if (!navigator.onLine) {
        // Offline: queue it and sync later.
        if (isEditing) await updateJob(jobToEdit!.id, payload);
        else await createJob(payload);
        toast({ title: 'Saved offline', description: 'It will be posted as soon as you are back online.' });
      } else if (isEditing) {
        const { error } = await supabase.from('jobs').update(payload as any).eq('id', jobToEdit!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('jobs').insert({ ...payload, posted_by: user.id } as any);
        if (error) throw error;
      }

      if (navigator.onLine) {
        toast({
          title: asDraft ? 'Draft saved' : isEditing && !editingDraft ? 'Job updated' : 'Job published',
          description: asDraft ? 'Only you can see it until you publish.' : 'Your posting is live.',
        });
      }
      setIsOpen(false);
      onJobCreated?.();
    } catch (error: any) {
      console.error('Error saving job:', error);
      toast({ title: 'Could not save the job', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const fieldError = (key: string) =>
    previewErrors[key] ? <p className="text-xs text-red-500 font-medium mt-1">{previewErrors[key]}</p> : null;
  const invalid = (key: string) => (previewErrors[key] ? 'border-red-500/60 focus-visible:ring-red-500/30' : '');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm">
            <Plus className="mr-2 h-4 w-4" />
            <span>{isEditing ? 'Edit Job' : 'Post a Job'}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] max-h-[88vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Briefcase className="mr-2 h-5 w-5" />
            {isEditing ? (editingDraft ? 'Finish your draft' : 'Edit job posting') : duplicateFrom ? 'Duplicate job posting' : 'Post a new job'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this posting.' : 'Tell crew what you need. You can save a draft and publish later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); void save(false); }} className="space-y-7">
          {/* Posting identity */}
          <div className="space-y-2 pb-4 border-b border-border/50">
            <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Post job as</Label>
            <Select value={selectedPageId} onValueChange={handlePageChange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">
                  <div className="flex items-center gap-2 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user?.user_metadata?.avatar_url} />
                      <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Personal identity</span>
                  </div>
                </SelectItem>
                {(myPages || []).map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    <div className="flex items-center gap-2 py-1 text-primary">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={page.logo_url || ''} />
                        <AvatarFallback><Building2 className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{page.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* The role */}
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> The role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Job title *</Label>
                <Input id="title" className={invalid('title')} placeholder="e.g. 1st AC, Sound Designer" value={form.title} onChange={(e) => set('title', e.target.value)} />
                {fieldError('title')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company / production *</Label>
                <Input id="company" className={invalid('company')} placeholder="Company or production name" value={form.company} onChange={(e) => set('company', e.target.value)} />
                {fieldError('company')}
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={form.department || 'none'} onValueChange={(v) => set('department', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Job type</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as JobType)}>
                  <SelectTrigger><SelectValue placeholder="Select job type" /></SelectTrigger>
                  <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Experience level</Label>
                <Select value={form.experience_level} onValueChange={(v) => set('experience_level', v as ExperienceLevel)}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>{EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{EXPERIENCE_LABELS[l]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Where will they work?</Label>
                <Select value={form.work_mode} onValueChange={(v) => set('work_mode', v as WorkMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WORK_MODES.map((m) => <SelectItem key={m} value={m}>{WORK_MODE_LABELS[m]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g. Hyderabad, Telangana" value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Job description *</Label>
              <Textarea id="description" className={`min-h-[120px] ${invalid('description')}`} placeholder="Describe the role, responsibilities and shooting schedule…" value={form.description} onChange={(e) => set('description', e.target.value)} />
              {fieldError('description')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirements">Requirements &amp; qualifications</Label>
              <Textarea id="requirements" className="min-h-[90px]" placeholder="Skills, equipment, licences, portfolio expectations…" value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Skills named here are used to rank applicants by match.</p>
            </div>
          </section>

          {/* Pay */}
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> Pay</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} {c.symbol.trim()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salary_min">Minimum</Label>
                <Input id="salary_min" type="number" min={0} className={invalid('salary_min')} placeholder="e.g. 4000" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} />
                {fieldError('salary_min')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salary_max">Maximum</Label>
                <Input id="salary_max" type="number" min={0} className={invalid('salary_max')} placeholder="e.g. 6000" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} />
                {fieldError('salary_max')}
              </div>
              <div className="space-y-1.5">
                <Label>Counted</Label>
                <Select value={form.pay_period || 'none'} onValueChange={(v) => set('pay_period', v === 'none' ? '' : (v as PayPeriod))}>
                  <SelectTrigger className={invalid('pay_period')}><SelectValue placeholder="Per…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {PAY_PERIODS.map((p) => <SelectItem key={p} value={p}>{PAY_PERIOD_LABELS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError('pay_period')}
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5" /> Schedule &amp; openings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Apply by</Label>
                <Input id="deadline" type="datetime-local" className={invalid('deadline')} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
                {fieldError('deadline') || <p className="text-[11px] text-muted-foreground">The posting closes automatically at this time.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openings">Openings</Label>
                <Input id="openings" type="number" min={1} max={500} className={invalid('openings')} value={form.openings} onChange={(e) => set('openings', e.target.value)} />
                {fieldError('openings')}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shoot_start">Shoot starts</Label>
                <Input id="shoot_start" type="date" value={form.shoot_start} onChange={(e) => set('shoot_start', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shoot_end">Shoot ends</Label>
                <Input id="shoot_end" type="date" className={invalid('shoot_end')} value={form.shoot_end} onChange={(e) => set('shoot_end', e.target.value)} />
                {fieldError('shoot_end')}
              </div>
            </div>
          </section>

          {/* Screening */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ListChecks className="w-3.5 h-3.5" /> Screening questions <span className="font-medium normal-case tracking-normal">(optional, up to {MAX_SCREENING_QUESTIONS})</span></h3>
              <Button type="button" variant="outline" size="sm" className="rounded-full h-8" onClick={addQuestion} disabled={form.screening_questions.length >= MAX_SCREENING_QUESTIONS}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add question
              </Button>
            </div>
            {form.screening_questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 mt-2.5 text-muted-foreground/40 shrink-0" />
                  <Input value={q.label} placeholder={`Question ${i + 1}, e.g. Do you own an Alexa Mini?`} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-500 hover:bg-red-500/10" onClick={() => removeQuestion(q.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 pl-6">
                  <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, { type: v as ScreeningQuestion['type'], options: v === 'choice' ? q.options || ['', ''] : undefined })}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short answer</SelectItem>
                      <SelectItem value="yesno">Yes / No</SelectItem>
                      <SelectItem value="choice">Multiple choice</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <Switch checked={q.required} onCheckedChange={(c) => updateQuestion(q.id, { required: c })} /> Required
                  </label>
                </div>
                {q.type === 'choice' && (
                  <Input
                    className="ml-6 w-[calc(100%-1.5rem)]"
                    placeholder="Options, separated by commas (e.g. Yes, No, Rent it)"
                    value={(q.options || []).join(', ')}
                    onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(',').map((s) => s.trimStart()) })}
                  />
                )}
              </div>
            ))}
            {fieldError('screening')}
          </section>

          <div className="flex items-center space-x-3 py-1">
            <Switch id="auto-close" checked={form.auto_close_on_hire} onCheckedChange={(c) => set('auto_close_on_hire', c)} />
            <div className="space-y-0.5">
              <Label htmlFor="auto-close" className="font-bold">Auto-close when filled</Label>
              <p className="text-xs text-muted-foreground">Closes the posting when you mark an applicant as Hired.</p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              {(!isEditing || editingDraft) && (
                <Button type="button" variant="outline" disabled={!!saving} onClick={() => void save(true)}>
                  {saving === 'draft' ? 'Saving…' : 'Save draft'}
                </Button>
              )}
              <Button type="submit" disabled={!!saving}>
                {saving === 'publish' ? 'Publishing…' : isEditing && !editingDraft ? 'Save changes' : 'Publish job'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
