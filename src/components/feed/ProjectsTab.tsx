import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { useToast } from '@/hooks/use-toast';
import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import FeedProjectCard from './FeedProjectCard';

interface Project {
  id: string;
  title: string;
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
  is_public: boolean | null;
  creator?: {
    full_name: string | null;
    avatar_url: string | null;
  };
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
          creator:creator_id (
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      console.log('ProjectsTab - Fetched projects:', data);
      setProjects(data as any || []);
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



  if (loading) {
    return <div>Loading projects...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-foreground">Latest Projects</h3>
        <ProjectCreationModal onProjectCreated={fetchProjects} />
      </div>
      {projects.length > 0 ? (
        <ResponsiveGrid cols={{ sm: 1, md: 2 }} gap={4}>
          {projects.map((project) => (
            <FeedProjectCard
              key={project.id}
              project={{
                id: project.id,
                name: project.title,
                description: project.description,
                status: project.status,
                location: project.location,
                created_at: project.created_at,
                project_space_type: project.is_public === false ? 'private' : 'public',
                creator: {
                  full_name: project.creator?.full_name || 'Anonymous',
                  avatar_url: project.creator?.avatar_url || null
                }
              }}
            />
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
