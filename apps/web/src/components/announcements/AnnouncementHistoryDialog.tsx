import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

/** Earlier versions of an edited announcement (visible to whoever publishes it, and to staff). */
export const AnnouncementHistoryDialog = ({ announcementId, open, onOpenChange }: { announcementId: string; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    (supabase as any)
      .from('announcement_edits')
      .select('id, old_title, old_content, edited_at')
      .eq('announcement_id', announcementId)
      .order('edited_at', { ascending: false })
      .then(({ data }: any) => setRows(data || []));
  }, [open, announcementId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
          <DialogDescription>What this announcement said before each change.</DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No earlier versions are saved.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border/60 p-4 space-y-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Before {format(new Date(r.edited_at), 'd MMM yyyy, h:mm a')}</p>
                <p className="font-bold">{r.old_title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.old_content}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
