import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Unused
// import { formatDistanceToNow } from 'date-fns'; // Unused
import {
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Briefcase,
  Bookmark
} from 'lucide-react';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { ProjectApplicationDialog } from './ProjectApplicationDialog';
import { useToast } from '@/hooks/use-toast';

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
  end_date?: string;
  creator_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    craft?: string;
  } | null;
  project_space_bookmarks?: { user_id: string }[];
}

interface ProjectDetailDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailDialog({ project: initialProject, open, onOpenChange }: ProjectDetailDialogProps) {
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState(initialProject);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);

  useEffect(() => {
    setProject(initialProject);
    if (initialProject) {
      checkApplication();
    }
  }, [initialProject, open]);

  const checkApplication = async () => {
    if (!project || !user) return;
    const { data: space } = await supabase.from('project_spaces').select('id').eq('project_id', project.id).maybeSingle();
    if (!space) { setHasApplied(false); return; }
    const { data } = await supabase.from('project_space_join_requests' as any).select('id').eq('project_space_id', space.id).eq('user_id', user.id).maybeSingle();
    setHasApplied(!!data);
  };

  if (!project) return null;

  const isOwner = user?.id === project.creator_id;
  const isBookmarked = project.project_space_bookmarks?.some(b => b.user_id === user?.id);

  const handleBookmarkToggle = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const newProject = { ...project };

    // Resolve project space ID so foreign key constraint is satisfied
    let spaceId: string | null = null;
    const { data: projectSpace } = await supabase
      .from('project_spaces')
      .select('id')
      .or(`project_id.eq.${project.id},id.eq.${project.id}`)
      .limit(1)
      .maybeSingle();

    if (projectSpace?.id) {
      spaceId = projectSpace.id;
    } else {
      const { data: createdSpace, error: createError } = await (supabase as any)
        .from('project_spaces')
        .insert({
          project_id: project.id,
          name: `${project.title || 'Project'} Workspace`,
          creator_id: project.creator_id || user.id,
        })
        .select('id')
        .maybeSingle();
      if (!createError && createdSpace?.id) spaceId = createdSpace.id;
    }

    if (!spaceId) {
      toast({ title: "Failed to resolve project space", variant: "destructive" });
      return;
    }

    if (isBookmarked) {
      const { error } = await supabase
        .from('project_space_bookmarks')
        .delete()
        .eq('project_space_id', spaceId)
        .eq('user_id', user.id);
      if (!error) {
        newProject.project_space_bookmarks = newProject.project_space_bookmarks?.filter(b => b.user_id !== user.id);
        setProject(newProject);
        window.dispatchEvent(new CustomEvent('projectBookmarkChanged', { detail: { projectId: project.id, isBookmarked: false } }));
        try {
          localStorage.setItem('cc_project_bookmark_sync', JSON.stringify({ projectId: project.id, isBookmarked: false, ts: Date.now() }));
        } catch {}
        toast({ title: "Bookmark removed" });
      }
    } else {
      const { error } = await supabase
        .from('project_space_bookmarks')
        .upsert({ project_space_id: spaceId, user_id: user.id }, { onConflict: 'user_id,project_space_id' });
      if (!error) {
        if (!newProject.project_space_bookmarks) newProject.project_space_bookmarks = [];
        newProject.project_space_bookmarks.push({ user_id: user.id });
        setProject(newProject);
        window.dispatchEvent(new CustomEvent('projectBookmarkChanged', { detail: { projectId: project.id, isBookmarked: true } }));
        try {
          localStorage.setItem('cc_project_bookmark_sync', JSON.stringify({ projectId: project.id, isBookmarked: true, ts: Date.now() }));
        } catch {}
        toast({ title: "Project bookmarked!" });
      }
    }
  };

  const handleApplicationSent = () => {
    setHasApplied(true);
  };

  // Other functions (formatBudget, getStatusVariant) are the same...

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(project.status || 'Active')} className="capitalize w-fit">
                {project.status || 'Active'}
              </Badge>
              {project.genre && project.genre.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.genre.map((g) => (
                    <Badge key={g} variant="outline" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <DialogTitle className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
              {project.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Open Roles Section */}
            <div className="rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm uppercase tracking-wide">
                  <Users className="h-4 w-4" />
                  <span>Open & Required Roles ({project.required_roles?.length || 0})</span>
                </div>
                {!isOwner && (
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs h-8 px-3 shadow-sm"
                    onClick={() => {
                      if (!user) {
                        toast({
                          title: 'Sign in required',
                          description: 'Please sign in to apply for roles.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setIsApplicationDialogOpen(true);
                    }}
                    disabled={hasApplied}
                  >
                    {hasApplied ? 'Applied' : 'Apply for Role'}
                  </Button>
                )}
              </div>

              {project.required_roles && project.required_roles.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {project.required_roles.map((role, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-card border border-red-200/80 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold shadow-2xs"
                    >
                      <span>🎬</span>
                      <span>{role}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific open roles listed yet.</p>
              )}
            </div>

            {/* About / Synopsis */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-foreground">About the Project</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>

            {/* Production Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
              {project.location && (
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>Location: <strong className="text-foreground">{project.location}</strong></span>
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>Timeline: <strong className="text-foreground">{new Date(project.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</strong></span>
                </div>
              )}
              {(project.budget_min || project.budget_max) && (
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <DollarSign className="h-4 w-4 text-primary shrink-0" />
                  <span>Budget: <strong className="text-foreground">₹{(project.budget_min || 0).toLocaleString()} - ₹{(project.budget_max || 0).toLocaleString()}</strong></span>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                onClick={() => {
                  onOpenChange(false);
                  push(`/projects/${project.id}/space`);
                }}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                {isOwner ? 'Manage Workspace' : 'Enter Workspace'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={handleBookmarkToggle}
              >
                <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectApplicationDialog
        project={project as any}
        open={isApplicationDialogOpen}
        onOpenChange={setIsApplicationDialogOpen}
        onApplicationSent={handleApplicationSent}
      />
    </>
  );
}

function getStatusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'planning': return 'secondary';
    case 'in-production': return 'default';
    case 'post-production': return 'outline';
    case 'completed': return 'secondary';
    default: return 'outline';
  }
}
