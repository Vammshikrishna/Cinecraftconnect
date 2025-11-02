import { useEffect, useState } from 'react';
import { Bell, Check, X, Archive, Settings, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  related_id?: string;
  related_type?: string;
  priority: string;
  is_read: boolean;
  is_actionable: boolean;
  metadata: any;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}
const EnhancedNotificationsCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const {
    toast
  } = useToast();
  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          setNotifications([]);
          setLoading(false);
          return;
        }
        const {
          data,
          error
        } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', {
          ascending: false
        }).limit(50);
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

    // Set up real-time subscription for notifications
    const setupRealtime = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const channel = supabase.channel('notifications-stream').on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        if (mounted) {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast for high priority notifications
          if (newNotification.priority === 'high') {
            toast({
              title: newNotification.title,
              description: newNotification.message
            });
          }
        }
      }).on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        if (mounted) {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev => prev.map(n => n.id === updatedNotification.id ? updatedNotification : n));

          // Update unread count
          setUnreadCount(prev => {
            const wasRead = prev > 0 && payload.old.is_read === false && updatedNotification.is_read === true;
            return wasRead ? prev - 1 : prev;
          });
        }
      }).subscribe();
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
      setNotifications(prev => prev.map(n => n.id === id ? {
        ...n,
        is_read: true
      } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      const {
        error
      } = await supabase.from('notifications').update({
        is_read: true
      }).eq('id', id);
      if (error) {
        console.error('Mark read error:', error);
        // Revert optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? {
          ...n,
          is_read: false
        } : n));
        setUnreadCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  const markAllAsRead = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        error
      } = await supabase.from('notifications').update({
        is_read: true
      }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({
        ...n,
        is_read: true
      })));
      setUnreadCount(0);
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive"
      });
    }
  };
  const deleteNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));

      // Note: Since there's no DELETE policy, we'll simulate deletion by hiding it
      // In a real app, you might want to add a deleted_at field instead
      toast({
        title: "Notification dismissed",
        description: "Notification has been hidden"
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👤';
      case 'mention':
        return '@';
      default:
        return '🔔';
    }
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
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
    return;
  }
  return <Card className="w-full animate-fade-in">
      
      
      
    </Card>;
};
export default EnhancedNotificationsCenter;