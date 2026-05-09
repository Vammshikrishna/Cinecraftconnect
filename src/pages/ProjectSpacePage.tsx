
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProjectSpace } from '@/components/projects/ProjectSpace';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BackButton } from '@/components/common/BackButton';

import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  description: string | null;
}

const ProjectSpacePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const { isKeyboardVisible, isEmojiPickerOpen } = useKeyboard();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isFan && !isInternal) {
      navigate('/pricing');
      return;
    }

    // Global blur on mount/route change to kill any background focus triggers
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!projectId) {
      setError('No project ID provided');
      setLoading(false);
      return;
    }

    const fetchProject = async () => {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, title, description')
          .eq('id', projectId)
          .maybeSingle();

        if (projectError) throw projectError;
        
        if (!projectData) {
          setError('Project not found');
          setLoading(false);
          return;
        }
        
        setProject({ id: projectData.id, title: projectData.title, description: projectData.description });

      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project space');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
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
          <BackButton label="BACK TO PROJECTS" to="/projects" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 pt-[calc(env(safe-area-inset-top)+56px)] md:pt-16 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background flex flex-col z-40",
      (!isKeyboardVisible && !isEmojiPickerOpen) && "pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-0"
    )}>
      <div className="flex-1 flex flex-col lg:p-4 lg:pt-0 lg:pb-0 overflow-hidden">
        <ProjectSpace
          projectId={project.id}
          projectTitle={project.title}
          projectDescription={project.description || ''}
        />
      </div>
    </div>
  );
};

export default ProjectSpacePage;
