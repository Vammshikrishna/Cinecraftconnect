import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, DollarSign, Users } from 'lucide-react';
import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  location: string | null;
  genre: string[] | null;
  required_roles: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  start_date: string | null;
  creator_id: string;
  created_at: string;
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
        .from('project_spaces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      console.log('ProjectsTab - Fetched projects:', data);
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

  const formatBudget = (min?: number | null, max?: number | null) => {
    if (!min && !max) return 'Budget TBD';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const getStatusVariant = (status: string | null) => {
    if (!status) return 'outline';
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
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-white">Latest Projects</h3>
        <ProjectCreationModal onProjectCreated={fetchProjects} />
      </div>
      {projects.length > 0 ? (
        <ResponsiveGrid cols={{ sm: 1, md: 2 }} gap={4}>
          {projects.map((project) => (
            <InteractiveCard
              key={project.id}
              title={project.name}
              description={project.description?.substring(0, 80) + '...' || 'No description'}
              variant="hover-lift"
              className="h-full"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant={getStatusVariant(project.status)} className="capitalize">
                    {project.status || 'Unknown'}
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
                      P
                    </div>
                    Project Creator
                  </div>
                  <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </InteractiveCard>
          ))}
        </ResponsiveGrid>
      ) : (
        <div className="text-center py-8 bg-gray-800/50 rounded-lg flex flex-col items-center justify-center space-y-4">
          <p className="text-gray-400">No projects found at the moment.</p>
          <ProjectCreationModal onProjectCreated={fetchProjects} />
        </div>
      )}
    </div>
  );
};

export default ProjectsTab;
