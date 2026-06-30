
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
    is_member?: boolean;
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

            // 2. Fetch projects and metadata concurrently to halve network latency on 3G
            const [projectsRes, bookmarksRes, membersRes] = await Promise.all([
                query.order('created_at', { ascending: false }),
                user ? supabase.from('project_space_bookmarks').select('project_space_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
                user ? supabase.from('project_space_members').select('project_space_id').eq('user_id', user.id) : Promise.resolve({ data: [] })
            ]);

            const projectsError = projectsRes.error;
            const projectsData = projectsRes.data;

            if (projectsError && projectsError.code !== 'PGRST116') throw projectsError;

            let bookmarkedProjectIds = new Set<string>();
            let memberProjectIds = new Set<string>();

            if (user) {
                // Map space IDs back to project IDs for bookmarks
                if (bookmarksRes.data && bookmarksRes.data.length > 0) {
                    const { data: bSpaces } = await supabase.from('project_spaces').select('project_id').in('id', bookmarksRes.data.map(b => b.project_space_id));
                    bSpaces?.forEach(s => {
                        if (s.project_id) bookmarkedProjectIds.add(s.project_id);
                    });
                }

                // Map space IDs back to project IDs for memberships
                if (membersRes.data && membersRes.data.length > 0) {
                    const { data: mSpaces } = await supabase.from('project_spaces').select('project_id').in('id', membersRes.data.map(m => m.project_space_id));
                    mSpaces?.forEach(s => {
                        if (s.project_id) memberProjectIds.add(s.project_id);
                    });
                }
            }

            // 3. Merge
            let projectsWithMetadata = (projectsData || []).map((project: any) => ({
                ...project,
                is_bookmarked: bookmarkedProjectIds.has(project.id),
                is_member: memberProjectIds.has(project.id) || project.creator_id === user?.id
            }));

            // Filter for bookmarked tab
            if (activeTab === 'bookmarked') {
                projectsWithMetadata = projectsWithMetadata.filter((p: any) => p.is_bookmarked);
            }

            return projectsWithMetadata as Project[];
        },
        staleTime: 1000 * 60, // Reduced staleTime to 1 minute for better responsiveness
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
            // Invalidate all projects queries to keep all tabs in sync
            queryClient.invalidateQueries({ queryKey: ['projects'] });
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
