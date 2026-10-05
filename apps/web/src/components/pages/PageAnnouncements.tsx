import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AnnouncementItem, type AnnouncementRow } from '@/components/announcements/AnnouncementItem';
import { CreateAnnouncementDialog } from '@/components/feed/CreateAnnouncementDialog';

/** A company page's own announcements. The team can post, pin and edit from here. */
export const PageAnnouncements = ({ pageId, canManage }: { pageId: string; canManage: boolean }) => {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc('list_announcements', { p_limit: 30, p_before: null, p_filter: 'all', p_category: null, p_search: null, p_page_id: pageId });
    setItems((data || []) as AnnouncementRow[]);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button className="rounded-xl font-bold gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New announcement</Button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[2rem] border border-dashed border-border/60 bg-card/20">
          <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-black text-lg mb-1">No announcements yet</p>
          <p className="text-sm text-muted-foreground">{canManage ? 'Share news, events and openings with your followers.' : 'This company has not announced anything yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {items.map((row) => <AnnouncementItem key={row.id} row={row} onChanged={load} onEdit={setEditing} />)}
        </div>
      )}
      {canManage && (
        <CreateAnnouncementDialog
          open={createOpen || !!editing}
          onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditing(null); } else setCreateOpen(true); }}
          onAnnouncementCreated={load}
          editing={editing}
          defaultPageId={pageId}
        />
      )}
    </div>
  );
};
