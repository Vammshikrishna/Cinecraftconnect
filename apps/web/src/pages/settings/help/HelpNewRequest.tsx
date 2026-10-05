import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ImagePlus, Loader2, Lightbulb, X } from 'lucide-react';
import pkg from '../../../../package.json';
import { TICKET_TOPICS, searchHelp } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SettingsPageHeader } from '@/components/settings/SettingsUI';
import { HelpBack } from '@/components/help/HelpParts';

const MAX_FILES = 3;

/** Contact support: pick a topic, see suggested answers while you type, add screenshots and (optionally) diagnostics. */
const HelpNewRequest = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [topicId, setTopicId] = useState<string | null>(params.get('topic') && TICKET_TOPICS.some(t => t.id === params.get('topic')) ? params.get('topic') : null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<{ ref: string; name: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [diag, setDiag] = useState(true);
  const [sending, setSending] = useState(false);

  const topic = TICKET_TOPICS.find(t => t.id === topicId);
  const suggestions = useMemo(() => searchHelp(`${subject} ${message}`, 3), [subject, message]);

  const addFiles = async (list: FileList | null) => {
    if (!list || !user) return;
    setUploading(true);
    for (const file of Array.from(list)) {
      if (files.length >= MAX_FILES) break;
      if (!file.type.startsWith('image/')) { toast({ title: 'Images only', description: 'Please attach a screenshot (PNG or JPG).', variant: 'destructive' }); continue; }
      if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Maximum 5 MB per screenshot.', variant: 'destructive' }); continue; }
      try {
        const { compressImage } = await import('@/utils/imageCompression');
        const f = await compressImage(file);
        const path = `support-attachments/${user.id}-${crypto.randomUUID()}.${(f.name.split('.').pop() || 'jpg')}`;
        const { error } = await supabase.storage.from('support').upload(path, f, { cacheControl: '31536000', upsert: false });
        if (error) throw error;
        setFiles(prev => [...prev, { ref: `support:${path}`, name: file.name, preview: URL.createObjectURL(file) }]);
      } catch (e: any) {
        toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
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
    if (error) return toast({ title: 'Could not send your request', description: error.message, variant: 'destructive' });
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
            <button key={t.id} onClick={() => setTopicId(t.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium">{t.label}</p>
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
      <button onClick={() => setTopicId(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">← Change topic</button>
      <SettingsPageHeader title={topic.label} description={topic.tip} />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Subject</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} placeholder="A short summary" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Details</label>
          <Textarea rows={7} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder={topic.placeholder} className="resize-none" />
          <p className="text-xs text-muted-foreground text-right">{message.length}/4000</p>
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-primary" /> These articles may answer your question</p>
            {suggestions.map(a => (
              <Link key={a.id} to={`/settings/help/article/${a.id}`} target="_blank" className="block text-sm text-primary hover:underline">{a.title}</Link>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Screenshots <span className="text-muted-foreground font-normal">(optional, up to {MAX_FILES})</span></label>
          <div className="flex flex-wrap gap-3">
            {files.map((f, i) => (
              <div key={f.ref} className="relative h-20 w-20 rounded-xl overflow-hidden border">
                <img src={f.preview} alt={f.name} className="h-full w-full object-cover" />
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer text-muted-foreground hover:bg-muted/40">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 cursor-pointer">
          <input type="checkbox" checked={diag} onChange={e => setDiag(e.target.checked)} className="mt-1" />
          <span>
            <span className="text-[15px] font-medium block">Include technical details</span>
            <span className="text-xs text-muted-foreground">Your browser, app version, screen size and language. This helps us fix problems faster. No messages or personal content are included.</span>
          </span>
        </label>

        <Button className="w-full h-11 rounded-xl" disabled={!ready || sending} onClick={submit}>{sending ? 'Sending…' : 'Send request'}</Button>
        <p className="text-xs text-muted-foreground text-center">We usually reply within 24 hours. Safety reports and appeals are reviewed first.</p>
      </div>
    </>
  );
};

export default HelpNewRequest;
