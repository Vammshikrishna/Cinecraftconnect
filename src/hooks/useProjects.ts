
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Project {
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
    image_url?: string;
    is_bookmarked?: boolean;
    profiles?: {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
    };
}

export const useProjects = (activeTab: string = 'all') => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: projects = [], isLoading: loading, refetch } = useQuery({
        queryKey: ['projects', activeTab, user?.id],
        queryFn: async () => {
            // 1. Fetch projects
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
                if (!user) return [];
                query = query.eq('creator_id', user.id);
            }

            const { data: projectsData, error: projectsError } = await query.order('created_at', { ascending: false });

            if (projectsError && projectsError.code !== 'PGRST116') throw projectsError;

            // 2. Fetch bookmarks if user is logged in
            let bookmarkedProjectIds = new Set<string>();

            if (user) {
                // Get project_space IDs that are bookmarked
                const { data: bookmarksData, error: bookmarksError } = await supabase
                    .from('project_space_bookmarks')
                    .select('project_space_id');

                if (!bookmarksError && bookmarksData && bookmarksData.length > 0) {
                    const spaceIds = bookmarksData.map(b => b.project_space_id);
                    const { data: spacesData } = await supabase
                        .from('project_spaces')
                        .select('project_id')
                        .in('id', spaceIds);

                    spacesData?.forEach(s => bookmarkedProjectIds.add(s.project_id));
                }
            }

            // 3. Merge
            let projectsWithBookmarks = (projectsData || []).map((project: any) => ({
                ...project,
                is_bookmarked: bookmarkedProjectIds.has(project.id)
            }));

            // Filter for bookmarked tab
            if (activeTab === 'bookmarked') {
                projectsWithBookmarks = projectsWithBookmarks.filter((p: any) => p.is_bookmarked);
            }

            return projectsWithBookmarks as Project[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const toggleBookmark = useMutation({
        mutationFn: async (project: Project) => {
            if (!user) throw new Error("Must be logged in");

            const isBookmarked = project.is_bookmarked;

            // Get project space
            const { data: projectSpace } = await supabase
                .from('project_spaces')
                .select('id')
                .eq('project_id', project.id)
                .single();

            if (!projectSpace) throw new Error("Project space not found");

            if (isBookmarked) {
                const { error } = await supabase
                    .from('project_space_bookmarks')
                    .delete()
                    .match({ project_space_id: projectSpace.id, user_id: user.id });
                if (error) throw error;
                return { projectId: project.id, isBookmarked: false };
            } else {
                const { error } = await supabase
                    .from('project_space_bookmarks')
                    .insert({ project_space_id: projectSpace.id, user_id: user.id });
                if (error) throw error;
                return { projectId: project.id, isBookmarked: true };
            }
        },
        onSuccess: (data) => {
            // Optimistic update or invalidation
            queryClient.setQueryData(['projects', activeTab, user?.id], (old: Project[] | undefined) => {
                if (!old) return [];
                return old.map(p => p.id === data.projectId ? { ...p, is_bookmarked: data.isBookmarked } : p)
                    .filter(p => activeTab !== 'bookmarked' || p.is_bookmarked);
            });
            toast({ title: data.isBookmarked ? "Project bookmarked!" : "Bookmark removed" });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });
    const deleteProject = useMutation({
        mutationFn: async (projectId: string) => {
            if (!user) throw new Error("Must be logged in");

            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)
                .eq('creator_id', user.id); // Security check

            if (error) throw error;
            return projectId;
        },
        onSuccess: (deletedProjectId) => {
            queryClient.setQueryData(['projects', activeTab, user?.id], (old: Project[] | undefined) => {
                if (!old) return [];
                return old.filter(p => p.id !== deletedProjectId);
            });
            toast({ title: "Project deleted successfully" });
        },
        onError: (error: any) => {
            toast({ title: "Error deleting project", description: error.message, variant: "destructive" });
        }
    });

    return { projects, loading, toggleBookmark, deleteProject, refetch };
};
