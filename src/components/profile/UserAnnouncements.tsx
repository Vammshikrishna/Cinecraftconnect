import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, Search } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import FeedAnnouncementCard from '@/components/feed/FeedAnnouncementCard';

interface Announcement {
  id: string;
  title: string;
  content: string;
  posted_at: string;
  author_id: string;
  publisher_page_id?: string | null;
  company_pages?: {
    id: string;
    name: string;
    logo_url: string;
    slug: string;
  } | null;
  profiles?: {
    full_name: string | null;
    username: string | null;
  } | null;
}

interface UserAnnouncementsProps {
  userId?: string;
}

export const UserAnnouncements = ({ userId }: UserAnnouncementsProps) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*, company_pages:publisher_page_id(id, name, logo_url, slug), profiles:author_id(full_name, username)')
          .eq('author_id', targetUserId)
          .order('posted_at', { ascending: false });

        if (!error && data) {
          setAnnouncements(data as any);
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();

    // Real-time subscription to keep profile synced
    const channel = supabase
      .channel(`user-announcements-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: `author_id=eq.${targetUserId}`
        },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center glass-card border-dashed border-2">
        <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6 relative">
          <Megaphone className="h-10 w-10 text-primary/40" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/10 border-dashed animate-[spin_10s_linear_infinite]" />
        </div>
        <h3 className="text-2xl font-bold text-foreground/80 mb-2">No active announcements</h3>
        <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
          When this user shares news, project updates, or calls for collaboration, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
           <h2 className="text-xl font-bold tracking-tight">Recent Updates</h2>
           <span className="bg-primary/10 text-primary text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">
              {announcements.length}
           </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-muted-foreground text-xs font-medium">
          <Search size={14} />
          <span>Search in announcements</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {announcements.map((announcement) => (
          <FeedAnnouncementCard
            key={announcement.id}
            announcement={{
              id: announcement.id,
              title: announcement.title,
              content: announcement.content,
              created_at: announcement.posted_at,
              author_id: announcement.author_id,
              publisher_page_id: announcement.publisher_page_id,
              company_pages: announcement.company_pages,
              profiles: announcement.profiles
            }}
          />
        ))}
      </div>
    </div>
  );
};
