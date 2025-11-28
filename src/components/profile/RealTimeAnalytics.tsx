import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, MessageSquare, Heart, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalyticsData {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  totalProjects: number;
  engagementScore: number;
}

export const RealTimeAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalFollowers: 0,
    totalProjects: 0,
    engagementScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      try {
        // Fetch posts count
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', user.id);

        // Fetch total likes on user's posts
        const { data: posts } = await supabase
          .from('posts')
          .select('like_count, comment_count')
          .eq('author_id', user.id);

        const totalLikes = posts?.reduce((sum, post) => sum + (post.like_count || 0), 0) || 0;
        const totalComments = posts?.reduce((sum, post) => sum + (post.comment_count || 0), 0) || 0;

        // Fetch followers count
        const { count: followersCount } = await supabase
          .from('user_connections')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user.id)
          .eq('status', 'accepted');

        // Fetch projects count
        const { count: projectsCount } = await supabase
          .from('project_spaces')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', user.id);

        // Fetch engagement score
        // const { data: engagementData } = await supabase
        //   .from('user_engagement_scores')
        //   .select('engagement_score')
        //   .eq('user_id', user.id)
        //   .order('date', { ascending: false })
        //   .limit(1)
        //   .single();

        setAnalytics({
          totalPosts: postsCount || 0,
          totalLikes,
          totalComments,
          totalFollowers: followersCount || 0,
          totalProjects: projectsCount || 0,
          engagementScore: 0 // engagementData?.engagement_score || 0
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setLoading(false);
      }
    };

    fetchAnalytics();

    // Real-time subscriptions
    const postsChannel = supabase
      .channel('analytics-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `author_id=eq.${user.id}`
        },
        () => fetchAnalytics()
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel('analytics-connections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_connections',
          filter: `following_id=eq.${user.id}`
        },
        () => fetchAnalytics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(connectionsChannel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const stats = [
    { title: 'Total Posts', value: analytics.totalPosts, icon: MessageSquare, color: 'text-blue-500' },
    { title: 'Total Likes', value: analytics.totalLikes, icon: Heart, color: 'text-red-500' },
    { title: 'Total Comments', value: analytics.totalComments, icon: MessageSquare, color: 'text-green-500' },
    { title: 'Followers', value: analytics.totalFollowers, icon: Users, color: 'text-purple-500' },
    { title: 'Projects', value: analytics.totalProjects, icon: Eye, color: 'text-orange-500' },
    { title: 'Engagement Score', value: analytics.engagementScore.toFixed(2), icon: TrendingUp, color: 'text-yellow-500' }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
