import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CompanyPage, CompanyPageMember } from '@/types/companyPages';

// Fetch all company pages (browse)
export function useCompanyPages(searchQuery?: string) {
  return useQuery({
    queryKey: ['company-pages', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('company_pages' as any)
        .select('*')
        .order('follower_count', { ascending: false });

      if (searchQuery?.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%,headquarters.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CompanyPage[];
    },
  });
}

// Fetch a single company page by slug or id
export function useCompanyPage(slugOrId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['company-page', slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;

      // First try slug, then try id
      let { data, error } = await supabase
        .from('company_pages' as any)
        .select('*')
        .eq('slug', slugOrId)
        .maybeSingle();

      if (!data) {
        ({ data, error } = await supabase
          .from('company_pages' as any)
          .select('*')
          .eq('id', slugOrId)
          .maybeSingle());
      }

      if (error) throw error;
      return data as unknown as CompanyPage | null;
    },
    enabled: !!slugOrId,
  });


  return { data, isLoading };
}

// Check if current user follows a page
export function useIsFollowingPage(pageId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['page-following', pageId, user?.id],
    queryFn: async () => {
      if (!user || !pageId) return false;
      const { data } = await supabase
        .from('company_page_followers' as any)
        .select('id')
        .eq('page_id', pageId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!pageId,
  });
}

// Toggle follow/unfollow
export function useToggleFollowPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ pageId, isFollowing }: { pageId: string; isFollowing: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (isFollowing) {
        const { error } = await supabase
          .from('company_page_followers' as any)
          .delete()
          .eq('page_id', pageId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_page_followers' as any)
          .insert({ page_id: pageId, user_id: user.id });
        if (error) throw error;
      }
    },
    onMutate: async ({ pageId, isFollowing }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['page-following', pageId, user?.id] });
      await queryClient.cancelQueries({ queryKey: ['company-page'] });

      // Snapshot the previous values
      const previousFollowing = queryClient.getQueryData(['page-following', pageId, user?.id]);

      // Store all current company-page data for rollback
      const previousPagesData = queryClient.getQueriesData({ queryKey: ['company-page'] });

      // Optimistically update follow status
      queryClient.setQueryData(['page-following', pageId, user?.id], !isFollowing);

      // Optimistically update all relevant company-page caches
      queryClient.setQueriesData({ queryKey: ['company-page'] }, (old: any) => {
        if (!old) return old;
        // Only update if this is the correct page (either ID or Slug matches)
        if (old.id === pageId || old.slug === pageId) {
          const currentCount = typeof old.follower_count === 'number' ? old.follower_count : 0;
          const countDiff = isFollowing ? -1 : 1;
          return {
            ...old,
            follower_count: Math.max(0, currentCount + countDiff)
          };
        }
        return old;
      });

      return { previousFollowing, previousPagesData };
    },
    onError: (_err, variables, context) => {
      if (context) {
        queryClient.setQueryData(['page-following', variables.pageId, user?.id], context.previousFollowing);
        // Rollback all captured company-page query states
        context.previousPagesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: 'Error', description: 'Failed to update follow status', variant: 'destructive' });
    },
    onSuccess: (_, { pageId, isFollowing }) => {
      queryClient.invalidateQueries({ queryKey: ['page-following', pageId] });
      queryClient.invalidateQueries({ queryKey: ['company-page'] });
      queryClient.invalidateQueries({ queryKey: ['company-pages'] });
      toast({
        title: isFollowing ? 'Unfollowed' : 'Following',
        description: isFollowing ? 'You unfollowed this page' : 'You are now following this page',
      });
    },
  });
}

// Fetch page posts (posts with this page_id)
export function usePagePosts(pageId: string | undefined) {
  return useQuery({
    queryKey: ['page-posts', pageId],
    queryFn: async () => {
      if (!pageId) return [];
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:author_id(id, full_name, username, avatar_url, craft), company_pages:page_id(id, name, logo_url, slug)')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!pageId,
  });
}

// Fetch page jobs
export function usePageJobs(pageId: string | undefined) {
  return useQuery({
    queryKey: ['page-jobs', pageId],
    queryFn: async () => {
      if (!pageId) return [];
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pageId,
  });
}

// Fetch page team members
export function usePageMembers(pageId: string | undefined) {
  return useQuery({
    queryKey: ['page-members', pageId],
    queryFn: async () => {
      if (!pageId) return [];
      const { data, error } = await supabase
        .from('company_page_members' as any)
        .select('*, profiles(id, full_name, username, avatar_url, craft)')
        .eq('page_id', pageId);
      if (error) throw error;
      return (data || []) as unknown as CompanyPageMember[];
    },
    enabled: !!pageId,
  });
}

// Create a company page
export function useCreateCompanyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pageData: Partial<CompanyPage>) => {
      if (!user) throw new Error('Not authenticated');

      const slug = pageData.name!
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);

      const { data, error } = await supabase
        .from('company_pages' as any)
        .insert({
          owner_id: user.id,
          name: pageData.name,
          slug,
          tagline: pageData.tagline || null,
          description: pageData.description || null,
          logo_url: pageData.logo_url || null,
          cover_image_url: pageData.cover_image_url || null,
          industry: pageData.industry || [],
          company_size: pageData.company_size || null,
          founded_year: pageData.founded_year || null,
          headquarters: pageData.headquarters || null,
          website: pageData.website || null,
          email: pageData.email || null,
          phone: pageData.phone || null,
          specialties: pageData.specialties || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CompanyPage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-pages'] });
      toast({ title: 'Success', description: 'Your company page has been created!' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to create page', variant: 'destructive' });
    },
  });
}

// Check if user is an admin of a page
export function useIsPageAdmin(pageId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['page-admin', pageId, user?.id],
    queryFn: async () => {
      if (!user || !pageId) return false;
      const { data } = await supabase
        .from('company_page_admins' as any)
        .select('id')
        .eq('page_id', pageId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!pageId,
  });
}

// Fetch user's own pages (owned and admin managed)
export function useMyPages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-pages', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch pages owned by user
      const ownedPagesPromise = supabase
        .from('company_pages' as any)
        .select('*')
        .eq('owner_id', user.id);

      // Fetch pages where user is admin
      const adminPagesPromise = supabase
        .from('company_page_admins' as any)
        .select('company_pages(*)')
        .eq('user_id', user.id);

      const [ownedRes, adminRes] = await Promise.all([ownedPagesPromise, adminPagesPromise]);

      if (ownedRes.error) throw ownedRes.error;
      if (adminRes.error) throw adminRes.error;

      const owned = ownedRes.data || [];
      const adminManaged = (adminRes.data || []).map((a: any) => a.company_pages).filter(Boolean);

      // Combine and remove duplicates
      const allPages = [...owned, ...adminManaged];
      const uniquePagesMap = new Map();
      allPages.forEach(p => {
        if (!uniquePagesMap.has(p.id)) {
          uniquePagesMap.set(p.id, p);
        }
      });

      const uniquePages = Array.from(uniquePagesMap.values());

      return uniquePages.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as unknown as CompanyPage[];
    },
    enabled: !!user,
  });
}

export function useFollowedPageIds() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['followed-page-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('company_page_followers' as any)
        .select('page_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((f: any) => f.page_id);
    },
    enabled: !!user,
  });

  return {
    ...query,
    data: Array.isArray(query.data) ? query.data : [] as string[]
  };
}

// Update a company page
export function useUpdateCompanyPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CompanyPage> }) => {
      const { error } = await supabase
        .from('company_pages' as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-page'] });
      queryClient.invalidateQueries({ queryKey: ['company-pages'] });
      queryClient.invalidateQueries({ queryKey: ['my-pages'] });
      toast({ title: 'Success', description: 'Page details updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to update page', variant: 'destructive' });
    },
  });
}
