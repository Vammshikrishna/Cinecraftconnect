import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { Film, MapPin, Calendar, DollarSign, Users, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  description: string;
  genre: string[];
  location: string;
  budget_min: number;
  budget_max: number;
  required_roles: string[];
  status: string;
  created_at: string;
  creator_id: string;
}

export const ProjectRecommendations = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchRecommendations();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      // Fetch public projects, excluding user's own projects
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_public', true)
        .neq('creator_id', user?.id)
        .eq('status', 'planning')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Simple recommendation logic based on user's craft
      let filteredProjects = data || [];
      
      if (userProfile?.craft) {
        // Prioritize projects that need the user's craft
        filteredProjects = filteredProjects.sort((a, b) => {
          const aMatches = a.required_roles?.includes(userProfile.craft) ? 1 : 0;
          const bMatches = b.required_roles?.includes(userProfile.craft) ? 1 : 0;
          return bMatches - aMatches;
        });
      }

      setRecommendations(filteredProjects.slice(0, 6));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Budget TBD';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const getRecommendationScore = (project: Project) => {
    let score = 0;
    
    // Higher score if user's craft is needed
    if (userProfile?.craft && project.required_roles?.includes(userProfile.craft)) {
      score += 3;
    }
    
    // Higher score for newer projects
    const daysOld = Math.floor((Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld < 7) score += 2;
    else if (daysOld < 30) score += 1;
    
    // Higher score for projects with budget
    if (project.budget_min || project.budget_max) score += 1;
    
    return score;
  };

  if (loading) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Project Recommendations</CardTitle>
          <CardDescription>Loading personalized recommendations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
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
            <Film className="mr-2 h-5 w-5" />
            Recommended Projects
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link to="/explore">View All</Link>
          </Button>
        </CardTitle>
        <CardDescription>
          Projects that match your skills and interests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((project, index) => {
              const score = getRecommendationScore(project);
              const isHighMatch = score >= 3;
              
              return (
                <div key={project.id}>
                  <div className={`p-4 rounded-lg border transition-all hover:border-cinesphere-purple/50 ${
                    isHighMatch 
                      ? 'border-cinesphere-purple/30 bg-cinesphere-purple/5' 
                      : 'border-white/10 hover:bg-white/5'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">{project.title}</h4>
                          {isHighMatch && (
                            <Badge variant="secondary" className="text-xs bg-cinesphere-purple/20 text-cinesphere-purple">
                              High Match
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                          {project.description}
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/projects/${project.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      {project.location && (
                        <div className="flex items-center text-gray-300">
                          <MapPin className="mr-1 h-3 w-3" />
                          <span>{project.location}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-gray-300">
                        <DollarSign className="mr-1 h-3 w-3" />
                        <span>{formatBudget(project.budget_min, project.budget_max)}</span>
                      </div>
                    </div>

                    {project.required_roles && project.required_roles.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1 flex items-center">
                          <Users className="mr-1 h-3 w-3" />
                          Looking for:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {project.required_roles.slice(0, 3).map((role) => (
                            <Badge 
                              key={role} 
                              variant="outline" 
                              className={`text-xs ${
                                userProfile?.craft === role 
                                  ? 'border-cinesphere-purple text-cinesphere-purple' 
                                  : ''
                              }`}
                            >
                              {role}
                            </Badge>
                          ))}
                          {project.required_roles.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{project.required_roles.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {project.genre && project.genre.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {project.genre.slice(0, 2).map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Posted {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/projects/${project.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {index < recommendations.length - 1 && <Separator className="my-2 bg-white/10" />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Film className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400 mb-2">No recommendations available</p>
            <p className="text-gray-500 text-sm mb-4">
              Complete your profile to get personalized project recommendations
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/profile">Complete Profile</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};