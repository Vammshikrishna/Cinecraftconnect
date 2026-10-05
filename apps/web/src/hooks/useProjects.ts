import { useEffect } from 'react';
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
                    const rawSpaceIds = bookmarksRes.data.map((b: any) => b.project_space_id).filter(Boolean);
                    rawSpaceIds.forEach((id: string) => bookmarkedProjectIds.add(id));

                    const { data: bSpaces } = await supabase
                        .from('project_spaces')
                        .select('id, project_id')
                        .in('id', rawSpaceIds);

                    bSpaces?.forEach((s: any) => {
                        if (s.project_id) bookmarkedProjectIds.add(s.project_id);
                        if (s.id) bookmarkedProjectIds.add(s.id);
                    });
                }

                // Map space IDs back to project IDs for memberships
                if (membersRes.data && membersRes.data.length > 0) {
                    const rawMemberSpaceIds = membersRes.data.map((m: any) => m.project_space_id).filter(Boolean);
                    rawMemberSpaceIds.forEach((id: string) => memberProjectIds.add(id));

                    const { data: mSpaces } = await supabase
                        .from('project_spaces')
                        .select('id, project_id')
                        .in('id', rawMemberSpaceIds);

                    mSpaces?.forEach((s: any) => {
                        if (s.project_id) memberProjectIds.add(s.project_id);
                        if (s.id) memberProjectIds.add(s.id);
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
        staleTime: 1000 * 30,
    });

    // Realtime subscription and cross-tab storage listener for project space bookmarks
    useEffect(() => {
        const channel = supabase
            .channel('project_space_bookmarks_web')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_space_bookmarks' }, () => {
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            })
            .subscribe();

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'cc_project_bookmark_sync') {
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            }
        };

        const handleCustom = () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('projectBookmarkChanged', handleCustom);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('projectBookmarkChanged', handleCustom);
        };
    }, [queryClient]);

    const toggleBookmark = useMutation({
        mutationFn: async (project: Project) => {
            if (!user) throw new Error("Must be logged in");

            const isBookmarked = project.is_bookmarked;

            // Resolve project space ID (check project_id match, id match, or auto-create if missing)
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
                // Auto-create workspace if not yet created
                const { data: createdSpace, error: createError } = await (supabase as any)
                    .from('project_spaces')
                    .insert({
                        project_id: project.id,
                        name: `${project.title || 'Project'} Workspace`,
                        creator_id: project.creator_id || user.id,
                    })
                    .select('id')
                    .maybeSingle();

                if (!createError && createdSpace?.id) {
                    spaceId = createdSpace.id;
                } else {
                    // Retry query in case of concurrent insert
                    const { data: retrySpace } = await supabase
                        .from('project_spaces')
                        .select('id')
                        .or(`project_id.eq.${project.id},id.eq.${project.id}`)
                        .limit(1)
                        .maybeSingle();
                    if (retrySpace?.id) spaceId = retrySpace.id;
                }
            }

            if (!spaceId) throw new Error("Could not resolve project space workspace");

            if (isBookmarked) {
                const { error } = await supabase
                    .from('project_space_bookmarks')
                    .delete()
                    .eq('project_space_id', spaceId)
                    .eq('user_id', user.id);
                if (error) throw error;
                return { projectId: project.id, isBookmarked: false };
            } else {
                const { error } = await supabase
                    .from('project_space_bookmarks')
                    .upsert({ project_space_id: spaceId, user_id: user.id }, { onConflict: 'user_id,project_space_id' });
                if (error) throw error;
                return { projectId: project.id, isBookmarked: true };
            }
        },
        onSuccess: (data) => {
            // Broadcast event across current window and other tabs
            window.dispatchEvent(new CustomEvent('projectBookmarkChanged', {
                detail: { projectId: data.projectId, isBookmarked: data.isBookmarked }
            }));
            try {
                localStorage.setItem('cc_project_bookmark_sync', JSON.stringify({
                    projectId: data.projectId,
                    isBookmarked: data.isBookmarked,
                    ts: Date.now()
                }));
            } catch {}

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
