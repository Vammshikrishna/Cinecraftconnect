import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS, buildUserFilePath } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, Trash2, Send, Link as LinkIcon, Upload, Loader2 } from 'lucide-react';

const IMAGE_PRESETS = [
  {
    name: '🛠️ Maintenance',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
    desc: 'Technical & update announcements'
  },
  {
    name: '🎥 Crew Spotlight',
    url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop',
    desc: 'Spotlight on creators & project news'
  },
  {
    name: '🚀 Feature Launch',
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop',
    desc: 'Announcing system feature updates'
  },
  {
    name: '🍿 Event Announcement',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop',
    desc: 'Screenings, festivals, & crowd gathers'
  }
];

export default function GlobalBroadcastPanel() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sendPush, setSendPush] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();

    // Subscribe to real-time additions/deletions in system announcements
    const channel = supabase
      .channel('admin-announcements-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_announcements' },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('system_announcements' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      setAnnouncements(data);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: "Invalid File Type", 
        description: "Please upload a valid image file (PNG, JPG, WEBP, GIF).", 
        variant: "destructive" 
      });
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: "File Too Large", 
        description: "Maximum image file size is 5MB.", 
        variant: "destructive" 
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const filePath = buildUserFilePath(
        `announcement-images/${user.id}`,
        file.name
      );

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast({ 
        title: "⚡ Image Uploaded Successfully!", 
        description: "Your custom announcement graphic is now attached." 
      });
    } catch (error: any) {
      toast({ 
        title: "Upload Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !body) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.from('system_announcements' as any).insert({
        title,
        body,
        action_url: actionUrl || null,
        image_url: imageUrl || null,
        send_push: sendPush,
        created_by: user.id
      });

      if (error) throw error;

      toast({
        title: "📢 Broadcast Dispatched!",
        description: "Your system-wide rich-media announcement has been sent in real-time."
      });
      setTitle('');
      setBody('');
      setActionUrl('');
      setImageUrl('');
      setSendPush(false);
    } catch (error: any) {
      toast({
        title: "Broadcast Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;

    const { error } = await supabase
      .from('system_announcements' as any)
      .delete()
      .eq('id', id);
      
    if (!error) {
      toast({ title: "Broadcast Deleted" });
      fetchAnnouncements();
    } else {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6 bg-card/50 border border-border/50 rounded-2xl p-6">
      <div>
        <h2 className="text-xl font-black flex items-center gap-2 mb-2 uppercase tracking-tight">
          <Megaphone className="text-primary" /> Real-time Notification Center
        </h2>
        <p className="text-muted-foreground text-sm font-medium">
          Broadcast instant popup alerts and push messages to all active creators, crew, and users.
        </p>
      </div>

      <form onSubmit={handleBroadcast} className="space-y-4 bg-background/50 p-5 rounded-xl border border-white/5">
        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Headline / Title</label>
          <Input 
            placeholder="e.g., CineCraft Connect Scheduled System Maintenance" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            required 
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Message body</label>
          <Textarea 
            placeholder="Provide important details or features to highlight to users..." 
            value={body} 
            onChange={e => setBody(e.target.value)} 
            required 
            rows={3}
            className="rounded-xl resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <LinkIcon className="w-3 h-3 text-primary" /> Action Destination URL (Optional)
          </label>
          <Input 
            placeholder="e.g., /settings/appearance or /storyboards" 
            value={actionUrl} 
            onChange={e => setActionUrl(e.target.value)} 
            className="rounded-xl font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1 block">Image Attachment</label>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Input 
                placeholder="Paste custom image URL or select a preset below..." 
                value={imageUrl} 
                onChange={e => setImageUrl(e.target.value)} 
                className="rounded-xl font-mono text-xs pr-16 h-10 bg-background/50 border-white/10"
              />
              {imageUrl && (
                <button 
                  type="button" 
                  onClick={() => setImageUrl('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-red-500 hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="shrink-0">
              <input
                type="file"
                id="announcement-image-upload"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
              />
              <Button 
                type="button"
                variant="outline"
                disabled={isUploadingImage}
                className="w-full sm:w-auto rounded-xl border-dashed border-primary/40 hover:bg-primary/5 text-primary text-xs font-bold gap-2 h-10"
                asChild
              >
                <label htmlFor="announcement-image-upload" className="cursor-pointer flex items-center justify-center gap-2">
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload File
                    </>
                  )}
                </label>
              </Button>
            </div>
          </div>
          
          {/* Preset gallery */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {IMAGE_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setImageUrl(p.url)}
                className={`flex flex-col text-left p-2 rounded-xl border transition-all ${imageUrl === p.url ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border/30 hover:border-border/60 bg-muted/20'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-tight">{p.name}</span>
                <span className="text-[8px] text-muted-foreground line-clamp-1 mt-0.5 leading-none">{p.desc}</span>
              </button>
            ))}
          </div>

          {/* Live Preview */}
          {imageUrl && (
            <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden border border-border/40 group animate-in fade-in duration-300">
              <img src={imageUrl} className="w-full h-full object-cover" alt="Announcement Preview" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                <span className="text-[9px] text-white/80 font-black uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">Live Image Preview</span>
              </div>
            </div>
          )}
        </div>

        {/* Custom Toggle Switch for Push */}
        <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/40 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">Dispatch Push Alert</span>
            <span className="text-[10px] text-muted-foreground">Trigger a high-priority mobile & web push notification to all devices.</span>
          </div>
          <button
            type="button"
            onClick={() => setSendPush(!sendPush)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${sendPush ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${sendPush ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full font-black text-[10px] uppercase tracking-widest bg-primary hover:bg-primary/90 h-11 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all">
          <Send className="mr-2 h-4 w-4" /> Dispatch Global Broadcast
        </Button>
      </form>

      <div className="pt-4 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Recent Broadcasts</h3>
        {announcements.length === 0 ? (
          <p className="text-xs text-muted-foreground italic font-medium">No recent broadcasts found.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex flex-col sm:flex-row gap-4 p-4 bg-background/50 rounded-xl border border-white/5 overflow-hidden transition-all hover:bg-background/80">
                {ann.image_url && (
                  <div className="w-full sm:w-28 h-20 shrink-0 rounded-lg overflow-hidden border border-border/40">
                    <img src={ann.image_url} className="w-full h-full object-cover" alt="" />
                  </div>
                )}
                
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground truncate">{ann.title}</span>
                    {ann.send_push && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase tracking-widest">
                        ⚡ Push Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ann.body}</p>
                  {ann.action_url && (
                    <div className="text-[10px] text-primary font-mono mt-1 flex items-center gap-1">
                      <LinkIcon className="w-2.5 h-2.5" /> {ann.action_url}
                    </div>
                  )}
                </div>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteBroadcast(ann.id)} 
                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 self-start sm:self-center"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
