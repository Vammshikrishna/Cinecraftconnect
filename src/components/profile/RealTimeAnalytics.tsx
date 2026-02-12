import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, MessageSquare, Heart, Film, BarChart3, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';

interface AnalyticsData {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  totalProjects: number;
  engagementRate: number;
}

export const RealTimeAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalFollowers: 0,
    totalProjects: 0,
    engagementRate: 0
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

        // Fetch total likes and comments on user's posts
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

        // Fetch projects count (fixed to use 'projects' table)
        const { count: projectsCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', user.id);

        // Calculate engagement rate
        const totalEngagements = totalLikes + totalComments;
        const engagementRate = postsCount && postsCount > 0
          ? (totalEngagements / postsCount)
          : 0;

        setAnalytics({
          totalPosts: postsCount || 0,
          totalLikes,
          totalComments,
          totalFollowers: followersCount || 0,
          totalProjects: projectsCount || 0,
          engagementRate
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
  }, [user?.id]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <EnhancedSkeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Posts',
      value: analytics.totalPosts,
      icon: MessageSquare,
      gradient: 'from-blue-500/20 to-blue-600/20',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      change: null
    },
    {
      title: 'Total Likes',
      value: analytics.totalLikes,
      icon: Heart,
      gradient: 'from-red-500/20 to-pink-600/20',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      change: null
    },
    {
      title: 'Total Comments',
      value: analytics.totalComments,
      icon: MessageSquare,
      gradient: 'from-green-500/20 to-emerald-600/20',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-500',
      change: null
    },
    {
      title: 'Followers',
      value: analytics.totalFollowers,
      icon: Users,
      gradient: 'from-purple-500/20 to-violet-600/20',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      change: null
    },
    {
      title: 'Projects',
      value: analytics.totalProjects,
      icon: Film,
      gradient: 'from-orange-500/20 to-amber-600/20',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
      change: null
    },
    {
      title: 'Avg. Engagement',
      value: analytics.engagementRate.toFixed(1),
      icon: TrendingUp,
      gradient: 'from-yellow-500/20 to-orange-600/20',
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-500',
      suffix: ' per post',
      change: null
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground">Real-time insights into your activity</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:scale-[1.02]"
          >
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2.5 rounded-lg ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </CardHeader>

            <CardContent className="relative">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold group-hover:text-primary transition-colors">
                  {stat.value.toLocaleString()}
                </div>
                {stat.suffix && (
                  <span className="text-sm text-muted-foreground">{stat.suffix}</span>
                )}
              </div>

              {stat.change !== null && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${stat.change > 0 ? 'text-green-500' : stat.change < 0 ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                  {stat.change > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : stat.change < 0 ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span>
                    {stat.change > 0 ? '+' : ''}{stat.change}% from last month
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Reach</p>
              <p className="text-2xl font-bold">
                {(analytics.totalLikes + analytics.totalComments + analytics.totalFollowers).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Combined interactions</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Content Created</p>
              <p className="text-2xl font-bold">
                {(analytics.totalPosts + analytics.totalProjects).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Posts & Projects</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Engagement Quality</p>
              <p className="text-2xl font-bold">
                {analytics.totalPosts > 0
                  ? ((analytics.totalLikes + analytics.totalComments) / analytics.totalPosts * 100).toFixed(0)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Interaction rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
