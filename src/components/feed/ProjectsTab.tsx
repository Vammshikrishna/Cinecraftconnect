import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, DollarSign, Users } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  location: string;
  genre: string[];
  required_roles: string[];
  budget_min: number;
  budget_max: number;
  start_date: string;
  creator_id: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  } | null;
}

const ProjectsTab = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          profiles!creator_id (
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5); // Fetch latest 5 projects for the feed

      if (error) throw error;
      setProjects((data || []) as any);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects.",
        variant: "destructive",
      });
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

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planning': return 'secondary';
      case 'in-production': return 'default';
      case 'post-production': return 'outline';
      case 'completed': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div>Loading projects...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white mb-2">Latest Projects</h3>
      {projects.length > 0 ? (
        <ResponsiveGrid cols={{ sm: 1, md: 2 }} gap={4}>
          {projects.map((project) => (
            <InteractiveCard
              key={project.id}
              title={project.title}
              description={project.description?.substring(0, 80) + '...'}
              variant="hover-lift"
              className="h-full"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant={getStatusVariant(project.status)} className="capitalize">
                    {project.status}
                  </Badge>
                  {project.location && (
                    <div className="flex items-center"><MapPin className="mr-1 h-3 w-3" />{project.location}</div>
                  )}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <DollarSign className="mr-1 h-3 w-3" />
                  {formatBudget(project.budget_min, project.budget_max)}
                </div>
                {project.required_roles && project.required_roles.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                            <Users className="mr-1 h-3 w-3" />
                            Looking for
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {project.required_roles.slice(0, 2).map((role) => (
                            <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                            ))}
                            {project.required_roles.length > 2 && <Badge variant="outline" className="text-xs">+{project.required_roles.length - 2}</Badge>}
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                  <div className="flex items-center">
                     <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2 text-primary-foreground text-xxs">
                        {project.profiles?.full_name?.charAt(0) || 'U'}
                     </div>
                     {project.profiles?.full_name || 'Unknown'}
                  </div>
                  <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </InteractiveCard>
          ))}
        </ResponsiveGrid>
      ) : (
        <div className="text-center py-8 bg-gray-800/50 rounded-lg">
           <p className="text-gray-400">No projects found at the moment.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectsTab;
