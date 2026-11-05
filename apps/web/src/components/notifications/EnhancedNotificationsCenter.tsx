
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Check, X, Archive, Settings, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from '@/components/common/PageHeader';
import { undoable } from '@/lib/undoable';
import { getNotificationIcon as getIcon, getDisplayMessage } from '@/lib/chat-utils';
import { useNotificationMutation } from '@/hooks/mutations/useNotificationMutation';

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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { markAsRead: mutateMarkAsRead, markAllAsRead: mutateMarkAllAsRead, deleteNotification: mutateDeleteNotification, resolveNotificationAction } = useNotificationMutation();

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,call_missed,call_ended,call_declined,space_started)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (mounted) {
          setLoadError(false);
          setNotifications((data || []) as unknown as Notification[]);
          setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase.channel(`enhanced-notifications-realtime-${userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, toast, reloadKey]);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await mutateMarkAsRead(id);
    } catch (error) {
      // Background operation failure handled gracefully
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await mutateMarkAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
      // Operation failure handled gracefully
    }
  };

  const deleteNotification = (id: string) => {
    const original = notifications.find(n => n.id === id);
    if (!original) return;
    const putBack = () => setNotifications(prev => (
      prev.some(n => n.id === id)
        ? prev
        : [...prev, original].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    ));
    // Hide it now; the real delete happens after a few seconds unless the person taps Undo.
    undoable({
      title: 'Notification dismissed',
      apply: () => setNotifications(prev => prev.filter(n => n.id !== id)),
      revert: putBack,
      commit: async () => {
        try {
          await mutateDeleteNotification(id);
        } catch {
          putBack();
          toast({ title: 'Could not dismiss the notification', variant: 'destructive' });
        }
      },
    });
  };

  const handleAction = async (notification: Notification, action: 'accept' | 'decline') => {
    if (!notification.related_id) {
      toast({
        title: "Error",
        description: "Missing related data for this action.",
        variant: "destructive"
      });
      return;
    }

    setActionLoading(notification.id);
    try {
      const { type, related_id } = notification;
      
      await resolveNotificationAction({
        notificationId: notification.id,
        type,
        relatedId: related_id as string,
        action
      });

      await markAsRead(notification.id);
      
      toast({
        title: action === 'accept' ? "Action Successful" : "Action Declined",
        description: `You have ${action}ed this request.`
      });
    } catch (error) {
      toast({
        title: "Action Failed",
        description: "Something went wrong while processing your request.",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    return <span className="text-xl leading-none">{getIcon(type)}</span>;
  };

  const formatMessageContent = (content: string) => {
    return getDisplayMessage(content);
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

  const isCallNotification = (n: Notification) => n.type !== 'missed_call' && /(incoming|missed|declined) .*call|started an? (voice |video |group |audio )?(call|space)/i.test(`${n.title || ''} ${n.message || ''}`);
  const filteredNotifications = filterNotifications(notifications.filter(n => !isCallNotification(n)), activeTab).sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'priority') {
      const pMap: any = { high: 3, medium: 2, low: 1 };
      return (pMap[b.priority || 'low'] || 0) - (pMap[a.priority || 'low'] || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const openNotification = (n: Notification) => {
    if (!n.action_url) return;
    if (!n.is_read) markAsRead(n.id);
    navigate(n.action_url);
  };

  const groupByDay = (items: Notification[]) => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(new Date());
    const day = 86400000;
    const groups: { label: string; items: Notification[] }[] = [];
    for (const n of items) {
      const t = startOfDay(new Date(n.created_at));
      const label = t >= today ? 'Today' : t >= today - day ? 'Yesterday' : t >= today - 7 * day ? 'This week' : 'Earlier';
      let g = groups.find((x) => x.label === label);
      if (!g) { g = { label, items: [] }; groups.push(g); }
      g.items.push(n);
    }
    return groups;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border/50 bg-card/50">
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
    <div className="space-y-5 animate-in fade-in duration-500">
      <PageHeader 
        title="Notifications" 
        subtitle="Stay updated with your latest project breakthroughs and cinematic achievements." 
        Icon={Bell}
        actions={
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded-xl border-border/50 bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-colors font-semibold text-sm px-4 h-10 gap-2"
            >
              <Check className="h-4 w-4" />
              Mark All Read
            </Button>
            <Link to="/settings/notifications">
              <Button aria-label="Settings" 
                variant="ghost" 
                size="icon" 
                className="rounded-xl h-10 w-10 hover:bg-muted/50 border border-border/50"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        }
      />

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between gap-3 mb-4 overflow-x-auto scrollbar-none pb-2 border-b border-border/30">
          <TabsList className="bg-transparent gap-1 p-0 h-auto">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'mentions', label: 'Mentions' },
              { value: 'actionable', label: 'Requests' }
            ].map((tab) => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value}
                className="rounded-full px-4 py-1.5 font-semibold text-sm transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative"
              >
                {tab.label}
                {tab.value === 'unread' && unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 flex h-4 w-4">
                     <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-xs items-center justify-center font-bold text-white shadow-sm border border-background">
                       {unreadCount > 9 ? '9+' : unreadCount}
                     </span>
                   </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center shrink-0 gap-2 text-muted-foreground hover:text-foreground font-medium hover:bg-muted/30 px-3 rounded-lg">
                <Filter className="h-4 w-4" />
                <span>Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 bg-background/95">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('newest')} className="cursor-pointer">Newest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('oldest')} className="cursor-pointer">Oldest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')} className="cursor-pointer">High Priority</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pb-24">
          {loadError && notifications.length === 0 ? (
            <div role="alert" className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Could not load notifications</h3>
                <p className="text-muted-foreground text-sm max-w-[280px]">Check your connection and try again.</p>
              </div>
              <Button variant="outline" onClick={() => setReloadKey(k => k + 1)}>Try again</Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center border border-border/40">
                <Archive className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">You're all caught up</h3>
                <p className="text-muted-foreground text-sm max-w-[280px]">
                  {activeTab === 'unread'
                    ? 'No unread notifications right now.'
                    : "We'll let you know when something new happens."}
                </p>
              </div>
            </div>
          ) : (
            groupByDay(filteredNotifications).map((group) => (
              <section key={group.label} className="mb-5">
                <h3 className="px-1 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/40">
                  {group.items.map((notification) => (
                    <div
                      key={notification.id}
                      role={notification.action_url ? 'link' : undefined}
                      tabIndex={notification.action_url ? 0 : undefined}
                      onClick={() => openNotification(notification)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openNotification(notification); } }}
                      className={`group relative flex items-start gap-3.5 px-4 py-3.5 transition-colors ${
                        notification.action_url ? 'cursor-pointer hover:bg-muted/40' : ''
                      } ${notification.is_read ? '' : 'bg-primary/[0.04]'}`}
                    >
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center border border-border/40 ${
                          notification.is_read ? 'bg-muted/50' : 'bg-primary/10'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        {!notification.is_read && (
                          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className={notification.is_read ? 'font-medium text-foreground/80' : 'font-semibold text-foreground'}>
                            {notification.title}
                          </span>
                          <span className="text-muted-foreground"> · {formatMessageContent(notification.message)}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>

                        {notification.is_actionable && !notification.is_read && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleAction(notification, 'accept'); }}
                              disabled={!!actionLoading}
                              className="h-10 md:h-8 rounded-lg px-4 text-xs font-semibold"
                            >
                              {actionLoading === notification.id ? 'Processing...' : 'Accept'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => { e.stopPropagation(); handleAction(notification, 'decline'); }}
                              disabled={!!actionLoading}
                              className="h-10 md:h-8 rounded-lg px-4 text-xs font-semibold"
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {!notification.is_read && (
                          <Button
                            aria-label="Mark as read"
                            title="Mark as read"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                            className="h-11 w-11 md:h-8 md:w-8 rounded-lg text-muted-foreground hover:text-primary"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          aria-label="Dismiss notification"
                          title="Dismiss"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                          className="h-11 w-11 md:h-8 md:w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default EnhancedNotificationsCenter;
