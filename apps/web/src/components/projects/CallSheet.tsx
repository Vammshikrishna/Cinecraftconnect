import { useState } from 'react';
import { useProjectCallSheets } from '@/hooks/useProjectCallSheets';
import {
  STORAGE_BUCKETS,
  PROJECT_FILE_FOLDERS,
  buildProjectFilePath,
  signAndDownload,
} from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  FileText,
  Download,
  Trash2,
  Upload,
  MapPin,
  User,
  Phone,
  Loader2,
  Info,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceEmpty, WorkspaceHero } from './WorkspaceUI';
import { useProjectBudget } from '@/hooks/useProjectBudget';
import { CalendarDays, Copy, ExternalLink, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { confirmDialog } from '@/lib/confirmDialog';

interface CallSheetProps {
  project_id: string;
}

const CallSheet = ({ project_id }: CallSheetProps) => {
  const { isInternal } = useAppRole();
  const { toast } = useToast();

  const { callSheets, isLoading, error, createCallSheet, deleteCallSheet, updateCallSheet } =
    useProjectCallSheets(project_id);

  // A call sheet belongs to the schedule phase whose dates include its day
  const { scheduleData } = useProjectBudget(project_id);
  const phaseFor = (day: string) => {
    if (!day) return null;
    const t = new Date(day).setHours(0, 0, 0, 0);
    const inside = scheduleData.filter((p) => {
      const a = new Date(p.start_date).setHours(0, 0, 0, 0);
      const b = p.end_date ? new Date(p.end_date).setHours(0, 0, 0, 0) : a;
      return t >= a && t <= b;
    });
    return inside.sort((x, y) => new Date(y.start_date).getTime() - new Date(x.start_date).getTime())[0] || null;
  };

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────
  const [date, setDate] = useState('');
  const [callTime, setCallTime] = useState('');
  const [location, setLocation] = useState('');
  const [director, setDirector] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [producer, setProducer] = useState('');
  const [producerPhone, setProducerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setDate('');
    setCallTime('');
    setLocation('');
    setDirector('');
    setDirectorPhone('');
    setProducer('');
    setProducerPhone('');
    setNotes('');
    setSelectedFile(null);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEdit = (sheet: (typeof callSheets)[number]) => {
    setEditingId(sheet.id);
    setDate(sheet.date ? String(sheet.date).slice(0, 10) : '');
    setCallTime(sheet.call_time ? sheet.call_time.split(':').slice(0, 2).join(':') : '');
    setLocation(sheet.location || '');
    setDirector(sheet.director || '');
    setDirectorPhone(sheet.director_phone || '');
    setProducer(sheet.producer || '');
    setProducerPhone(sheet.producer_phone || '');
    setNotes(sheet.notes || '');
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!date) {
      toast({ title: 'Error', description: 'Date is required', variant: 'destructive' });
      return;
    }
    if (editingId) {
      updateCallSheet.mutate(
        { id: editingId, date, call_time: callTime || null, location, director, director_phone: directorPhone, producer, producer_phone: producerPhone, notes },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } }
      );
      return;
    }
    createCallSheet.mutate(
      {
        date,
        call_time: callTime || null,
        location,
        director,
        director_phone: directorPhone,
        producer,
        producer_phone: producerPhone,
        notes,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !date) {
      toast({ title: 'Error', description: 'Date and file are required', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { uploadFileToSupabase } = await import('@/utils/fileValidation');
      const { url, error: uploadError } = await uploadFileToSupabase(
        selectedFile,
        STORAGE_BUCKETS.PROJECT_FILES,
        `${PROJECT_FILE_FOLDERS.CALL_SHEETS}/${project_id}`
      );
      
      if (uploadError || !url) throw new Error(uploadError || 'Failed to upload file');

      createCallSheet.mutate(
        { date, notes: `Uploaded file: ${url}` },
        {
          onSuccess: () => {
            setUploadDialogOpen(false);
            resetForm();
          },
        }
      );
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to upload call sheet', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    const ok = await signAndDownload(url, STORAGE_BUCKETS.PROJECT_FILES, fileName);
    if (ok) {
      toast({ title: 'Success', description: 'Downloading ' + fileName });
    } else {
      toast({ title: 'Error', description: 'Could not generate download link', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog('Delete this call sheet?')) return;
    deleteCallSheet.mutate(id);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (error) {
    return (
      <div className="p-8 text-destructive bg-red-500/10 rounded-2xl border border-red-500/20 m-4">
        Error loading call sheets: {(error as Error).message}
      </div>
    );
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const dayState = (d: string) => {
    const t = new Date(d); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t.getTime() - startOfToday.getTime()) / dayMs);
    return diff === 0 ? 'today' : diff > 0 ? 'upcoming' : 'wrapped';
  };
  const upcomingSheets = callSheets.filter((c) => dayState(c.date) !== 'wrapped');
  const nextSheet = [...upcomingSheets].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())[0];
  const nextIn = nextSheet ? Math.round((new Date(nextSheet.date).setHours(0, 0, 0, 0) - startOfToday.getTime()) / dayMs) : null;
  const places = new Set(callSheets.map((c) => c.location).filter(Boolean)).size;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 h-full overflow-y-auto w-full no-scrollbar bg-transparent">
      <div className="max-w-6xl mx-auto space-y-6">
      <WorkspaceHero
        icon={CalendarDays}
        title="Call sheets"
        description="The plan for each shooting day."
        stats={[
          { label: 'Shoot days', value: callSheets.length },
          { label: 'Coming up', value: upcomingSheets.length, tone: 'primary' },
          { label: 'Next shoot', value: nextIn === null ? '—' : nextIn === 0 ? 'Today' : nextIn === 1 ? 'Tomorrow' : `In ${nextIn} days`, tone: 'warn' },
          { label: 'Locations', value: places },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">

        {!isInternal ? (
          <div className="flex gap-3 w-full sm:w-auto">
            {/* Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/80 text-white rounded-2xl px-6 h-12 font-bold shadow-sm transition">
                  <Plus className="h-5 w-5 mr-2" /> Create New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl w-[95vw] bg-card border border-border p-0 rounded-2xl overflow-hidden shadow-md">
                <DialogHeader className="p-6 border-b border-border">
                  <DialogTitle className="text-xl font-bold text-foreground">{editingId ? 'Edit call sheet' : 'New call sheet'}</DialogTitle>
                  <DialogDescription className="text-muted-foreground mt-1">
                    {editingId ? 'Change anything below and save.' : 'Plan the shooting day: when, where and who to call.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Production Date</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                      {date && (() => {
                        const p = phaseFor(date);
                        return p
                          ? <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" /> Part of the phase <span className="font-medium text-foreground">{p.title}</span></p>
                          : <p className="text-xs text-muted-foreground mt-1.5">{scheduleData.length > 0 ? 'This day is not inside any scheduled phase.' : 'No phases scheduled yet.'}</p>;
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">General Call Time</Label>
                      <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Location Details</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Studio 42, Los Angeles" className="bg-background border-border rounded-xl h-12" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Director</Label>
                      <Input value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Name" className="bg-background border-border rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Director Mobile</Label>
                      <Input value={directorPhone} onChange={(e) => setDirectorPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-background border-border rounded-xl h-12" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Producer</Label>
                      <Input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Name" className="bg-background border-border rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Producer Mobile</Label>
                      <Input value={producerPhone} onChange={(e) => setProducerPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-background border-border rounded-xl h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Safety & Talent Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions for cast and crew..." className="bg-background border-border rounded-xl min-h-[120px] resize-none" />
                  </div>
                  <Button onClick={handleCreate} disabled={createCallSheet.isPending || updateCallSheet.isPending} className="w-full bg-primary hover:bg-primary/80 h-12 rounded-xl font-semibold text-base shadow-sm">
                    {createCallSheet.isPending || updateCallSheet.isPending ? <Loader2 className="animate-spin" /> : editingId ? 'Save changes' : 'Create call sheet'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none border-border bg-card hover:bg-accent/50 text-foreground rounded-2xl px-6 h-12 font-bold transition">
                  <Upload className="h-5 w-5 mr-2" /> Upload PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md bg-card border border-border p-0 rounded-2xl overflow-hidden shadow-md">
                <DialogHeader className="p-6 border-b border-border">
                  <DialogTitle className="text-xl font-bold text-foreground">Upload Metadata</DialogTitle>
                  <DialogDescription className="text-muted-foreground mt-1">
                    Link an existing PDF document to a production date.
                  </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Shoot Date</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Document File</Label>
                    <div className="group relative">
                      <Input type="file" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="bg-background border-border rounded-xl h-12 py-3 cursor-pointer file:bg-transparent file:text-primary file:font-bold file:border-0" />
                    </div>
                    {selectedFile && (
                      <span className="text-xs text-primary font-medium mt-2 flex items-center gap-2">
                        <Info className="w-3 h-3" /> {selectedFile.name}
                      </span>
                    )}
                  </div>
                  <Button onClick={handleUpload} disabled={uploading} className="w-full bg-primary hover:bg-primary/80 h-14 rounded-2xl font-bold text-lg shadow-sm">
                    {uploading ? <Loader2 className="animate-spin" /> : <><Upload className="h-5 w-5 mr-2" /> Confirm Upload</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="bg-muted/30 border border-border/50 px-6 py-3 rounded-2xl text-sm text-muted-foreground font-bold flex items-center gap-3">
            <Info className="w-4 h-4" /> Observation Mode
          </div>
        )}
      </div>

      {isLoading && callSheets.length === 0 ? (
        <div className="flex items-center justify-center py-24 opacity-30">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : callSheets.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start pb-24">
        <div className="space-y-6 min-w-0">
          {[...callSheets]
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
            .map((sheet, index) => {
              const time = (() => {
                if (!sheet.call_time) return null;
                const [hh, mm] = sheet.call_time.split(':');
                const h = parseInt(hh, 10);
                if (Number.isNaN(h)) return { clock: sheet.call_time, period: '' };
                return { clock: `${h % 12 || 12}:${(mm || '00').slice(0, 2)}`, period: h >= 12 ? 'PM' : 'AM' };
              })();
              const hasFile = !!sheet.notes && sheet.notes.startsWith('Uploaded file:');
              const state = dayState(sheet.date);
              return (
                <section key={sheet.id} aria-label={`Call sheet for ${formatDate(sheet.date)}`}
                  className={cn('relative overflow-hidden rounded-2xl border bg-card', state === 'today' ? 'border-primary/50 shadow-md shadow-primary/10' : 'border-border', state === 'wrapped' && 'opacity-90')}>
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', state === 'today' ? 'bg-primary' : state === 'upcoming' ? 'bg-primary/40' : 'bg-muted-foreground/25')} />

                  {/* header: which day, and the actions */}
                  <div className="flex items-start justify-between gap-3 pl-6 pr-3 pt-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        Day {callSheets.length - index}
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', state === 'today' ? 'bg-primary text-primary-foreground' : state === 'upcoming' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                          {state === 'today' ? 'Today' : state === 'upcoming' ? 'Upcoming' : 'Wrapped'}
                        </span>
                        {phaseFor(sheet.date) && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium border border-border text-foreground/80 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {phaseFor(sheet.date)!.title}
                          </span>
                        )}
                      </p>
                      <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5">{formatDate(sheet.date)}</h2>
                    </div>
                    {!isInternal && (
                      <div className="flex shrink-0">
                        {!hasFile && (
                          <Button aria-label={`Edit the call sheet for ${formatDate(sheet.date)}`} size="icon" variant="ghost" onClick={() => handleEdit(sheet)} className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button aria-label={`Delete the call sheet for ${formatDate(sheet.date)}`} size="icon" variant="ghost" onClick={() => handleDelete(sheet.id)} className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* body: the call time stands out, then where and who */}
                  <div className="pl-6 pr-4 pb-4 pt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                    {time ? (
                      <div className="rounded-xl bg-primary/10 px-5 py-4 text-center sm:min-w-[132px] self-start">
                        <p className="text-xs font-medium text-primary/80 flex items-center justify-center gap-1.5"><Clock className="h-3.5 w-3.5" /> General call</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-foreground leading-none">{time.clock}<span className="ml-1 text-sm font-semibold text-muted-foreground">{time.period}</span></p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-muted/50 px-5 py-4 text-center sm:min-w-[132px] self-start">
                        <p className="text-xs font-medium text-muted-foreground">General call</p>
                        <p className="mt-1 text-sm text-muted-foreground">Not set</p>
                      </div>
                    )}

                    <div className="min-w-0 space-y-3">
                      {sheet.location && (
                        <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="text-sm font-medium text-foreground break-words">{sheet.location}</p>
                          </div>
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sheet.location)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0">
                            Map <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {(sheet.director || sheet.producer) && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            sheet.director ? { role: 'Director', name: sheet.director, phone: sheet.director_phone } : null,
                            sheet.producer ? { role: 'Producer', name: sheet.producer, phone: sheet.producer_phone } : null,
                          ].filter(Boolean).map((p) => (
                            <div key={p!.role} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                              <span className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0">{p!.name.charAt(0).toUpperCase()}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{p!.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{p!.phone ? `${p!.role} · ${p!.phone}` : p!.role}</p>
                              </div>
                              {p!.phone && (
                                <a href={`tel:${p!.phone}`} aria-label={`Call ${p!.name}`} className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0 hover:bg-primary/90 transition-colors">
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {sheet.notes && (
                        hasFile ? (
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3.5 py-2.5">
                            <span className="flex items-center gap-2.5 text-sm font-medium"><FileText className="h-4 w-4 text-muted-foreground" /> Uploaded call sheet</span>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5" onClick={() => handleDownload(sheet.notes!.replace('Uploaded file: ', ''), `CallSheet_${formatDate(sheet.date)}.pdf`)}>
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-muted/50 px-3.5 py-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Notes</p>
                            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">{sheet.notes}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><CalendarDays className="h-4 w-4 text-primary" /> Next shoot</h2>
            {nextSheet ? (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                <p className="text-3xl font-bold tabular-nums leading-none text-primary">{nextIn === 0 ? 'Today' : nextIn === 1 ? 'Tomorrow' : `${nextIn} days`}</p>
                <p className="text-sm font-medium text-foreground mt-2">{formatDate(nextSheet.date)}</p>
                {nextSheet.call_time && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Call at {nextSheet.call_time.split(':').slice(0, 2).join(':')}</p>}
                {nextSheet.location && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {nextSheet.location}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming shoot day. Create a call sheet to plan the next one.</p>
            )}
          </div>
          {(() => {
            // the people for the shoot that matters now: the next one, or else the latest
            const sheet = nextSheet || [...callSheets].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
            const people = [
              sheet?.director ? { role: 'Director', name: sheet.director, phone: sheet.director_phone } : null,
              sheet?.producer ? { role: 'Producer', name: sheet.producer, phone: sheet.producer_phone } : null,
            ].filter(Boolean) as { role: string; name: string; phone?: string | null }[];
            if (!sheet || people.length === 0) return null;
            return (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Who to call</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">For {formatDate(sheet.date)}</p>
                <ul className="space-y-4">
                  {people.map((c) => (
                    <li key={c.role} className="flex items-center gap-3">
                      <span className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0">{c.name.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone ? `${c.role} · ${c.phone}` : `${c.role} · no number added`}</p>
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            aria-label={`Copy ${c.name}'s number`}
                            onClick={() => { navigator.clipboard?.writeText(c.phone!).then(() => toast({ title: 'Number copied' })).catch(() => {}); }}
                            className="h-9 w-9 rounded-full bg-muted grid place-items-center hover:bg-muted/70 transition-colors"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:bg-primary/90 transition-colors">
                            <Phone className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </aside>
        </div>
      ) : (
        <WorkspaceEmpty
          icon={FileText}
          title="No call sheets yet"
          description="Create a call sheet for a shooting day, or upload one you already have."
        />
      )}
      </div>
    </div>
  );
};

export default CallSheet;
