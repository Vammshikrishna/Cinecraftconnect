import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Film, 
  DollarSign, 
  Briefcase
} from 'lucide-react';
import { ProjectApplicationDialog } from '@/components/projects/ProjectApplicationDialog';

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
}

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);

  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId || '')
        .single();

      if (error) throw error;
      setProject(data as Project);

      // Check for membership & application
      if (user && projectId) {
        // 1. Check Space ID first (projects vs project_spaces)
        const { data: spaceData } = await supabase
          .from('project_spaces')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (spaceData) {
          const { data: memberData } = await supabase
            .from('project_space_members')
            .select('role')
            .eq('project_space_id', spaceData.id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsMember(!!memberData);
        }

        // 2. Check for application
        const { data: appData } = await supabase
          .from('project_applications')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();
        setHasApplied(!!appData);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({ title: 'Error', description: 'Failed to load project details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'planning': return 'secondary';
      case 'in-production': return 'default';
      case 'completed': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <h2 className="text-2xl font-bold">Project Not Found</h2>
        <Button onClick={() => navigate('/projects')}>View All Projects</Button>
      </div>
    );
  }

  const isOwner = user?.id === project.creator_id;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6 pl-0 hover:bg-transparent hover:text-primary transition-colors flex items-center gap-2 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </Button>

        <div className="glass-card p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <Badge variant={getStatusVariant(project.status)} className="capitalize px-4 py-1 text-sm font-medium">
                {project.status}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gradient">
                {project.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {(isOwner || isMember) ? (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  onClick={() => navigate(`/projects/${project.id}/space`)}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  {isOwner ? 'Manage Workspace' : 'Enter Workspace'}
                </Button>
              ) : (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  disabled={hasApplied}
                  onClick={() => setIsApplicationDialogOpen(true)}
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
                <p className="text-muted-foreground leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </section>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {project.genre?.map(g => (
                    <Badge key={g} variant="secondary" className="bg-secondary/50">{g}</Badge>
                  ))}
                </div>
              </div>
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
                    {new Date(project.start_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
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

              <div className="space-y-3 pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seeking Roles</h4>
                <div className="flex flex-wrap gap-2">
                  {project.required_roles?.map(role => (
                    <Badge key={role} className="bg-primary/5 text-primary border border-primary/20">{role}</Badge>
                  ))}
                </div>
              </div>
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
    </div>
  );
};

export default ProjectDetailPage;
