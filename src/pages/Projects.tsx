
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCreationModal } from '@/components/projects/ProjectCreationModal';
import { ProjectDetailDialog } from '@/components/projects/ProjectDetailDialog';
import { ProjectFilters, FilterState } from '@/components/projects/ProjectFilters';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  MapPin,
  Film,
  Bookmark,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Share2
} from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { getGradientForString } from '@/utils/colors';
import { useProjects, Project } from '@/hooks/useProjects';
import { PageHeader } from '@/components/common/PageHeader';

const Projects = ({ openCreate = false }: { openCreate?: boolean }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    roles: [],
    status: [],
    locations: []
  });

  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [projectToShare, setProjectToShare] = useState<Project | null>(null);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { projects, loading, toggleBookmark, deleteProject, refetch } = useProjects(activeTab);

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
    toggleBookmark.mutate(project);
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

    const handleShareClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setProjectToShare(project);
      setIsShareSheetOpen(true);
    };

    return (
      <div
        onClick={handleCardClick}
        className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer hover:-translate-y-1"
      >
        {/* Image Section */}
        <div
          className={`relative w-full h-48 overflow-hidden ${!project.image_url ? '' : 'bg-muted'}`}
          style={{ background: !project.image_url ? getGradientForString(project.title) : undefined }}
        >
          {project.image_url ? (
            <img 
              src={project.image_url} 
              alt={project.title} 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Film className="w-16 h-16 text-white/30" />
            </div>
          )}

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

          {/* Owner Actions */}
          {user?.id === project.creator_id && (
            <div className="absolute bottom-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-50 bg-background border-border">
                  <DropdownMenuItem onClick={() => {
                    setProjectToEdit(project);
                    setIsEditModalOpen(true);
                  }}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setProjectToDelete(project)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareClick}>
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Share Button for Non-Owners */}
          {user?.id !== project.creator_id && (
            <div className="absolute bottom-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
               <button
                onClick={handleShareClick}
                className="p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-all hover:scale-110 shadow-sm"
               >
                 <Share2 className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
               </button>
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

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24 animate-fade-in">
        <PageHeader 
          title="Projects" 
          subtitle="Discover and collaborate on film projects" 
          Icon={Film}
          actions={<ProjectCreationModal onProjectCreated={() => refetch()} defaultOpen={openCreate} />}
        />

        <div className="mb-6">
          <div className="flex flex-row gap-2 sm:gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <ProjectFilters onFiltersChange={setFilters} activeFilters={filters} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-card border border-border w-full flex overflow-x-auto overflow-y-hidden justify-start no-scrollbar">
              <TabsTrigger value="all" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Projects</TabsTrigger>
              {user && <TabsTrigger value="my" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Projects</TabsTrigger>}
              {user && <TabsTrigger value="bookmarked" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Bookmarked</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>

        {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}</div> : (
          filteredProjects.length > 0 ? (
            <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3 }} gap={6} className="gap-3 sm:gap-6">
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

        {/* Edit Modal */}
        {isEditModalOpen && (
          <ProjectCreationModal
            defaultOpen={true}
            projectToEdit={projectToEdit}
            onProjectCreated={() => {
              refetch();
              setIsEditModalOpen(false);
              setProjectToEdit(null);
            }}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the project "{projectToDelete?.title}" and remove all data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (projectToDelete) {
                    deleteProject.mutate(projectToDelete.id);
                    setProjectToDelete(null);
                  }
                }}
              >
                {deleteProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Universal Share Sheet */}
        {projectToShare && (
           <UniversalShareSheet 
            isOpen={isShareSheetOpen}
            onOpenChange={setIsShareSheetOpen}
            shareType="project"
            shareId={projectToShare.id}
            shareData={{
              projectId: projectToShare.id,
              title: projectToShare.title,
              description: projectToShare.description,
              location: projectToShare.location,
              status: projectToShare.status
            }}
           />
        )}
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
