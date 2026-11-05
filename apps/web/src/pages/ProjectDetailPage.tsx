import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { useAccountType } from '@/hooks/useAccountType';
import { 
  MapPin, 
  Calendar, 
  Film, 
  DollarSign, 
  Briefcase
} from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import { ProjectApplicationDialog } from '@/components/projects/ProjectApplicationDialog';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';
import { LoadError } from '@/components/settings/LoadError';

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
  end_date?: string | null;
  creator_id: string;
  created_at: string;
}

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const { push, replace } = useAppNavigation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { isInternal } = useAppRole();
  const { isFan } = useAccountType();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const [loadFailed, setLoadFailed] = useState(false);

  const fetchProject = async () => {
    setLoading(true);
    setLoadFailed(false);
    let redirecting = false;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId || '')
        .single();

      if (error) {
        // no row means it does not exist; any other error is a failed load
        if (error.code === 'PGRST116') { setProject(null); return; }
        throw error;
      }
      setProject(data);

      // Check for membership & application
      if (user && projectId) {
        // 1. Check Space ID first (projects vs project_spaces)
        let appliedViaSpace = false;
        const { data: spaceData } = await supabase
          .from('project_spaces')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

          if (spaceData) {
            // applications are saved as join requests on the space (ProjectApplicationDialog)
            const { data: joinReq } = await supabase
              .from('project_space_join_requests' as any)
              .select('id')
              .eq('project_space_id', spaceData.id)
              .eq('user_id', user.id)
              .maybeSingle();
            appliedViaSpace = !!joinReq;
            const { data: memberData } = await supabase
              .from('project_space_members')
              .select('role')
              .eq('project_space_id', spaceData.id)
              .eq('user_id', user.id)
              .maybeSingle();
            
            const isOwner = user.id === data.creator_id;
            const isMemberRes = !!memberData;
            
            setIsMember(isMemberRes);

            // Auto-redirect if member or owner
            if (isMemberRes || isOwner || isInternal) {
              // replace, not push: with push the back button returned to this page, which redirected again (a trap)
              redirecting = true;
              replace(`/projects/${projectId}/space`, { noScroll: true });
              return; // Exit early
            }
          }

        // 2. Check for application
        const { data: appData, error: appError } = await supabase
        .from('project_applications')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (appError) console.error('Error checking application:', appError);
      setHasApplied(appliedViaSpace || !!appData);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setLoadFailed(true);
    } finally {
      // keep the skeleton while we hand over to the space, so the detail page never flashes
      if (!redirecting) setLoading(false);
    }
  };

  const getStatusVariant = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'planning': return 'secondary';
      case 'in-production': return 'default';
      case 'completed': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) return <ScreenSkeleton variant="detail" />;
  if (!project && loadFailed) {
    return (
      <div className="flex min-h-dvh items-center justify-center flex-col gap-4 px-4">
        <LoadError title="Could not load this project" onRetry={() => fetchProject()} />
        <Button variant="outline" onClick={() => push('/projects', { noScroll: true })}>View All Projects</Button>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-dvh items-center justify-center flex-col gap-4">
        <h2 className="text-2xl font-bold">Project Not Found</h2>
        <Button onClick={() => push('/projects', { noScroll: true })}>View All Projects</Button>
      </div>
    );
  }

  const isOwner = user?.id === project.creator_id;

  return (
    <div className="min-h-dvh bg-background pt-24 pb-40">
      <div className="max-w-[1152px] mx-auto px-4 md:px-8">
        <BackButton className="mb-6" to="/projects" />

        <div className="glass-card p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <Badge variant={getStatusVariant(project.status)} className="capitalize px-4 py-1 text-sm font-medium">
                {project.status || 'Planning'}
              </Badge>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gradient leading-tight">
                {project.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button aria-label="Share" variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setShowShareSheet(true)}>
                <ShareIcon className="h-4 w-4" />
              </Button>
              {(isOwner || isMember || isInternal) ? (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  onClick={() => push(`/projects/${project.id}/space`)}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  {isOwner ? 'Manage Workspace' : isInternal ? 'Enter Workspace (Staff)' : 'Enter Workspace'}
                </Button>
              ) : isFan ? null : (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  // the page is public, so it can draw before the sign-in check finishes: do not tell a signed-in person to sign in
                  disabled={hasApplied || authLoading}
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: 'Sign in required',
                        description: 'Redirecting to sign in page...',
                      });
                      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
                      return;
                    }
                    setIsApplicationDialogOpen(true);
                  }}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  {hasApplied ? 'Application Sent' : 'Apply to Join'}
                </Button>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" />
                  About the Project
                </h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                  {project.description || 'No description provided.'}
                </p>
              </section>

              {!!project.genre?.length && <div className="space-y-4">
                <h3 className="text-lg font-semibold">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {project.genre?.map(g => (
                    <Badge key={g} variant="secondary" className="bg-secondary/50">{g}</Badge>
                  ))}
                </div>
              </div>}
            </div>

            <div className="glass-card p-6 space-y-6 border-primary/10">
              <h3 className="text-lg font-semibold border-b border-border/50 pb-2">Production Details</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-full bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <span>{project.location || 'Remote / Flexible'}</span>
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <span>
                    {project.start_date 
                      ? new Date(project.start_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                      : 'Start Date TBD'}
                    {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-full bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <span>
                    {project.budget_min && project.budget_max 
                      ? `₹${project.budget_min.toLocaleString()} - ₹${project.budget_max.toLocaleString()}`
                      : 'Budget Discussable'}
                  </span>
                </div>
              </div>

              {!!project.required_roles?.length && <div className="space-y-3 pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seeking Roles</h4>
                <div className="flex flex-wrap gap-2">
                  {project.required_roles?.map(role => (
                    <Badge key={role} className="bg-primary/5 text-primary border border-primary/20">{role}</Badge>
                  ))}
                </div>
              </div>}
            </div>
          </div>
        </div>
      </div>

      <ProjectApplicationDialog
        project={project as any}
        open={isApplicationDialogOpen}
        onOpenChange={setIsApplicationDialogOpen}
        onApplicationSent={() => setHasApplied(true)}
      />

      <UniversalShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        shareType="project"
        shareId={project.id}
        shareData={{
          projectId: project.id,
          title: project.title,
          description: project.description,
          location: project.location,
          genre: project.genre
        }}
      />
    </div>
  );
};

export default ProjectDetailPage;
