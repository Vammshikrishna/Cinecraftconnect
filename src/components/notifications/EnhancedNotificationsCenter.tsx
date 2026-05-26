
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from '@/components/common/PageHeader';
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
  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const { markAsRead: mutateMarkAsRead, markAllAsRead: mutateMarkAllAsRead, deleteNotification: mutateDeleteNotification, resolveNotificationAction } = useNotificationMutation();

  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      if (mounted) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    };

    fetchNotifications();
    return () => { mounted = false; };
  }, [user, toast]);

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

  const deleteNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await mutateDeleteNotification(id);
      toast({
        title: "Dismissed",
        description: "Notification removed"
      });
    } catch (error) {
      // Silent error for notification dismissal
    }
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
    return <span className="text-2xl">{getIcon(type)}</span>;
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

  const filteredNotifications = filterNotifications(notifications, activeTab).sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'priority') {
      const pMap: any = { high: 3, medium: 2, low: 1 };
      return (pMap[b.priority || 'low'] || 0) - (pMap[a.priority || 'low'] || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
              className="rounded-2xl border-border/50 bg-background/50 backdrop-blur-md hover:bg-primary/10 hover:border-primary/30 transition-all font-black text-xs uppercase tracking-widest px-6 h-12 gap-2 shadow-sm"
            >
              <Check className="h-4 w-4" />
              Mark All Read
            </Button>
            <Link to="/settings/notifications">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-2xl h-12 w-12 hover:bg-muted/50 border border-white/5 shadow-inner"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        }
      />

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold hover:bg-muted/30 px-4 py-2 rounded-xl">
                <Filter className="h-4 w-4" />
                <span>Refine Feed</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 bg-background/95 backdrop-blur-md">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('newest')} className="cursor-pointer">Newest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('oldest')} className="cursor-pointer">Oldest First</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')} className="cursor-pointer">High Priority</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="h-[calc(100vh-320px)] w-full">
          <div className="space-y-4 pr-4 pb-32">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="h-20 w-20 rounded-[2rem] bg-gradient-to-br from-muted/20 to-muted/10 flex items-center justify-center border border-white/5 group shadow-inner">
                  <Archive className="h-8 w-8 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight">System Zen</h3>
                  <p className="text-muted-foreground font-medium max-w-[280px] text-base leading-snug">
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
                  className={`group relative overflow-hidden border-border/40 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] rounded-[1.5rem] ${
                    notification.is_read ? 'bg-card/40 opacity-80 grayscale-[0.2]' : 'bg-card/70 backdrop-blur-2xl shadow-lg ring-1 ring-primary/10'
                  } ${notification.priority === 'high' && !notification.is_read ? 'ring-2 ring-primary/30 border-primary/20' : ''}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-500 ${
                    notification.is_read ? 'bg-transparent' : (notification.priority === 'high' ? 'bg-primary animate-pulse' : 'bg-primary')
                  }`} />
                  
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-row items-start gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shadow-xl border border-white/10 bg-gradient-to-br shrink-0 transition-transform duration-500 group-hover:scale-105 ${
                        notification.is_read ? 'from-muted/30 to-muted/10' : 'from-primary/20 via-primary/10 to-transparent'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 space-y-2 min-w-0">
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
                          
                          {notification.is_actionable && !notification.is_read && (
                            <div className="flex items-center gap-3">
                              <Button 
                                onClick={() => handleAction(notification, 'accept')}
                                disabled={!!actionLoading}
                                className="rounded-2xl font-black text-xs uppercase tracking-widest px-6 h-11 bg-primary hover:bg-primary shadow-lg shadow-emerald-500/20"
                              >
                                {actionLoading === notification.id ? 'Processing...' : 'Accept'}
                              </Button>
                              <Button 
                                variant="ghost" 
                                onClick={() => handleAction(notification, 'decline')}
                                disabled={!!actionLoading}
                                className="rounded-2xl font-black text-xs uppercase tracking-widest px-6 h-11 bg-muted/40 hover:bg-muted"
                              >
                                Decline
                              </Button>
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
