import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Link2, Loader2, Trash2, PlayCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS, buildUserFilePath } from '@/lib/storage';
import { toEmbedUrl } from '@/lib/jobs/showreel';

const db = supabase as any;

/** Gallery photos and showreel links for a company page. Everyone sees them; managers add and remove. */
export const PageShowcase = ({ pageId, canManage }: { pageId: string; canManage: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['page-showcase', pageId],
    queryFn: async () => {
      const { data } = await db.from('company_page_showcase').select('id, kind, url, caption, created_at').eq('page_id', pageId).order('created_at', { ascending: false });
      return (data || []) as { id: string; kind: 'image' | 'video'; url: string; caption: string | null }[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['page-showcase', pageId] });

  const insert = async (kind: 'image' | 'video', url: string) => {
    const { error } = await db.from('company_page_showcase').insert({ page_id: pageId, kind, url, added_by: user?.id });
    if (error) throw error;
  };

  const addImage = async (file: File | null) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return toast({ title: 'Pick an image', variant: 'destructive' });
    if (file.size > 12 * 1024 * 1024) return toast({ title: 'Image too large', description: 'Up to 12 MB.', variant: 'destructive' });
    setBusy(true);
    try {
      const { compressImage } = await import('@/utils/imageCompression');
      const small = await compressImage(file);
      const ext = small.name.split('.').pop();
      const path = buildUserFilePath(`pages/${user.id}`, `showcase-${Date.now()}.${ext}`);
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.AVATARS).upload(path, small, { cacheControl: '31536000', upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(path);
      await insert('image', publicUrl);
      refresh();
    } catch (e: any) {
      toast({ title: 'Could not add the photo', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addVideo = async () => {
    const url = link.trim();
    if (!/^https:\/\//i.test(url)) return toast({ title: 'Paste a link that starts with https://', variant: 'destructive' });
    setBusy(true);
    try {
      await insert('video', url);
      setLink('');
      refresh();
    } catch (e: any) {
      toast({ title: 'Could not add the link', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this from the showcase?')) return;
    const { error } = await db.from('company_page_showcase').delete().eq('id', id);
    if (error) return toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
    refresh();
  };

  const videos = items.filter((i) => i.kind === 'video');
  const images = items.filter((i) => i.kind === 'image');

  return (
    <div className="space-y-8">
      {canManage && (
        <div className="rounded-2xl border border-dashed border-border p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => addImage(e.target.files?.[0] || null)} />
          <Button variant="outline" className="rounded-xl gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Add a photo
          </Button>
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Showreel link (YouTube, Vimeo…)" value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <Button className="rounded-xl" disabled={busy || !link.trim()} onClick={addVideo}>Add</Button>
          </div>
          <p className="text-[11px] text-muted-foreground md:w-40">Up to 12 items.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[2rem] border border-dashed border-border/60 bg-card/20">
          <p className="font-black text-lg mb-1">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">{canManage ? 'Add photos and showreels to show what this company does.' : 'This company has not added a showcase yet.'}</p>
        </div>
      ) : (
        <>
          {videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {videos.map((v) => {
                const embed = toEmbedUrl(v.url);
                return (
                  <div key={v.id} className="relative group rounded-3xl overflow-hidden border border-border/60 bg-black aspect-video">
                    {embed ? (
                      <iframe src={embed} title="Showreel" className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
                    ) : (
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/80 hover:text-white">
                        <PlayCircle className="w-10 h-10" /> <span className="text-sm font-bold flex items-center gap-1">Open showreel <ExternalLink size={14} /></span>
                      </a>
                    )}
                    {canManage && (
                      <Button size="icon" variant="destructive" className="absolute top-3 right-3 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => remove(v.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="relative group aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 bg-muted">
                  <img loading="lazy" decoding="async" src={img.url} alt={img.caption || 'Company photo'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  {canManage && (
                    <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => remove(img.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
