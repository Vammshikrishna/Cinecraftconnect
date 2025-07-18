import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Film, Star, MessageCircle } from 'lucide-react';

interface Stats {
  projectsCreated: number;
  collaborations: number;
  portfolioItems: number;
  ratingsGiven: number;
  profileViews: number;
}

export const StatsOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    projectsCreated: 0,
    collaborations: 0,
    portfolioItems: 0,
    ratingsGiven: 0,
    profileViews: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch projects created
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', user?.id);

      // Fetch collaborations posted
      const { data: collaborations } = await supabase
        .from('collaborations')
        .select('id')
        .eq('poster_id', user?.id);

      // Fetch portfolio items
      const { data: portfolioItems } = await supabase
        .from('portfolio_items')
        .select('id')
        .eq('user_id', user?.id);

      // Fetch movie ratings
      const { data: ratings } = await supabase
        .from('movie_ratings')
        .select('id')
        .eq('user_id', user?.id);

      setStats({
        projectsCreated: projects?.length || 0,
        collaborations: collaborations?.length || 0,
        portfolioItems: portfolioItems?.length || 0,
        ratingsGiven: ratings?.length || 0,
        profileViews: Math.floor(Math.random() * 50) + 10 // Mock data for profile views
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityLevel = () => {
    const total = stats.projectsCreated + stats.collaborations + stats.portfolioItems + stats.ratingsGiven;
    if (total >= 20) return { level: 'Expert', progress: 100, color: 'bg-yellow-500' };
    if (total >= 10) return { level: 'Active', progress: 75, color: 'bg-green-500' };
    if (total >= 5) return { level: 'Growing', progress: 50, color: 'bg-blue-500' };
    return { level: 'Beginner', progress: 25, color: 'bg-purple-500' };
  };

  const activityLevel = getActivityLevel();

  if (loading) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Your Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Your Stats
        </CardTitle>
        <CardDescription>Your activity summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activity Level */}
        <div className="p-3 rounded-lg bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Activity Level</span>
            <span className={`text-xs px-2 py-1 rounded-full ${activityLevel.color} text-white`}>
              {activityLevel.level}
            </span>
          </div>
          <Progress value={activityLevel.progress} className="h-2" />
        </div>

        {/* Individual Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
            <div className="flex items-center justify-between">
              <Film className="h-5 w-5 text-blue-400" />
              <span className="text-xl font-bold text-white">{stats.projectsCreated}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Projects</p>
          </div>

          <div className="p-3 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-green-400" />
              <span className="text-xl font-bold text-white">{stats.collaborations}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Collaborations</p>
          </div>

          <div className="p-3 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
            <div className="flex items-center justify-between">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-xl font-bold text-white">{stats.ratingsGiven}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Ratings</p>
          </div>

          <div className="p-3 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
            <div className="flex items-center justify-between">
              <MessageCircle className="h-5 w-5 text-purple-400" />
              <span className="text-xl font-bold text-white">{stats.portfolioItems}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Portfolio</p>
          </div>
        </div>

        {/* Profile Views */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-cinesphere-purple/10 to-cinesphere-blue/10 border border-cinesphere-purple/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Profile Views</span>
            <span className="text-lg font-bold text-cinesphere-purple">{stats.profileViews}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </CardContent>
    </Card>
  );
};