
import {
  Bell,
  CheckCheck,
  UserPlus,
  Briefcase,
  Megaphone
} from 'lucide-react';
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu.tsx";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { getDisplayMessage } from '@/lib/chat-utils';

// Notification type (excluding new_message which is handled by MessageSquare icon)
interface Notification {
  id: string;
  user_id: string;
  trigger_user_id?: string; // User who caused the notification
  type: 'new_follower' | 'project_invite' | 'system_announcement' | 'generic' | 'like' | 'comment' | 'job_application' | 'project_application';
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  priority: 'high' | 'medium' | 'low';
}

const NotificationIcon = ({ type, is_read }: { type: Notification['type'], is_read: boolean }) => {
  const commonClass = `h-5 w-5 ${is_read ? 'text-muted-foreground' : 'text-primary'}`;
  switch (type) {
    case 'new_follower': return <UserPlus className={commonClass} />;
    case 'project_invite':
    case 'project_application': return <Briefcase className={commonClass} />;
    case 'system_announcement': return <Megaphone className={commonClass} />;
    case 'like': return <span className="text-pink-500">❤️</span>;
    case 'comment': return <span className="text-blue-500">💬</span>;
    case 'job_application': return <span className="text-emerald-500">💼</span>;
    default: return <Bell className={commonClass} />;
  }
}

const NotificationsDropdown = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'new_message') // Exclude message notifications - they show in MessageSquare icon
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications((data || []) as Notification[]);
        setUnreadCount(data?.filter(n => !n.is_read).length || 0);
      } catch (error) {
        // Silent error for background fetch
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    if (user?.id) {
      const channel = supabase
        .channel(`nav_notifications_${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        }, () => fetchNotifications())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.is_read) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
        setNotifications(notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        // Silent error for mark-as-read
      }
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      // Silent error for mark-all-read
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <DropdownMenuItem asChild className="p-0 focus:bg-accent/50 focus:outline-none cursor-pointer">
      <Link
        to={notification.action_url || '#'}
        onClick={() => markAsRead(notification.id)}
        className={`block w-full p-2.5 sm:p-3 transition-colors ${!notification.is_read ? 'bg-accent/10' : ''
          }`}
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex-shrink-0">
            <NotificationIcon type={notification.type} is_read={notification.is_read} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{getDisplayMessage(notification.message)}</p>
            <p className="text-xs text-muted-foreground/80 mt-1.5">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </div>
          {!notification.is_read && <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
        </div>
      </Link>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        alignOffset={0}
        sideOffset={12}
        collisionPadding={16}
        className="w-[320px] max-w-[calc(100vw-32px)] p-0 border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/60 rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[60] flex flex-col"
      >
        <div className="flex items-center justify-between p-3 flex-shrink-0">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 &&
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-auto py-1 px-2">
              <CheckCheck className="h-3 w-3 mr-1.5" /> Mark all as read
            </Button>
          }
        </div>
        <DropdownMenuSeparator className="flex-shrink-0" />
        <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto no-scrollbar scroll-smooth flex-1">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">You're all caught up!</p>
          ) : (
            notifications.map((n: Notification) => <NotificationItem key={n.id} notification={n} />)
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2 border-t border-border/10 mt-auto">
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
            <Link to="/notifications" className="w-full">
              <Button variant="ghost" className="w-full justify-center group">
                View All Notifications
                <Bell className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform" />
              </Button>
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
