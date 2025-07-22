import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, Users, MessageSquare, Heart, Eye, Activity } from "lucide-react";

interface EngagementData {
  date: string;
  posts_created: number;
  comments_made: number;
  likes_given: number;
  likes_received: number;
  engagement_score: number;
}

interface UserAnalytics {
  total_posts: number;
  total_comments: number;
  total_likes_given: number;
  total_likes_received: number;
  avg_engagement_score: number;
  total_sessions: number;
}

const Analytics = () => {
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch engagement scores for the last 30 days
      const { data: engagementScores, error: engagementError } = await supabase
        .from('user_engagement_scores')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (engagementError) throw engagementError;

      // Fetch overall user analytics
      const { data: posts } = await supabase
        .from('posts')
        .select('id')
        .eq('author_id', user.id);

      const { data: comments } = await supabase
        .from('post_comments')
        .select('id')
        .eq('user_id', user.id);

      const { data: likesGiven } = await supabase
        .from('post_likes')
        .select('id')
        .eq('user_id', user.id);

      const { data: likesReceived } = await supabase
        .from('post_likes')
        .select('id')
        .in('post_id', posts?.map(p => p.id) || []);

      const { data: sessions } = await supabase
        .from('user_analytics')
        .select('session_id')
        .eq('user_id', user.id)
        .eq('event_type', 'page_view');

      const uniqueSessions = new Set(sessions?.map(s => s.session_id)).size;
      const avgEngagement = engagementScores?.reduce((sum, score) => sum + Number(score.engagement_score), 0) / (engagementScores?.length || 1);

      setEngagementData(engagementScores || []);
      setUserAnalytics({
        total_posts: posts?.length || 0,
        total_comments: comments?.length || 0,
        total_likes_given: likesGiven?.length || 0,
        total_likes_received: likesReceived?.length || 0,
        avg_engagement_score: avgEngagement || 0,
        total_sessions: uniqueSessions
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const trackEvent = async (eventType: string, eventData: any = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_analytics')
        .insert([
          {
            user_id: user.id,
            event_type: eventType,
            event_data: eventData,
            page_url: window.location.pathname
          }
        ]);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  useEffect(() => {
    // Track page view
    trackEvent('page_view', { page: 'analytics' });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  const pieData = userAnalytics ? [
    { name: 'Posts Created', value: userAnalytics.total_posts },
    { name: 'Comments Made', value: userAnalytics.total_comments },
    { name: 'Likes Given', value: userAnalytics.total_likes_given },
    { name: 'Likes Received', value: userAnalytics.total_likes_received },
  ] : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Track your engagement and activity on the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.total_posts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.total_comments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Likes Given</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.total_likes_given || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Likes Received</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.total_likes_received || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.avg_engagement_score.toFixed(1) || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalytics?.total_sessions || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement">Engagement Trends</TabsTrigger>
          <TabsTrigger value="activity">Activity Breakdown</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Score Over Time</CardTitle>
              <CardDescription>
                Your daily engagement score based on posts, comments, and likes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="engagement_score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>
                  Breakdown of your platform activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
                <CardDescription>
                  Posts, comments, and likes over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="posts_created" fill="hsl(var(--primary))" />
                    <Bar dataKey="comments_made" fill="hsl(var(--secondary))" />
                    <Bar dataKey="likes_given" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Insights</CardTitle>
                <CardDescription>
                  AI-powered insights about your activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">📈 Growth Trend</h4>
                  <p className="text-sm text-muted-foreground">
                    Your engagement has been {userAnalytics?.avg_engagement_score > 50 ? 'consistently strong' : 'steadily growing'}. 
                    Keep posting quality content to maintain momentum.
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">🎯 Recommendation</h4>
                  <p className="text-sm text-muted-foreground">
                    {userAnalytics?.total_comments < userAnalytics?.total_posts 
                      ? "Try engaging more with other users' content to build stronger connections."
                      : "Great job staying active in discussions! Your engagement ratio is excellent."
                    }
                  </p>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">⭐ Achievement</h4>
                  <p className="text-sm text-muted-foreground">
                    {userAnalytics?.total_likes_received > userAnalytics?.total_posts * 2
                      ? "Congratulations! Your content resonates well with the community."
                      : "Keep creating engaging content to increase your like-to-post ratio."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Key performance indicators for your profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Engagement Rate</span>
                  <span className="font-semibold">
                    {userAnalytics ? ((userAnalytics.total_likes_received / Math.max(userAnalytics.total_posts, 1)) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Content Quality Score</span>
                  <span className="font-semibold">
                    {userAnalytics?.avg_engagement_score > 75 ? '🌟 Excellent' : 
                     userAnalytics?.avg_engagement_score > 50 ? '👍 Good' : 
                     userAnalytics?.avg_engagement_score > 25 ? '📈 Growing' : '🔄 Building'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Community Impact</span>
                  <span className="font-semibold">
                    {userAnalytics?.total_comments > 20 ? '🏆 High' : 
                     userAnalytics?.total_comments > 10 ? '📢 Medium' : '🌱 Emerging'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;