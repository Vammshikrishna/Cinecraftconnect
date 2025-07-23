
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  Eye,
  Film,
  Plus
} from 'lucide-react';

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
  creator_id: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  } | null;
}

const Projects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchProjects();
  }, [activeTab]);

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeTab === 'my') {
        query = query.eq('creator_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProjects(data || []);
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

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return 'Budget TBD';
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `$${min.toLocaleString()}+`;
    return `Up to $${max?.toLocaleString()}`;
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <InteractiveCard
      title={project.title}
      description={project.description?.substring(0, 100) + (project.description?.length > 100 ? '...' : '')}
      variant="hover-lift"
      className="h-full"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">
            {project.status}
          </Badge>
          {project.location && (
            <div className="flex items-center text-muted-foreground text-sm">
              <MapPin className="mr-1 h-3 w-3" />
              {project.location}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center text-muted-foreground text-sm">
            <DollarSign className="mr-1 h-4 w-4" />
            {formatBudget(project.budget_min, project.budget_max)}
          </div>
          {project.start_date && (
            <div className="flex items-center text-muted-foreground text-sm">
              <Calendar className="mr-1 h-4 w-4" />
              {formatDistanceToNow(new Date(project.start_date), { addSuffix: true })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {project.genre && project.genre.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Genres</p>
              <div className="flex flex-wrap gap-1">
                {project.genre.slice(0, 3).map((g) => (
                  <Badge key={g} variant="secondary" className="text-xs">
                    {g}
                  </Badge>
                ))}
                {project.genre.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{project.genre.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {project.required_roles && project.required_roles.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                <Users className="mr-1 h-4 w-4" />
                Looking for
              </p>
              <div className="flex flex-wrap gap-1">
                {project.required_roles.slice(0, 3).map((role) => (
                  <Badge key={role} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
                {project.required_roles.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{project.required_roles.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center text-muted-foreground text-sm">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center mr-2 text-primary-foreground text-xs">
              {project.profiles?.full_name?.charAt(0) || 'U'}
            </div>
            {project.profiles?.full_name || 'Unknown'}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </InteractiveCard>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <EnhancedSkeleton className="h-8 w-48 mb-2" />
              <EnhancedSkeleton className="h-4 w-64" />
            </div>
            <EnhancedSkeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <Film className="mr-3 h-8 w-8 text-primary" />
              Projects
            </h1>
            <p className="text-muted-foreground">Discover and collaborate on film projects</p>
          </div>
          <ProjectCreationModal onProjectCreated={fetchProjects} />
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <Button variant="outline" className="border-white/20 hover:bg-white/10">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-cinesphere-dark/50 border border-white/10">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                All Projects ({projects.length})
              </TabsTrigger>
              <TabsTrigger 
                value="my"
                className="data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                My Projects
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Film className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              {searchTerm ? 'No projects match your search' : 'No projects found'}
            </p>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Be the first to create a project'}
            </p>
            {!searchTerm && (
              <ProjectCreationModal onProjectCreated={fetchProjects} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
