import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Megaphone, Clock } from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

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

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffInMs = now.getTime() - posted.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return posted.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <EnhancedSkeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Megaphone className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Announcements</h3>
        <p className="text-muted-foreground max-w-md">
          This user hasn't made any announcements yet. Check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement, index) => (
        <Card
          key={announcement.id}
          className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        >
          {/* Gradient accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/50 to-primary/20" />

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <CardHeader className="relative pl-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Announcement {index === 0 && announcements.length > 1 && '• Latest'}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                  {announcement.title}
                </CardTitle>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3.5 w-3.5" />
                <span>{getTimeAgo(announcement.posted_at)}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative pl-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {announcement.content}
            </p>

            {(announcement.event_date || announcement.event_location) && (
              <div className="flex flex-wrap gap-4 pt-3 border-t border-border/50">
                {announcement.event_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Event Date</div>
                      <div className="font-medium">
                        {new Date(announcement.event_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {announcement.event_location && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="font-medium">{announcement.event_location}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
