

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { ProjectSpace } from '@/components/projects/ProjectSpace';
import { BackButton } from '@/components/common/BackButton';
import { useAuth } from '@/contexts/AuthContext';

import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';

interface Project {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  image_url?: string | null;
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
            .select('id, title, description, creator_id, image_url')
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
          image_url: (projectRes.data as any).image_url ?? null,
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

  if (loading || authLoading) return <ScreenSkeleton variant="detail" />;

  if (error || !project) {
    return (
      <div className="h-dvh w-full bg-background flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{error ? 'Could not open this space' : 'Project not found'}</h1>
          <p className="text-muted-foreground mb-6">{error || 'It may have been removed or you may not have access.'}</p>
          {error && <button type="button" onClick={() => window.location.reload()} className="mb-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Try again</button>}
          <BackButton label="BACK TO PROJECTS" to="/projects" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-x-0 top-0 h-[100dvh] pt-[env(safe-area-inset-top)] lg:pt-3 lg:left-[72px] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background flex flex-col z-30",
      (!isKeyboardVisible && !isEmojiPickerOpen) && "pb-[env(safe-area-inset-bottom)]"
    )}>
      <div className="flex-1 flex flex-col lg:p-4 lg:pt-0 lg:pb-0 overflow-hidden">
        <ProjectSpace
          projectId={project.id}
          projectTitle={project.title}
          projectDescription={project.description || ''}
          projectImageUrl={project.image_url || undefined}
          projectCreatorId={project.creator_id}
          initialSpaceId={spaceId}
        />
      </div>
    </div>
  );
};

export default ProjectSpacePage;
