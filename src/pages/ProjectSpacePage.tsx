

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { ProjectSpace } from '@/components/projects/ProjectSpace';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BackButton } from '@/components/common/BackButton';
import { useAuth } from '@/contexts/AuthContext';

import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
}

const ProjectSpacePage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { push } = useAppNavigation();
  const { user, isLoading: authLoading } = useAuth();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const { isKeyboardVisible, isEmojiPickerOpen } = useKeyboard();
  const location = useLocation();
  const initialState = location.state as { project?: Project } | null;
  const [project, setProject] = useState<Project | null>(initialState?.project || null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialState?.project);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      push(`/projects/${projectId}`, { noScroll: true });
      return;
    }

    if (isFan && !isInternal) {
      push('/404');
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

    const fetchProjectAndSpace = async () => {
      try {
        // Fetch project data AND space ID in parallel — one round trip
        const [projectRes, spaceRes] = await Promise.all([
          supabase
            .from('projects')
            .select('id, title, description, creator_id')
            .eq('id', projectId)
            .maybeSingle(),
          supabase
            .from('project_spaces')
            .select('id')
            .eq('project_id', projectId)
            .maybeSingle()
        ]);

        if (projectRes.error) throw projectRes.error;

        if (!projectRes.data) {
          setError('Project not found');
          setLoading(false);
          return;
        }

        setProject({
          id: projectRes.data.id,
          title: projectRes.data.title,
          description: projectRes.data.description,
          creator_id: projectRes.data.creator_id,
        });

        if (spaceRes.data) {
          setSpaceId(spaceRes.data.id);
        }
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project space');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndSpace();
  }, [projectId, authLoading, user, isFan, isInternal, push]);

  if (loading || authLoading) {
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
      "fixed inset-x-0 top-0 h-[100dvh] pt-[calc(env(safe-area-inset-top)+56px)] lg:pt-16 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background flex flex-col z-40",
      (!isKeyboardVisible && !isEmojiPickerOpen) && "pb-[calc(env(safe-area-inset-bottom)+76px)] lg:pb-[env(safe-area-inset-bottom)]"
    )}>
      <div className="flex-1 flex flex-col lg:p-4 lg:pt-0 lg:pb-0 overflow-hidden">
        <ProjectSpace
          projectId={project.id}
          projectTitle={project.title}
          projectDescription={project.description || ''}
          projectCreatorId={project.creator_id}
          initialSpaceId={spaceId}
        />
      </div>
    </div>
  );
};

export default ProjectSpacePage;
