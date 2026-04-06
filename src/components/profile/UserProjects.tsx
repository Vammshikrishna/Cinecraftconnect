import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Film, DollarSign, ExternalLink } from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Link } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  genre: string[] | null;
  required_roles: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
}

interface UserProjectsProps {
  userId?: string;
}

const getStatusColor = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'in production':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'pre-production':
    case 'planning':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'completed':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'on hold':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    default:
      return 'bg-secondary/50 text-muted-foreground border-border';
  }
};

export const UserProjects = ({ userId }: UserProjectsProps) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    const fetchProjects = async () => {
      setLoading(true);
      try {
        // 1. Fetch projects where user is the creator
        const { data: createdProjects, error: createdError } = await supabase
          .from('projects')
          .select('*')
          .eq('creator_id', targetUserId);

        if (createdError) throw createdError;

        // 2. Fetch projects where user is a member via project_space_members
        // First get the space IDs
        const { data: memberships, error: memberError } = await supabase
          .from('project_space_members' as any)
          .select(`
            project_spaces (
              project_id
            )
          `)
          .eq('user_id', targetUserId);

        if (memberError) throw memberError;

        const projectIdsFromSpaces = memberships?.map((m: any) => m.project_spaces?.project_id).filter(Boolean) || [];
        
        let allProjects = [...(createdProjects || [])];

        // 3. If there are memberships, fetch those projects too if they're not already in the list
        if (projectIdsFromSpaces.length > 0) {
          const existingIds = new Set(allProjects.map(p => p.id));
          const newIds = projectIdsFromSpaces.filter(id => !existingIds.has(id));

          if (newIds.length > 0) {
            const { data: joinedProjects, error: joinedError } = await supabase
              .from('projects')
              .select('*')
              .in('id', newIds);
            
            if (joinedError) throw joinedError;
            
            if (joinedProjects) {
              allProjects = [...allProjects, ...joinedProjects];
            }
          }
        }

        // Sort by created_at descending
        allProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setProjects(allProjects as Project[]);
      } catch (err) {
        console.error('Error fetching user projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();

    const channel = supabase
      .channel(`user-projects-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `creator_id=eq.${targetUserId}`
        },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <EnhancedSkeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Film className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
        <p className="text-muted-foreground max-w-md">
          This user hasn't created any projects yet. Check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {projects.map((project) => (
        <Link key={project.id} to={`/projects/${project.id}`}>
          <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:scale-[1.02] h-full">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardHeader className="relative pb-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-2">
                  {project.title}
                </CardTitle>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>

              {project.status && (
                <Badge
                  className={`w-fit text-xs font-medium px-3 py-1 ${getStatusColor(project.status)}`}
                  variant="outline"
                >
                  {project.status}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="relative space-y-4">
              {/* Description */}
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {project.description}
                </p>
              )}

              {/* Genres */}
              {project.genre && project.genre.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {project.genre.slice(0, 3).map((g, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs font-normal bg-secondary/50 hover:bg-secondary/70 transition-colors"
                    >
                      {g}
                    </Badge>
                  ))}
                  {project.genre.length > 3 && (
                    <Badge variant="secondary" className="text-xs font-normal bg-secondary/30">
                      +{project.genre.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              {/* Project Details Grid */}
              <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-border/50">
                {project.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary/70 shrink-0" />
                    <span className="truncate">{project.location}</span>
                  </div>
                )}

                {project.start_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary/70 shrink-0" />
                    <span>
                      {new Date(project.start_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}`}
                    </span>
                  </div>
                )}

                {project.required_roles && project.required_roles.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 text-primary/70 shrink-0" />
                    <span className="truncate">
                      {project.required_roles.slice(0, 2).join(', ')}
                      {project.required_roles.length > 2 && ` +${project.required_roles.length - 2}`}
                    </span>
                  </div>
                )}

                {(project.budget_min || project.budget_max) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4 text-primary/70 shrink-0" />
                    <span>
                      {project.budget_min && project.budget_max
                        ? `₹${project.budget_min.toLocaleString()} - ₹${project.budget_max.toLocaleString()}`
                        : project.budget_min
                          ? `From ₹${project.budget_min.toLocaleString()}`
                          : `Up to ₹${project.budget_max?.toLocaleString()}`
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* View Project Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
              >
                View Project Details
              </Button>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};
