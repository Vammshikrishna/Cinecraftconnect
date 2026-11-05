import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ImagePlus, Loader2, Lightbulb, X } from 'lucide-react';
import pkg from '../../../../package.json';
import { TICKET_TOPICS, searchHelp, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SettingsPageHeader } from '@/components/settings/SettingsUI';
import { takeScreenshots } from '@/components/settings/settingsLogic';
import { HelpBack } from '@/components/help/HelpParts';

const MAX_FILES = 3; // same value as MAX_SCREENSHOTS in settingsLogic

/** Contact support: pick a topic, see suggested answers while you type, add screenshots and (optionally) diagnostics. */
const HelpNewRequest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [topicId, setTopicId] = useState<string | null>(params.get('topic') && TICKET_TOPICS.some(t => t.id === params.get('topic')) ? params.get('topic') : null);
  const DRAFT_KEY = 'help_new_request_draft';
  const readDraft = (): { subject?: string; message?: string } => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } };
  const [subject, setSubject] = useState(() => readDraft().subject || '');
  const [message, setMessage] = useState(() => readDraft().message || '');
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, message })); } catch { /* storage unavailable */ }
  }, [subject, message]);
  const [files, setFiles] = useState<{ ref: string; name: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [diag, setDiag] = useState(true);
  const [sending, setSending] = useState(false);

  const topic = TICKET_TOPICS.find(t => t.id === topicId);
  // suggestions follow the typing after a pause, so the form below does not jump on every keystroke
  const [typed, setTyped] = useState('');
  useEffect(() => { const t = setTimeout(() => setTyped(`${subject} ${message}`), 400); return () => clearTimeout(t); }, [subject, message]);
  const suggestions = useMemo(() => searchHelp(typed, 3), [typed]);
  const previewsRef = useRef<string[]>([]);
  useEffect(() => () => { previewsRef.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const addFiles = async (list: FileList | null) => {
    if (!list || !user) return;
    // Decide up front which of the picked files fit, so picking several at once cannot exceed the cap.
    const { next: allowed, dropped } = takeScreenshots(files as unknown[], Array.from(list), MAX_FILES);
    const picked = allowed.slice(files.length) as File[];
    if (dropped > 0) toast({ title: `Only ${MAX_FILES} screenshots`, description: `${dropped} file${dropped === 1 ? ' was' : 's were'} not added.` });
    setUploading(true);
    for (const file of picked) {
      if (!file.type.startsWith('image/')) { toast({ title: 'Images only', description: 'Please attach a screenshot (PNG or JPG).', variant: 'destructive' }); continue; }
      if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Maximum 5 MB per screenshot.', variant: 'destructive' }); continue; }
      try {
        const { compressImage } = await import('@/utils/imageCompression');
        const f = await compressImage(file);
        const path = `support-attachments/${user.id}-${crypto.randomUUID()}.${(f.name.split('.').pop() || 'jpg')}`;
        const { error } = await supabase.storage.from('support').upload(path, f, { cacheControl: '31536000', upsert: false });
        if (error) throw error;
        const preview = URL.createObjectURL(file);
        previewsRef.current.push(preview);
        setFiles(prev => [...prev, { ref: `support:${path}`, name: file.name, preview }]);
      } catch (e: any) {
        toast({ title: 'Upload failed', description: friendlyError(e), variant: 'destructive' });
      }
    }
    setUploading(false);
  };

  const submit = async () => {
    if (!user || !topic) return;
    setSending(true);
    const diagnostics = diag ? {
      app: 'web', version: pkg.version, userAgent: navigator.userAgent, language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      page: window.location.pathname, online: navigator.onLine,
    } : null;
    const { data, error } = await (supabase as any).from('support_tickets').insert({
      user_id: user.id, subject: subject.trim(), message: message.trim(), category: topic.category,
      attachments: files.map(f => f.ref), attachment_url: files[0]?.ref || null, diagnostics,
    }).select('id').single();
    setSending(false);
    if (error) return toast({ title: 'Could not send your request', description: friendlyError(error), variant: 'destructive' });
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast({ title: 'Request sent', description: 'We usually reply within 24 hours. You will be notified here.' });
    navigate(`/settings/help/requests/${data.id}`);
  };

  if (!topic) {
    return (
      <>
        <HelpBack to="/settings/help" label="Help Center" />
        <SettingsPageHeader title="Contact support" description="What do you need help with?" />
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {TICKET_TOPICS.map(t => (
            <button key={t.id} onClick={() => setTopicId(t.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 active:bg-muted/70 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Looking for a quick answer? <Link to="/settings/help" className="text-primary">Search the Help Center</Link> first.</p>
      </>
    );
  }

  const ready = subject.trim().length >= 3 && message.trim().length >= 10 && !uploading;

  return (
    <>
      <button type="button" onClick={() => setTopicId(null)} className="inline-flex min-h-11 items-center gap-1 -ml-1 pr-3 text-sm text-muted-foreground hover:text-foreground active:opacity-60">← Change topic</button>
      <SettingsPageHeader title={topic.label} description={topic.tip} />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="support-subject" className="text-sm font-medium">Subject</label>
          <Input id="support-subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} placeholder="A short summary" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="support-details" className="text-sm font-medium">Details</label>
          <Textarea id="support-details" rows={7} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder={topic.placeholder} className="resize-none" />
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{message.trim().length < 10 ? 'Add at least 10 characters so we can help.' : ''}</span>
            <span>{message.length}/4000</span>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-primary" /> These articles may answer your question</p>
            {suggestions.map(a => (
              <Link key={a.id} to={`/settings/help/article/${a.id}`} className="block py-1 text-sm text-primary hover:underline">{a.title}</Link>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="support-shots" className="text-sm font-medium">Screenshots <span className="text-muted-foreground font-normal">(optional, up to {MAX_FILES})</span></label>
          <div className="flex flex-wrap gap-3">
            {files.map((f, i) => (
              <div key={f.ref} className="relative h-20 w-20 rounded-xl overflow-hidden border">
                <img src={f.preview} alt={f.name} className="h-full w-full object-cover" />
                <button type="button" aria-label={`Remove screenshot ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-0 right-0 h-9 w-9 flex items-center justify-center"><span className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="h-3.5 w-3.5" /></span></button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/40 active:bg-muted/60 focus-within:ring-2 focus-within:ring-primary/50">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <input id="support-shots" aria-label="Add screenshots" type="file" accept="image/*" multiple className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 cursor-pointer">
          <input type="checkbox" checked={diag} onChange={e => setDiag(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>
            <span className="text-base font-medium block">Include technical details</span>
            <span className="text-xs text-muted-foreground">Your browser, app version, screen size and language. This helps us fix problems faster. No messages or personal content are included.</span>
          </span>
        </label>

        <Button className="w-full h-11 rounded-xl" disabled={!ready || sending} onClick={submit}>{sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : 'Send request'}</Button>
        <p className="text-xs text-muted-foreground text-center">We usually reply within 24 hours. Safety reports and appeals are reviewed first.</p>
      </div>
    </>
  );
};

export default HelpNewRequest;
