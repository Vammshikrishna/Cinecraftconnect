import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, MessageSquare, Heart, Film, BarChart3, ArrowUp, ArrowDown, Minus, Calendar } from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { Chart } from '@/components/analytics/Chart';
import { timeRanges } from '@/data/analytics';

interface AnalyticsData {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  totalConnections: number;
  totalProjects: number;
  totalViews: number;
  engagementRate: number;
}

export const RealTimeAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = React.useState<AnalyticsData>({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalFollowers: 0,
    totalConnections: 0,
    totalProjects: 0,
    totalViews: 0,
    engagementRate: 0
  });
  const [loading, setLoading] = React.useState(true);
  const [historicalData, setHistoricalData] = React.useState<Record<string, any[]>>({});

  const fetchHistoricalData = React.useCallback(async () => {
    if (!user) return;

    try {
      const ranges = ['7d', '30d', '90d', '1y'];
      const dataByRange: Record<string, any[]> = {};

      for (const range of ranges) {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateISO = startDate.toISOString();

        // Fetch likes, comments, and views in parallel
        const [likesRes, commentsRes, viewsRes] = await Promise.all([
          supabase
            .from('post_likes')
            .select('created_at, posts!inner(author_id)')
            .eq('posts.author_id', user.id)
            .gt('created_at', startDateISO),
          supabase
            .from('post_comments')
            .select('created_at, posts!inner(author_id)')
            .eq('posts.author_id', user.id)
            .gt('created_at', startDateISO),
          supabase
            .from('profile_views')
            .select('created_at')
            .eq('profile_id', user.id)
            .gt('created_at', startDateISO)
        ]);

        // Process into chart format
        const dayMap = new Map();
        
        // Initialize map with all days in range to ensure no gaps
        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dayMap.set(dateKey, { name: dateKey, views: 0, likes: 0, comments: 0, shares: 0 });
        }

        // Aggregate data
        likesRes.data?.forEach(l => {
          if (!l.created_at) return;
          const dateKey = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).likes++;
        });

        commentsRes.data?.forEach(c => {
          if (!c.created_at) return;
          const dateKey = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).comments++;
        });

        // Aggregate views
        (viewsRes as any).data?.forEach((v: any) => {
          if (!v.created_at) return;
          const dateKey = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).views++;
        });

        dataByRange[range] = Array.from(dayMap.values()).reverse();
      }

      setHistoricalData(dataByRange);
    } catch (error) {
      console.error('Error fetching historical analytics:', error);
    }
  }, [user]);

  React.useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      try {
        await Promise.all([
          (async () => {
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

            // Fetch all raw connections for this user
            const { data: rawConnections, error: connError } = await supabase
              .from('user_connections')
              .select('*')
              .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
              .eq('status', 'accepted');

            let creatorsCount = 0;
            let fanFollowersCount = 0;

            if (rawConnections && !connError) {
              // Fetch profiles for these connections to determine account types
              const userIds = Array.from(new Set(rawConnections.flatMap(c => [c.follower_id, c.following_id])));
              
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, account_type')
                .in('id', userIds);

              const profilesMap = new Map(profiles?.map(p => [p.id, p]));

              // Categorize connections
              // 1. Standard connections (Creator-to-Creator)
              creatorsCount = rawConnections.filter(c => {
                const otherId = c.follower_id === user.id ? c.following_id : c.follower_id;
                const otherProfile = profilesMap.get(otherId);
                return otherProfile?.account_type === 'creator' || !otherProfile?.account_type;
              }).length;

              // 2. Fan followers (Fans following US)
              fanFollowersCount = rawConnections.filter(c => {
                if (c.following_id !== user.id) return false;
                const followerProfile = profilesMap.get(c.follower_id);
                return followerProfile?.account_type === 'fan';
              }).length;
            }

            // Fetch total views
            const { count: viewsCount } = await supabase
              .from('profile_views')
              .select('*', { count: 'exact', head: true })
              .eq('profile_id', user.id);

            // Fetch projects count
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
              totalFollowers: fanFollowersCount,
              totalConnections: creatorsCount,
              totalProjects: projectsCount || 0,
              totalViews: viewsCount || 0,
              engagementRate
            });
          })(),
          fetchHistoricalData()
        ]);

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

  const engagementDistribution = [
    { name: 'Posts', value: analytics.totalPosts, color: 'hsl(var(--primary))' },
    { name: 'Comments', value: analytics.totalComments, color: 'hsl(var(--secondary))' },
    { name: 'Likes', value: analytics.totalLikes, color: 'hsl(var(--accent))' },
    { name: 'Shares', value: 0, color: 'hsl(var(--muted-foreground))' },
  ].filter(item => item.value > 0);

  // Fallback for empty pie
  const pieData = engagementDistribution.length > 0 
    ? engagementDistribution 
    : [{ name: 'No Activity', value: 1, color: 'hsl(var(--muted))' }];

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
      title: 'Total Views',
      value: analytics.totalViews,
      icon: Users,
      gradient: 'from-blue-500/20 to-blue-600/20',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      change: null
    },
    {
      title: 'Total Posts',
      value: analytics.totalPosts,
      icon: MessageSquare,
      gradient: 'from-indigo-500/20 to-purple-600/20',
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
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
      gradient: 'from-primary/20 to-primary/80/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-green-500',
      change: null
    },
    {
      title: 'Connections',
      value: analytics.totalConnections,
      icon: Users,
      gradient: 'from-purple-500/20 to-violet-600/20',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
      change: null
    },
    {
      title: 'Followers',
      value: analytics.totalFollowers,
      icon: TrendingUp, // Using TrendingUp for "Growth" (Fans)
      gradient: 'from-cyan-500/20 to-blue-600/20',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
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
                {(stat as any).suffix && (
                  <span className="text-sm text-muted-foreground">{(stat as any).suffix}</span>
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

      {/* Detailed Charts */}
      <Tabs defaultValue="7d" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 lg:grid-cols-4 bg-muted/30 p-1 rounded-xl">
            {timeRanges.map(range => (
              <TabsTrigger 
                key={range.value} 
                value={range.value} 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg font-bold text-xs uppercase tracking-widest"
              >
                {range.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">
            <Calendar className="h-3 w-3" />
            Last updated: Just now
          </div>
        </div>

        {timeRanges.map(range => (
          <TabsContent key={range.value} value={range.value} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InteractiveCard 
                title="Performance Overview" 
                description="Views, likes, and comments over time" 
                variant="hover-lift" 
                className="rounded-[2rem] border-border/50"
              >
                <div className="h-[300px] w-full mt-4">
                  <Chart data={historicalData[range.value] || []} type="area" />
                </div>
              </InteractiveCard>
              <InteractiveCard 
                title="Engagement Distribution" 
                description="Breakdown of user interactions" 
                variant="glow" 
                className="rounded-[2rem] border-border/50"
              >
                <div className="h-[300px] w-full mt-4">
                  <Chart data={historicalData[range.value] || []} type="pie" config={{ data: pieData }} />
                </div>
              </InteractiveCard>
            </div>
            
            <InteractiveCard 
              title="Detailed Metrics" 
              description="Complete performance breakdown" 
              variant="gradient" 
              className="rounded-[2.5rem] border-border/50 overflow-hidden"
            >
              <div className="h-[400px] w-full mt-4">
                <Chart 
                  data={historicalData[range.value] || []} 
                  type="line" 
                  config={[
                    { key: 'views', label: 'Views', color: 'hsl(var(--primary))' },
                    { key: 'likes', label: 'Likes', color: 'hsl(var(--secondary))' },
                    { key: 'comments', label: 'Comments', color: 'hsl(var(--accent))' },
                    { key: 'shares', label: 'Shares', color: 'hsl(var(--muted-foreground))' },
                  ]} 
                />
              </div>
            </InteractiveCard>
          </TabsContent>
        ))}
      </Tabs>

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
                {(analytics.totalLikes + analytics.totalComments + analytics.totalFollowers + analytics.totalViews).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Combined interactions & views</p>
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

