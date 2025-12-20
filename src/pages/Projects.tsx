
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import { ProjectDetailDialog } from '@/components/projects/ProjectDetailDialog';
import { ProjectFilters, FilterState } from '@/components/projects/ProjectFilters';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  MapPin,
  Film,
  Bookmark,
  ChevronRight
} from 'lucide-react';
import { getGradientForString } from '@/utils/colors';

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
  is_bookmarked?: boolean;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Projects = ({ openCreate = false }: { openCreate?: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    roles: [],
    status: [],
    locations: []
  });

  useEffect(() => {
    fetchProjects();
  }, [activeTab, user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Fetch projects with creator profiles
      let query = supabase
        .from('projects')
        .select(`
          *,
          profiles:creator_id (
            full_name,
            username,
            avatar_url
          )
        `);

      if (activeTab === 'my') {
        if (!user) { setProjects([]); setLoading(false); return; }
        query = query.eq('creator_id', user.id);
      }

      const { data: projectsData, error: projectsError } = await query.order('created_at', { ascending: false });

      if (projectsError && projectsError.code !== 'PGRST116') throw projectsError;

      let projectsWithBookmarks: Project[] = (projectsData || []).map(p => ({ ...p, is_bookmarked: false })) as unknown as Project[];

      // Fetch bookmarks for the current user if logged in
      if (user) {
        // Get project_space IDs that are bookmarked
        const { data: bookmarksData, error: bookmarksError } = await supabase
          .from('project_space_bookmarks')
          .select('project_space_id');

        if (!bookmarksError && bookmarksData) {
          // Get the project IDs from project_spaces
          const spaceIds = bookmarksData.map(b => b.project_space_id);

          if (spaceIds.length > 0) {
            const { data: spacesData } = await supabase
              .from('project_spaces')
              .select('project_id')
              .in('id', spaceIds);

            const bookmarkedProjectIds = new Set(spacesData?.map(s => s.project_id) || []);

            // Mark projects as bookmarked
            projectsWithBookmarks = (projectsData || []).map((project: any) => ({
              ...project,
              is_bookmarked: bookmarkedProjectIds.has(project.id)
            }));

            // Filter for bookmarked tab
            if (activeTab === 'bookmarked') {
              projectsWithBookmarks = projectsWithBookmarks.filter(p => p.is_bookmarked);
            }
          }
        }
      }

      setProjects(projectsWithBookmarks as any);
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

  const filteredProjects = projects.filter(project => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      project.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status.length === 0 || filters.status.includes(project.status);
    const matchesGenre = filters.genres.length === 0 || (project.genre && filters.genres.some(g => project.genre.includes(g)));
    const matchesRole = filters.roles.length === 0 || (project.required_roles && filters.roles.some(r => project.required_roles.includes(r)));
    return matchesSearch && matchesStatus && matchesGenre && matchesRole;
  });

  const handleBookmarkToggle = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isBookmarked = project.is_bookmarked;
    const newProjects = [...projects];
    const projectIndex = newProjects.findIndex(p => p.id === project.id);

    // First, get or create the project_space for this project
    const { data: projectSpace } = await supabase
      .from('project_spaces')
      .select('id')
      .eq('project_id', project.id)
      .single();

    if (!projectSpace) {
      toast({ title: "Error", description: "Project space not found", variant: "destructive" });
      return;
    }

    if (isBookmarked) {
      const { error } = await supabase
        .from('project_space_bookmarks')
        .delete()
        .match({ project_space_id: projectSpace.id, user_id: user.id });

      if (!error) {
        newProjects[projectIndex].is_bookmarked = false;
        setProjects(newProjects);
        toast({ title: "Bookmark removed" });
      }
    } else {
      const { error } = await supabase
        .from('project_space_bookmarks')
        .insert({ project_space_id: projectSpace.id, user_id: user.id });

      if (!error) {
        newProjects[projectIndex].is_bookmarked = true;
        setProjects(newProjects);
        toast({ title: "Project bookmarked!" });
      }
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const isBookmarked = project.is_bookmarked;
    const navigate = useNavigate();

    const handleCardClick = () => {
      navigate(`/projects/${project.id}/space`);
    };

    const handleBookmarkClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await handleBookmarkToggle(project, e);
    };

    return (
      <div
        onClick={handleCardClick}
        className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer hover:-translate-y-1"
      >
        {/* Image Section */}
        {/* Image Section */}
        <div
          className="relative w-full h-48 overflow-hidden"
          style={{ background: getGradientForString(project.title) }}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Film className="w-16 h-16 text-white/30" />
          </div>

          {/* Bookmark Button */}
          <button
            onClick={handleBookmarkClick}
            className="absolute top-3 right-3 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-all hover:scale-110 z-10"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
          </button>

          {/* New Badge */}
          {new Date(project.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-primary text-primary-foreground shadow-lg animate-pulse">New</Badge>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute bottom-3 left-3">
            <Badge variant={getStatusVariant(project.status)} className="capitalize shadow-lg bg-background/80 backdrop-blur-sm">
              {project.status}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3">
          {/* Title */}
          <h3 className="font-bold text-xl text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {project.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {project.description || 'No description provided'}
          </p>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
            {project.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{project.location}</span>
              </div>
            )}

            {project.genre && project.genre.length > 0 && (
              <div className="flex items-center gap-1">
                <Film className="w-3.5 h-3.5" />
                <span className="line-clamp-1">{project.genre.slice(0, 2).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
            </span>

            <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View Project</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Other components (loading, header, etc.) remain largely the same...

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 pt-8 pb-24 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center"><Film className="mr-3 h-8 w-8 text-primary" />Projects</h1>
            <p className="text-muted-foreground">Discover and collaborate on film projects</p>
          </div>
          <ProjectCreationModal onProjectCreated={fetchProjects} defaultOpen={openCreate} />
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <ProjectFilters onFiltersChange={setFilters} activeFilters={filters} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Projects</TabsTrigger>
              {user && <TabsTrigger value="my" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Projects</TabsTrigger>}
              {user && <TabsTrigger value="bookmarked" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Bookmarked</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>

        {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}</div> : (
          filteredProjects.length > 0 ? (
            <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3 }} gap={6}>
              {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </ResponsiveGrid>
          ) : (
            <div className="text-center py-12">
              <Film className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg mb-2 text-muted-foreground">No projects found</p>
              <p className="text-muted-foreground/80 mb-4">Try adjusting your filters or create a new project.</p>
            </div>
          )
        )}

        <ProjectDetailDialog project={selectedProject} open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)} />
      </div>
    </div>
  );
};

export default Projects;

function getStatusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'planning': return 'secondary';
    case 'in-production': return 'default';
    case 'post-production': return 'outline';
    case 'completed': return 'secondary';
    default: return 'outline';
  }
}
