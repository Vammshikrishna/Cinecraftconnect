import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ProjectRecommendations } from '@/components/dashboard/ProjectRecommendations';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { Plus, TrendingUp, Users, Film, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      // Fetch recent projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(3);

      setProfile(profileData);
      setRecentProjects(projectsData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProfileCompletion = () => {
    if (!profile) return 0;
    const fields = ['full_name', 'bio', 'craft', 'location', 'avatar_url'];
    const completed = fields.filter(field => profile[field]).length;
    return (completed / fields.length) * 100;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-cinesphere-dark flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cinesphere-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cinesphere-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-cinesphere-purple text-white text-xl">
                  {profile?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Welcome back, {profile?.full_name || 'Filmmaker'}!
                </h1>
                <p className="text-gray-300">
                  {profile?.craft && (
                    <Badge variant="secondary" className="mr-2">{profile.craft}</Badge>
                  )}
                  Ready to create something amazing today?
                </p>
              </div>
            </div>
            <QuickActions />
          </div>
        </div>

        {/* Profile Completion */}
        {getProfileCompletion() < 100 && (
          <Card className="mb-8 border-cinesphere-purple/20 bg-cinesphere-dark/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Complete Your Profile
              </CardTitle>
              <CardDescription>
                Boost your visibility by completing your profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Profile completion</span>
                  <span className="text-white">{Math.round(getProfileCompletion())}%</span>
                </div>
                <Progress value={getProfileCompletion()} className="h-2" />
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/profile">Complete Profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats and Quick Info */}
          <div className="lg:col-span-1 space-y-6">
            <StatsOverview />
            
            {/* Recent Projects */}
            <Card className="border-white/10 bg-cinesphere-dark/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center">
                    <Film className="mr-2 h-5 w-5" />
                    Recent Projects
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/projects">View All</Link>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentProjects.length > 0 ? (
                  <div className="space-y-3">
                    {recentProjects.map((project) => (
                      <div key={project.id} className="p-3 rounded-lg border border-white/10 hover:border-cinesphere-purple/50 transition-colors">
                        <h4 className="font-semibold text-white text-sm">{project.title}</h4>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">{project.description}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {project.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-400 mb-2">No projects yet</p>
                    <Button asChild size="sm">
                      <Link to="/projects">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Project
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity and Recommendations */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="activity" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="activity">Activity Feed</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>
              
              <TabsContent value="activity" className="mt-6">
                <ActivityFeed />
              </TabsContent>
              
              <TabsContent value="recommendations" className="mt-6">
                <ProjectRecommendations />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;