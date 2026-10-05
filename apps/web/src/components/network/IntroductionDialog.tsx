import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetName: string;
}

/** Ask a mutual connection to introduce you. The introduced person still decides whether to accept. */
export const IntroductionDialog = ({ open, onOpenChange, targetId, targetName }: Props) => {
  const { toast } = useToast();
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [via, setVia] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setVia(null);
    setNote('');
    (supabase as any).rpc('introduction_options', { p_target: targetId }).then(({ data }: any) => {
      setOptions(data || []);
      setLoading(false);
    });
  }, [open, targetId]);

  const send = async () => {
    if (!via) return;
    setSending(true);
    const { error } = await (supabase as any).rpc('request_introduction', { p_target: targetId, p_via: via, p_note: note.trim() || null });
    setSending(false);
    if (error) {
      toast({ title: 'Could not ask for the introduction', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Introduction requested', description: 'They will be notified.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ask for an introduction to {targetName}</DialogTitle>
          <DialogDescription>Pick a mutual connection who can introduce you.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">You have no mutual connections with {targetName}, so there is nobody to introduce you.</p>
        ) : (
          <>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {options.map(o => (
                <button
                  key={o.id}
                  onClick={() => setVia(o.id)}
                  className={cn('w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors', via === o.id ? 'border-primary bg-primary/10' : 'hover:bg-muted')}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={o.avatar_url || undefined} />
                    <AvatarFallback>{(o.full_name || o.username || '?')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{o.full_name || o.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.craft || 'Filmmaker'}</p>
                  </div>
                </button>
              ))}
            </div>
            <Textarea rows={3} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Tell them why you would like to meet (optional)" className="resize-none" />
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={!via || sending}>{sending ? 'Sending...' : 'Ask for introduction'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
