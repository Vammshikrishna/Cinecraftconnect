import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Unused
// import { formatDistanceToNow } from 'date-fns'; // Unused
import {
  // MapPin, // Unused
  // Calendar, // Unused
  // DollarSign, // Unused
  // Users, // Unused
  // Film, // Unused
  Briefcase,
  Bookmark
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    const { data } = await supabase.from('project_applications').select('id').eq('project_id', project.id).eq('user_id', user.id).maybeSingle();
    setHasApplied(!!data);
  };

  if (!project) return null;

  const isOwner = user?.id === project.creator_id;
  const isBookmarked = project.project_space_bookmarks?.some(b => b.user_id === user?.id);

  const handleBookmarkToggle = async () => {
    if (!user) return;
    const newProject = { ...project };

    if (isBookmarked) {
      const { error } = await supabase.from('project_space_bookmarks').delete().match({ project_space_id: project.id, user_id: user.id });
      if (!error) {
        newProject.project_space_bookmarks = newProject.project_space_bookmarks?.filter(b => b.user_id !== user.id);
        setProject(newProject);
        toast({ title: "Bookmark removed" });
      }
    } else {
      const { error } = await supabase.from('project_space_bookmarks').insert({ project_space_id: project.id, user_id: user.id });
      if (!error) {
        if (!newProject.project_space_bookmarks) newProject.project_space_bookmarks = [];
        newProject.project_space_bookmarks.push({ user_id: user.id });
        setProject(newProject);
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold mb-4">{project.title}</DialogTitle>
            <Badge variant={getStatusVariant(project.status)} className="capitalize w-fit">{project.status}</Badge>
          </DialogHeader>

          <div className="space-y-6">
            {/* ... other sections are the same ... */}

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button className="flex-1" onClick={() => { onOpenChange(false); navigate(`/projects/${project.id}/space`); }}>
                <Briefcase className="mr-2 h-4 w-4" />
                {isOwner ? 'Manage Project Space' : 'View Project Space'}
              </Button>
              {!isOwner && (
                <Button variant="default" className="flex-1" onClick={() => setIsApplicationDialogOpen(true)} disabled={hasApplied}>
                  {hasApplied ? 'Application Sent' : 'Apply to Join'}
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={handleBookmarkToggle}>
                <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectApplicationDialog
        project={project}
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
