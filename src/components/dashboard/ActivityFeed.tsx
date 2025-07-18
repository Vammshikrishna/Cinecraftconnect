import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageCircle, 
  Users, 
  Film, 
  Star, 
  Calendar,
  Briefcase,
  Award,
  Bell
} from 'lucide-react';

interface Activity {
  id: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
  is_read: boolean;
}

export const ActivityFeed = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
      // Set up real-time subscription
      const channel = supabase
        .channel('user-activities')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_activities',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setActivities(prev => [payload.new as Activity, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (activityId: string) => {
    try {
      await supabase
        .from('user_activities')
        .update({ is_read: true })
        .eq('id', activityId);

      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId 
            ? { ...activity, is_read: true }
            : activity
        )
      );
    } catch (error) {
      console.error('Error marking activity as read:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project_created': return <Film className="h-4 w-4" />;
      case 'collaboration_request': return <Users className="h-4 w-4" />;
      case 'project_comment': return <MessageCircle className="h-4 w-4" />;
      case 'project_completed': return <Award className="h-4 w-4" />;
      case 'rating_received': return <Star className="h-4 w-4" />;
      case 'event_reminder': return <Calendar className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getActivityMessage = (activity: Activity) => {
    const { activity_type, activity_data } = activity;
    
    switch (activity_type) {
      case 'project_created':
        return `You created a new project: "${activity_data.project_title}"`;
      case 'collaboration_request':
        return `${activity_data.requester_name} wants to collaborate on "${activity_data.project_title}"`;
      case 'project_comment':
        return `New comment on "${activity_data.project_title}" from ${activity_data.commenter_name}`;
      case 'project_completed':
        return `Project "${activity_data.project_title}" has been completed!`;
      case 'rating_received':
        return `Your work received a ${activity_data.rating}-star rating`;
      case 'event_reminder':
        return `Upcoming event: ${activity_data.event_title}`;
      default:
        return 'New activity';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'project_created': return 'bg-blue-500';
      case 'collaboration_request': return 'bg-green-500';
      case 'project_comment': return 'bg-purple-500';
      case 'project_completed': return 'bg-yellow-500';
      case 'rating_received': return 'bg-orange-500';
      case 'event_reminder': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Activity Feed</CardTitle>
          <CardDescription>Loading your recent activities...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex space-x-3">
                  <div className="h-8 w-8 bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Activity Feed
          </span>
          {activities.some(a => !a.is_read) && (
            <Badge variant="secondary" className="text-xs">
              {activities.filter(a => !a.is_read).length} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Stay updated with your latest activities</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id}>
                <div 
                  className={`flex space-x-3 p-3 rounded-lg transition-colors ${
                    !activity.is_read 
                      ? 'bg-cinesphere-purple/10 border border-cinesphere-purple/20' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-full ${getActivityColor(activity.activity_type)}`}>
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">
                      {getActivityMessage(activity)}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                    {!activity.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs mt-2 h-6"
                        onClick={() => markAsRead(activity.id)}
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
                {index < activities.length - 1 && <Separator className="my-2 bg-white/10" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400 mb-2">No recent activities</p>
            <p className="text-gray-500 text-sm">
              Your activities will appear here as you use the platform
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};