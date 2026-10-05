import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, FileText, Camera, Languages, Upload, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Highlights {
  showreel_url: string | null;
  showreel_title: string | null;
  languages: string[];
  gear: string[];
  cv_path: string | null;
  cv_public: boolean;
  hidden_sections: string[];
}

const EMPTY: Highlights = { showreel_url: null, showreel_title: null, languages: [], gear: [], cv_path: null, cv_public: false, hidden_sections: [] };

/** Loads one person's highlights (the database only returns them when the viewer may see this profile). */
export const useProfileHighlights = (userId?: string) => {
  const [data, setData] = useState<Highlights>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data: row } = await (supabase as any).from('profile_highlights').select('*').eq('user_id', userId).maybeSingle();
    setData(row ? { ...EMPTY, ...row } : EMPTY);
    setLoaded(true);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);
  return { highlights: data, loaded, reload: load };
};

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1] || null;

const openCv = async (path: string, toast: any) => {
  const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path.replace(/^resumes:/, ''), 300);
  if (error || !data?.signedUrl) {
    toast({ title: 'Could not open the file', variant: 'destructive' });
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
};

/** The pinned showreel, languages, gear and CV at the top of a profile. */
export const ProfileHighlights = ({ highlights, isOwn, onEdit }: { highlights: Highlights; isOwn: boolean; onEdit?: () => void }) => {
  const { toast } = useToast();
  const h = highlights;
  const hasAny = !!h.showreel_url || h.languages.length > 0 || h.gear.length > 0 || (h.cv_path && (h.cv_public || isOwn));

  if (!hasAny) {
    return isOwn ? (
      <button onClick={onEdit} className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-left hover:bg-primary/10 transition-colors">
        <p className="font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Add your highlights</p>
        <p className="text-sm text-muted-foreground">Pin a showreel, list your gear and languages, and share a CV.</p>
      </button>
    ) : null;
  }

  const yt = h.showreel_url ? youtubeId(h.showreel_url) : null;

  return (
    <div className="rounded-2xl border bg-card/40 backdrop-blur-md overflow-hidden">
      <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-0">
        {h.showreel_url && (
          <a href={h.showreel_url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-muted group">
            {yt ? (
              <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
              <span className="h-14 w-14 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl"><Play className="h-6 w-6 fill-current ml-0.5" /></span>
            </div>
            <span className="absolute bottom-2 left-3 right-3 text-white text-sm font-bold drop-shadow line-clamp-1">{h.showreel_title || 'Showreel'}</span>
          </a>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Highlights</p>
            {isOwn && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>Edit</Button>}
          </div>
          {h.languages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" />
              {h.languages.map(l => <span key={l} className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5">{l}</span>)}
            </div>
          )}
          {h.gear.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Camera className="h-4 w-4 text-muted-foreground" />
              {h.gear.map(g => <span key={g} className="rounded-full border text-xs px-2.5 py-0.5">{g}</span>)}
            </div>
          )}
          {h.cv_path && (h.cv_public || isOwn) && (
            <Button size="sm" variant="outline" onClick={() => openCv(h.cv_path!, toast)}>
              <FileText className="h-4 w-4 mr-1.5" /> {isOwn && !h.cv_public ? 'My CV (private)' : 'Download CV'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const SECTIONS: [string, string][] = [
  ['posts', 'Posts'], ['portfolio', 'Portfolio'], ['projects', 'Projects'], ['announcements', 'Announcements'],
  ['credits', 'Credits'], ['skills', 'Skills'], ['experience', 'Experience'], ['awards', 'Awards & press'],
];

/** Edit the highlights: showreel, languages, gear, CV and which sections visitors see. */
export const ProfileHighlightsDialog = ({ open, onOpenChange, userId, current, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string; current: Highlights; onSaved: () => void;
}) => {
  const { toast } = useToast();
  const [reel, setReel] = useState('');
  const [reelTitle, setReelTitle] = useState('');
  const [languages, setLanguages] = useState('');
  const [gear, setGear] = useState('');
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvPublic, setCvPublic] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReel(current.showreel_url || '');
    setReelTitle(current.showreel_title || '');
    setLanguages(current.languages.join(', '));
    setGear(current.gear.join(', '));
    setCvPath(current.cv_path);
    setCvPublic(current.cv_public);
    setHidden(current.hidden_sections);
  }, [open, current]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Please choose a file up to 10 MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('resumes').upload(path, file, { cacheControl: '31536000', upsert: false });
    setUploading(false);
    if (error) {
      toast({ title: 'Could not upload the file', description: error.message, variant: 'destructive' });
      return;
    }
    setCvPath(`resumes:${path}`);
  };

  const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from('profile_highlights').upsert({
      user_id: userId,
      showreel_url: reel.trim() || null,
      showreel_title: reelTitle.trim() || null,
      languages: split(languages),
      gear: split(gear),
      cv_path: cvPath,
      cv_public: !!cvPath && cvPublic,
      hidden_sections: hidden,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your highlights</DialogTitle>
          <DialogDescription>What visitors see first on your profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Showreel link (https)</Label>
            <Input value={reel} onChange={e => setReel(e.target.value)} placeholder="https://youtu.be/..." maxLength={300} />
            <Input value={reelTitle} onChange={e => setReelTitle(e.target.value)} placeholder="Title, e.g. Showreel 2026" maxLength={100} />
          </div>
          <div className="space-y-1">
            <Label>Languages (comma separated)</Label>
            <Input value={languages} onChange={e => setLanguages(e.target.value)} placeholder="Telugu, Hindi, English" />
          </div>
          <div className="space-y-1">
            <Label>Gear (comma separated)</Label>
            <Input value={gear} onChange={e => setGear(e.target.value)} placeholder="ARRI Alexa Mini, Sony FX6, DJI Ronin" />
          </div>
          <div className="space-y-2">
            <Label>CV</Label>
            {cvPath ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> CV uploaded</span>
                <Button size="sm" variant="ghost" onClick={() => { setCvPath(null); setCvPublic(false); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload a PDF or document (up to 10 MB)'}
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => upload(e.target.files?.[0])} />
              </label>
            )}
            {cvPath && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cvPublic} onChange={e => setCvPublic(e.target.checked)} /> Let visitors download my CV
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sections visitors can see</Label>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(([k, l]) => {
                const shown = !hidden.includes(k);
                return (
                  <button key={k} onClick={() => setHidden(shown ? [...hidden, k] : hidden.filter(x => x !== k))}
                    className={cn('px-3 py-1 rounded-full text-xs font-semibold border transition-colors', shown ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground line-through')}>
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Tap a section to hide or show it on your public profile. You always see everything.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
