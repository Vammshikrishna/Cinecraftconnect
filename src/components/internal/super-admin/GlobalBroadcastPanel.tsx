import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Trash2, Send } from 'lucide-react';

export default function GlobalBroadcastPanel() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('platform_announcements' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      setAnnouncements(data);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !message) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.from('platform_announcements' as any).insert({
        title,
        message,
        type,
        created_by: user.id
      });

      if (error) throw error;

      toast({
        title: "Broadcast Sent",
        description: "Your announcement is now live across the platform."
      });
      setTitle('');
      setMessage('');
      setType('info');
      fetchAnnouncements();
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

  const deactivateBroadcast = async (id: string) => {
    const { error } = await supabase.from('platform_announcements' as any)
      .update({ is_active: false })
      .eq('id', id);
      
    if (!error) {
      toast({ title: "Broadcast Deactivated" });
      fetchAnnouncements();
    }
  };

  return (
    <div className="space-y-6 bg-card/50 border border-border/50 rounded-2xl p-6">
      <div>
        <h2 className="text-xl font-black flex items-center gap-2 mb-2">
          <Megaphone className="text-primary" /> Global Broadcast System
        </h2>
        <p className="text-muted-foreground text-sm">
          Push a dismissible banner to every online user instantly.
        </p>
      </div>

      <form onSubmit={handleBroadcast} className="space-y-4 bg-background/50 p-5 rounded-xl border border-white/5">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Headline</label>
            <Input 
              placeholder="e.g., Scheduled Maintenance in 1 Hour" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Banner Type</label>
            <select 
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="info">Info (Blue)</option>
              <option value="warning">Warning (Orange)</option>
              <option value="maintenance">Maintenance (Red)</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Message Details</label>
          <Textarea 
            placeholder="Provide context or instructions for the users..." 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            required 
            rows={3}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full font-bold bg-primary hover:bg-primary/90">
          <Send className="mr-2 h-4 w-4" /> Push to All Users
        </Button>
      </form>

      <div className="pt-4 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Broadcasts</h3>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No recent broadcasts found.</p>
        ) : (
          announcements.map((ann) => (
            <div key={ann.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={ann.is_active ? 'default' : 'secondary'} className={ann.is_active ? 'bg-green-500/20 text-green-500 border-green-500/50' : ''}>
                    {ann.is_active ? 'Live' : 'Deactivated'}
                  </Badge>
                  <span className="font-bold">{ann.title}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{ann.message}</p>
              </div>
              
              {ann.is_active && (
                <Button variant="ghost" size="icon" onClick={() => deactivateBroadcast(ann.id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
