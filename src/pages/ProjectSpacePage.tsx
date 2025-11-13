
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProjectSpace } from '@/components/projects/ProjectSpace';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Project {
  id: string;
  title: string;
  description: string | null;
}

const ProjectSpacePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setError('No project ID provided');
      setLoading(false);
      return;
    }

    const fetchProjectAndRoom = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, title, description')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        if (!projectData) {
          setError('Project not found');
          return;
        }
        setProject(projectData);

        const { data: roomData, error: roomError } = await supabase
          .from('discussion_rooms')
          .select('id')
          .eq('project_id', projectId)
          .single();

        if (roomError && roomError.code !== 'PGRST116') throw roomError;

        if (roomData) {
          setRoomId(roomData.id);
        }

      } catch (err) {
        console.error('Error fetching project space data:', err);
        setError('Failed to load project space');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndRoom();
  }, [projectId]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-6">{error || 'Project not found'}</p>
          <Button onClick={() => navigate('/projects')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }
  
  if (!roomId) {
    return (
        <div className="h-screen w-screen bg-background flex flex-col items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Project Space Not Found</h1>
                <p className="text-muted-foreground mb-6">This project does not have an associated collaboration space.</p>
                <Button onClick={() => navigate('/projects')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Projects
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col p-4 pt-20">
        <ProjectSpace
            projectId={project.id}
            projectTitle={project.title}
            projectDescription={project.description || ''}
            roomId={roomId}
        />
    </div>
  );
};

export default ProjectSpacePage;
