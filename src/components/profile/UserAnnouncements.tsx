import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Announcement {
  id: string;
  title: string;
  content: string;
  event_date?: string;
  event_location?: string;
  posted_at: string;
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
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('author_id', targetUserId)
        .order('posted_at', { ascending: false });

      if (!error && data) {
        setAnnouncements(data);
      }
      setLoading(false);
    };

    fetchAnnouncements();

    // Real-time subscription
    const channel = supabase
      .channel('user-announcements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: `author_id=eq.${targetUserId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAnnouncements(prev => [payload.new as Announcement, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? payload.new as Announcement : a));
          } else if (payload.eventType === 'DELETE') {
            setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No announcements yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => (
        <Card key={announcement.id}>
          <CardHeader>
            <CardTitle className="text-lg">{announcement.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{announcement.content}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {announcement.event_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(announcement.event_date).toLocaleDateString()}
                </div>
              )}
              {announcement.event_location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {announcement.event_location}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
