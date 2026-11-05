import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Gift {
  id: string;
  from_name: string;
  message: string | null;
  kind: 'plan' | 'feature';
  label: string;
  feature_key: string | null;
  feature_value: unknown;
  days: number;
  status: 'sent' | 'opened' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  applied_at: string | null;
}

/** Gifts sent to the signed-in person. If the request fails, `error` is true (it is not shown as an empty list). */
export const useGifts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['gifts', user?.id ?? 'anon'];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<Gift[]> => {
      const { data, error } = await (supabase as any).rpc('my_gifts');
      if (error) throw error;
      return Array.isArray(data) ? (data as Gift[]) : [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const open = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).rpc('open_gift', { p_id: id }); },
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc('accept_gift', { p_id: id });
      if (error) throw error;
      return data as { status: string; starts_when_live: boolean };
    },
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['entitlements'] }); },
  });
  const decline = useMutation({
    mutationFn: async (id: string) => { await (supabase as any).rpc('decline_gift', { p_id: id }); },
    onSuccess: refresh,
  });

  const gifts = query.data ?? [];
  return {
    gifts,
    loading: query.isLoading,
    error: query.isError,
    refetch: () => { void query.refetch(); },
    waiting: gifts.filter((g) => g.status === 'sent' || g.status === 'opened'),
    open: (id: string) => open.mutate(id),
    accept: accept.mutateAsync,
    accepting: accept.isPending,
    decline: (id: string) => decline.mutate(id),
  };
};
