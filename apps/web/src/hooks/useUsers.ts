import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  craft: string;
  location?: string | null;
  bio?: string | null;
  cover_image_url?: string | null;
  connection_status?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
  connection_id?: string;
  is_verified?: boolean;
  suggestion_reason?: string;
  mutual_count?: number;
  account_type?: string | null;
  availability?: string | null;
}

export const PEOPLE_PAGE = 24;

export interface PeopleFilters { skill?: string; gear?: string; language?: string; city?: string }

/**
 * People you may know. The ranking (real mutual connections, same craft / place), search, filters and paging all run on
 * the server (suggest_people), so every member can be found, blocked and dismissed people never show up.
 * `limit` grows by one page each time the user asks for more.
 */
export const useUsers = (
  searchQuery: string = '',
  craftFilter: string = 'All',
  isEnabled: boolean = true,
  accountTypeFilter: 'creator' | 'fan' | null = null,
  limit: number = PEOPLE_PAGE,
  availableOnly: boolean = false,
  filters: PeopleFilters = {}
) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['users', searchQuery, craftFilter, user?.id, accountTypeFilter, profile?.account_type, limit, availableOnly, filters.skill, filters.gear, filters.language, filters.city],
    queryFn: async () => {
      if (!user) return { users: [] as UserProfile[], hasMore: false };
      const { data: rows, error } = await (supabase as any).rpc('suggest_people', {
        p_search: searchQuery.trim() || null,
        p_craft: craftFilter && craftFilter !== 'All' ? craftFilter : null,
        p_account_type: accountTypeFilter,
        p_limit: limit + 1,
        p_offset: 0,
        p_available_only: availableOnly,
        p_skill: filters.skill?.trim() || null,
        p_gear: filters.gear?.trim() || null,
        p_language: filters.language?.trim() || null,
        p_city: filters.city?.trim() || null,
      });
      if (error) throw error;
      const list = (rows || []) as UserProfile[];
      return { users: list.slice(0, limit), hasMore: list.length > limit };
    },
    enabled: !!user && isEnabled,
    staleTime: 1000 * 60,
    placeholderData: (prev) => prev,
  });

  /** Remember "not interested" so the person does not come back after a refresh. */
  const dismiss = async (id: string) => {
    if (!user) return;
    await (supabase as any).from('network_dismissed').upsert({ user_id: user.id, dismissed_id: id }, { onConflict: 'user_id,dismissed_id' });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  return { users: data?.users || [], hasMore: data?.hasMore || false, loading, dismiss };
};
