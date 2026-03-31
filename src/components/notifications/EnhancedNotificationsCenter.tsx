import { useEffect, useState } from 'react';
import { Bell, Check, X, Archive, Settings, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  related_id: string | null;
  related_type: string | null;
  priority: string | null;
  is_read: boolean | null;
  is_actionable: boolean | null;
  metadata: any;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const EnhancedNotificationsCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!mounted) return;
        if (error) {
          console.error('Error fetching notifications:', error);
          toast({
            title: "Error",
            description: "Failed to load notifications",
            variant: "destructive"
          });
        } else {
          setNotifications(data || []);
          setUnreadCount((data || []).filter(n => !n.is_read).length);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchNotifications();

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('notifications-stream')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          if (mounted) {
            fetchNotifications();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "Dismissed",
        description: "Notification removed"
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'new_follower': return '👤';
      case 'job_application': return '💼';
      case 'project_application': return '🚀';
      case 'project_invite': return '✉️';
      case 'mention': return '@';
      default: return '🔔';
    }
  };

  const formatMessageContent = (content: string) => {
    if (!content) return '';
    if (content.startsWith('POST_SHARE::')) return 'Shared a post';
    if (content.startsWith('MARKETPLACE_SHARE::')) return 'Shared a listing';
    if (content.startsWith('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
    if (content.startsWith('VENDOR_SHARE::')) return 'Shared a vendor';
    if (content.startsWith('PROJECT_SHARE::')) return 'Shared a project space';
    if (content.startsWith('DISCUSSION_SHARE::')) return 'Shared a discussion room';
    if (content.includes('JOB_SHARE::')) return 'Shared a job opportunity';
    return content;
  };

  const filterNotifications = (notifications: Notification[], filter: string) => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.is_read);
      case 'actionable':
        return notifications.filter(n => n.is_actionable);
      case 'mentions':
        return notifications.filter(n => n.type === 'mention');
      default:
        return notifications;
    }
  };

  const filteredNotifications = filterNotifications(notifications, activeTab);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-foreground">
            <Bell className="h-8 w-8 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 px-3 py-1 text-sm font-black rounded-full shadow-lg shadow-destructive/20 ring-4 ring-destructive/10">
                {unreadCount} NEW
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground font-medium text-lg max-w-2xl leading-relaxed">
            Stay updated with your latest project breakthroughs, network expansions, and cinematic achievements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-2xl border-border/50 bg-background/50 backdrop-blur-md hover:bg-primary/10 hover:border-primary/30 transition-all font-black text-xs uppercase tracking-widest px-6 h-12 gap-2 shadow-sm"
          >
            <Check className="h-4 w-4" />
            Mark All Read
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-2xl h-12 w-12 hover:bg-muted/50 border border-white/5 shadow-inner"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-8 overflow-x-auto scrollbar-none pb-2 border-b border-border/20">
          <TabsList className="bg-transparent gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'mentions', label: 'Mentions' },
              { value: 'actionable', label: 'Requests' }
            ].map((tab) => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value}
                className="rounded-2xl px-8 py-3 font-black text-xs uppercase tracking-[0.1em] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg relative"
              >
                {tab.label}
                {tab.value === 'unread' && unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 flex h-4 w-4">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-[8px] items-center justify-center font-bold text-white shadow-sm border border-background">
                       {unreadCount > 9 ? '9+' : unreadCount}
                     </span>
                   </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold hover:bg-muted/30 px-4 py-2 rounded-xl">
            <Filter className="h-4 w-4" />
            <span>Refine Feed</span>
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-400px)] min-h-[500px]">
          <div className="space-y-6 pr-4 pb-20">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                <div className="h-24 w-24 rounded-[2.5rem] bg-gradient-to-br from-muted/20 to-muted/10 flex items-center justify-center border border-white/5 group shadow-inner">
                  <Archive className="h-10 w-10 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight">System Zen</h3>
                  <p className="text-muted-foreground font-medium max-w-[320px] text-lg leading-snug">
                    {activeTab === 'unread' 
                      ? "You've masterfully processed all updates. Your workspace is clear." 
                      : "We'll notify you when new opportunities arise."}
                  </p>
                </div>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`group relative overflow-hidden border-border/40 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.2)] rounded-[2rem] ${
                    notification.is_read ? 'bg-card/40 opacity-75 grayscale-[0.3]' : 'bg-card/70 backdrop-blur-2xl shadow-xl ring-1 ring-primary/10'
                  }`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500 ${
                    notification.is_read ? 'bg-transparent' : 'bg-primary'
                  }`} />
                  
                  <CardContent className="p-8">
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                      <div className={`h-16 w-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-2xl border border-white/10 bg-gradient-to-br shrink-0 transition-transform duration-500 group-hover:scale-105 ${
                        notification.is_read ? 'from-muted/30 to-muted/10' : 'from-primary/20 via-primary/10 to-transparent'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 space-y-3 min-w-0 w-full">
                        <div className="flex items-center justify-between gap-4 w-full">
                          <h4 className={`font-black text-xl tracking-tight truncate ${notification.is_read ? 'text-foreground/70' : 'text-foreground'}`}>
                            {notification.title}
                          </h4>
                          <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-border/50 px-3 py-1 bg-muted/20">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </Badge>
                        </div>
                        
                        <p className={`text-base md:text-lg leading-relaxed max-w-4xl ${
                          notification.is_read ? 'text-muted-foreground' : 'text-foreground/90 font-bold'
                        }`}>
                          {formatMessageContent(notification.message)}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 pt-4">
                          {notification.action_url && (
                            <Link 
                              to={notification.action_url}
                              className="text-primary-foreground hover:shadow-lg shadow-primary/20 text-xs font-black uppercase tracking-widest flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 transition-all transform active:scale-95"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <span>Enter Space</span>
                            </Link>
                          )}
                          
                          {notification.is_actionable && (
                            <div className="flex items-center gap-3">
                              <Button className="rounded-2xl font-black text-xs uppercase tracking-widest px-6 h-11 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">Accept</Button>
                              <Button variant="ghost" className="rounded-2xl font-black text-xs uppercase tracking-widest px-6 h-11 bg-muted/40 hover:bg-muted">Decline</Button>
                            </div>
                          )}

                          <div className="flex-1" />

                          <div className="flex items-center gap-2 animate-in fade-in duration-500 md:opacity-0 md:group-hover:opacity-100">
                            {!notification.is_read && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => markAsRead(notification.id)}
                                className="h-10 rounded-xl border-primary/20 hover:bg-primary/10 text-primary font-black uppercase tracking-widest text-[9px] px-4"
                              >
                                <Check className="h-3.5 w-3.5 mr-2" />
                                Mark read
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteNotification(notification.id)}
                              className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default EnhancedNotificationsCenter;