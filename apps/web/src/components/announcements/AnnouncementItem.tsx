import { useEffect, useRef, useState } from 'react';
import { Pin, Clock, Users, UserCheck, Megaphone, ExternalLink } from 'lucide-react';
import { AnnouncementHistoryDialog } from '@/components/announcements/AnnouncementHistoryDialog';
import { formatDistanceToNow, format } from 'date-fns';
import FeedAnnouncementCard from '@/components/feed/FeedAnnouncementCard';
import ReportDialog from '@/components/common/ReportDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const ANNOUNCEMENT_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'general', label: 'General', color: '#64748B' },
  { value: 'event', label: 'Event', color: '#8B5CF6' },
  { value: 'hiring', label: 'Hiring', color: '#3B82F6' },
  { value: 'release', label: 'Release', color: '#10B981' },
  { value: 'news', label: 'News', color: '#F59E0B' },
  { value: 'maintenance', label: 'Maintenance', color: '#EF4444' },
];

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  posted_at: string;
  author_id: string | null;
  publisher_page_id: string | null;
  category: string;
  image_url: string | null;
  audience: 'everyone' | 'followers' | 'team';
  is_pinned: boolean;
  expires_at: string | null;
  edited_at: string | null;
  view_count: number;
  scheduled: boolean;
  expired: boolean;
  unread: boolean;
  can_manage?: boolean;
  is_system?: boolean;
  action_url?: string | null;
  profiles: { full_name: string | null; username: string | null; avatar_url?: string | null } | null;
  company_pages: { id: string; name: string; logo_url: string; slug: string; is_verified?: boolean } | null;
}

/** One announcement with its badges, pin / edit controls, view count and report button around the existing card. */
export const AnnouncementItem = ({ row, onChanged, onEdit }: { row: AnnouncementRow; onChanged: () => void; onEdit?: (row: AnnouncementRow) => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const togglePin = async () => {
    const { error } = await db.from('announcements').update({ is_pinned: !row.is_pinned }).eq('id', row.id);
    if (error) return toast({ title: row.is_pinned ? 'Could not unpin' : 'Could not pin', description: error.message, variant: 'destructive' });
    toast({ title: row.is_pinned ? 'Unpinned' : 'Pinned to the top' });
    onChanged();
  };

  // count a view once the announcement is actually on screen (the database counts each person once)
  useEffect(() => {
    if (!user || row.author_id === user.id || row.scheduled || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        db.rpc('record_announcement_view', { p_announcement_id: row.id }).then(() => {}, () => {});
        obs.disconnect();
      }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [row.id, user?.id]);

  if (row.is_system) {
    return (
      <div ref={ref} className="rounded-[2rem] border border-primary/30 bg-primary/5 p-6 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
          <Megaphone size={13} /> Platform news {row.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        {row.image_url && <img loading="lazy" decoding="async" src={row.image_url} alt="" className="w-full max-h-60 object-cover rounded-2xl" />}
        <h3 className="font-serif text-xl font-bold leading-tight">{row.title}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.content}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(row.posted_at), { addSuffix: true })}</span>
          {row.action_url && /^(https?:\/\/|\/)/.test(row.action_url) && (
            <a href={row.action_url} className="text-xs font-black text-primary flex items-center gap-1 hover:underline">Learn more <ExternalLink size={12} /></a>
          )}
        </div>
      </div>
    );
  }

  const cat = ANNOUNCEMENT_CATEGORIES.find((c) => c.value === row.category);
  const isMine = !!user && row.author_id === user.id;

  return (
    <div ref={ref} className="space-y-2">
      {/* badges */}
      <div className="flex flex-wrap items-center gap-2 px-1 min-h-[22px]">
        {row.is_pinned && <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1"><Pin size={11} /> Pinned</span>}
        {row.unread && <span className="h-2 w-2 rounded-full bg-primary" title="New" />}
        {cat && row.category !== 'general' && (
          <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2.5 py-0.5" style={{ color: cat.color, backgroundColor: `${cat.color}1f` }}>{cat.label}</span>
        )}
        {row.audience === 'followers' && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><UserCheck size={11} /> Followers only</span>}
        {row.audience === 'team' && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Users size={11} /> Team only</span>}
        {row.scheduled && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1"><Clock size={11} /> Goes live {format(new Date(row.posted_at), 'd MMM, h:mm a')}</span>}
        {row.expired && <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Expired</span>}
        {!row.expired && row.expires_at && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Until {format(new Date(row.expires_at), 'd MMM')}</span>}
        {row.edited_at && <span className="text-[10px] text-muted-foreground">edited</span>}
      </div>

      {row.image_url && (
        <img loading="lazy" decoding="async" src={row.image_url} alt="" className="w-full max-h-72 object-cover rounded-2xl border border-border/50" />
      )}

      <FeedAnnouncementCard
        isWidget={true}
        announcement={{
          id: row.id,
          title: row.title,
          content: row.content,
          created_at: row.posted_at,
          author_id: row.author_id,
          publisher_page_id: row.publisher_page_id,
          company_pages: row.company_pages as any,
          profiles: row.profiles as any,
        }}
        onDismiss={undefined}
        viewCount={row.can_manage ? row.view_count : null}
        onReport={user && !isMine ? () => setReportOpen(true) : undefined}
        manage={row.can_manage ? {
          canManage: true,
          isPinned: row.is_pinned,
          onTogglePin: togglePin,
          onEdit: onEdit ? () => onEdit(row) : undefined,
          onHistory: row.edited_at ? () => setHistoryOpen(true) : undefined,
        } : undefined}
      />

      {row.can_manage && <AnnouncementHistoryDialog announcementId={row.id} open={historyOpen} onOpenChange={setHistoryOpen} />}
      {user && !isMine && <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="announcement" targetId={row.id} />}
    </div>
  );
};
