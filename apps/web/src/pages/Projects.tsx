
import { useState } from 'react';
import { useAppNavigation } from '@/contexts/NavigationContext';
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
  Share2,
  Bell,
  Users,
  Flag,
  Plus
} from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
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
import { useAppRole } from '@/hooks/useAppRole';
import { PageHeader } from '@/components/common/PageHeader';
import { ReportDialog } from '@/components/governance/ReportDialog';
import SEO from '@/components/common/SEO';

import { useAccountType } from '@/hooks/useAccountType';
import { useEffect } from 'react';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';

const Projects = ({ openCreate = false }: { openCreate?: boolean }) => {
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { isAdmin, isInternal } = useAppRole();
  const { isFan } = useAccountType();

  // Redirect fans
  useEffect(() => {
    if (isFan) {
      push('/404');
    }
  }, [isFan, push]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
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
  const [reportData, setReportData] = useState<{ id: string, title: string } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

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
    const { push } = useAppNavigation();
    const { unreadProjectIds } = useUnreadMessages();
    const hasUnread = unreadProjectIds.includes(project.id);

    const handleCardClick = () => {
      if (project.is_member || isInternal) {
        push(`/projects/${project.id}/space`);
      } else {
        push(`/projects/${project.id}`);
      }
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

    const rolesCount = Array.isArray(project.required_roles) ? project.required_roles.length : 0;
    const genreRaw = project.genre as unknown;
    const genreText = Array.isArray(genreRaw) && genreRaw.length > 0
      ? genreRaw.map((g) => String(g).toUpperCase()).join(', ')
      : (typeof genreRaw === 'string' && genreRaw
          ? genreRaw.toUpperCase()
          : 'ACTION');
    const locationText = project.location || 'HYDERABAD, TELANGANA, IND';
    const statusText = (project.status || 'ACTIVE').toUpperCase();

    return (
      <div
        onClick={handleCardClick}
        className={`group bg-card text-card-foreground rounded-[20px] border border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-300 p-4 sm:p-5 flex flex-col justify-between cursor-pointer relative ${
          hasUnread ? 'ring-2 ring-red-500/50 shadow-red-500/10' : ''
        }`}
      >
        {/* Top Section (Poster + Info) */}
        <div>
          <div className="flex items-start gap-3.5 sm:gap-4">
            {/* Left Square Poster */}
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-[14px] sm:rounded-[16px] overflow-hidden shrink-0 relative shadow-sm flex items-center justify-center"
              style={{ background: !project.image_url ? getGradientForString(project.title) : undefined }}
            >
              {project.image_url ? (
                <img loading="lazy" decoding="async"
                  src={project.image_url}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center">
                  <Film className="w-7 h-7 text-white/90" />
                </div>
              )}
            </div>

            {/* Right Column: Scene Badge, Bookmark, 3-Dots, Title, Subtitle */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">
              {/* Header Line: Scene Badge + Actions (Save & 3-Dots) */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-mono text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>[SCENE: {statusText}]</span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleBookmarkClick}
                    className="p-1 text-slate-400 hover:text-primary transition-colors focus:outline-none rounded-md"
                    aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark project'}
                  >
                    <Bookmark
                      className={`w-4 h-4 transition-all ${
                        isBookmarked ? 'fill-primary text-primary' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                  </button>

                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 z-50 bg-background border-border shadow-lg rounded-xl">
                        {(user?.id === project.creator_id || isAdmin) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setProjectToEdit(project);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setProjectToDelete(project)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={handleShareClick}>
                          <Share2 className="mr-2 h-4 w-4" /> Share
                        </DropdownMenuItem>
                        {user?.id !== project.creator_id && (
                          <DropdownMenuItem
                            className="text-amber-500 focus:text-amber-500"
                            onClick={() => {
                              setReportData({ id: project.id, title: project.title });
                              setIsReportOpen(true);
                            }}
                          >
                            <Flag className="mr-2 h-4 w-4" /> Report
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Title */}
              <h3 className="font-serif font-bold text-base sm:text-lg text-foreground tracking-tight leading-snug truncate group-hover:text-primary transition-colors mt-0.5">
                {project.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground line-clamp-1 font-normal">
                {project.description || 'Testing the projectspace and it fetures'}
              </p>
            </div>
          </div>

          {/* Middle: Location Chip */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60 w-fit max-w-full truncate">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">LOC // {locationText}</span>
          </div>

          {/* Roles & Genre Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Roles Badge (Clickable to view roles) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(project);
              }}
              className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer"
              title="View open roles"
            >
              <Users className="w-3 h-3 text-red-500" />
              <span>ROLES // {rolesCount} OPEN</span>
            </button>

            {/* Genre Badge */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap">
              <Film className="w-3 h-3 text-slate-500 shrink-0" />
              <span>GENRE // {genreText}</span>
            </div>
          </div>
        </div>

        {/* Footer: Date & Action Buttons */}
        <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-normal">
            {formatDistanceToNow(new Date(project.created_at || Date.now()), { addSuffix: true })}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Roles Open Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(project);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 transition-all hover:scale-105 shadow-xs"
            >
              <Users className="w-3 h-3 text-red-500" />
              <span>Roles ({rolesCount})</span>
            </button>

            {/* View ProjectSpace Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                push(`/projects/${project.id}/space`);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-105 shadow-xs"
            >
              <span>View Space</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO
        title="ProjectSpace"
        description="Discover and collaborate on professional film and digital media projects. Browse open roles and build your production crew."
      />
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-36 animate-fade-in">
        <PageHeader
          title="ProjectSpace"
          subtitle="Discover and collaborate on film projects"
          Icon={Film}
          actionsAtTop={true}
          actions={
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm flex items-center gap-2"
              onClick={() => push('/projects/create')}
            >
              <Plus size={20} strokeWidth={3} />
              <span>Create Space</span>
            </Button>
          }
        />

        <div className="mb-6">
          <UnifiedSearchBar
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search projects..."
            hasActiveFilters={Object.values(filters).some(arr => arr.length > 0)}
            filterOpen={filterOpen}
            onFilterOpenChange={setFilterOpen}
            filterTitle="Project Filters"
            filterContent={
              <ProjectFilters
                onFiltersChange={(f) => {
                  setFilters(f);
                  setFilterOpen(false);
                }}
                activeFilters={filters}
              />
            }
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-card border border-border w-full flex overflow-x-auto overflow-y-hidden justify-start no-scrollbar">
              <TabsTrigger value="all" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All</TabsTrigger>
              {user && <TabsTrigger value="my" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Projects</TabsTrigger>}
              {user && <TabsTrigger value="bookmarked" className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Bookmarked</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>

        {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}</div> : (
          filteredProjects.length > 0 ? (
            <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3, xl: 3 }} gap={5} className="gap-5">
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

        {/* Report Dialog */}
        {reportData && (
          <ReportDialog
            isOpen={isReportOpen}
            onOpenChange={setIsReportOpen}
            targetType="project"
            targetId={reportData.id}
            targetTitle={reportData.title}
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
