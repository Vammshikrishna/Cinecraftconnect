import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Connection {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  note?: string | null;
  ignored_at?: string | null;
  mutual_count?: number;
  my_note?: string | null;
  my_tags?: string[];
  availability?: string | null;
  follower_profile?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    craft: string;
    location: string;
    is_verified: boolean;
  };
  following_profile?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    craft: string;
    location: string;
    is_verified: boolean;
  };
}

interface ActiveConnectionsInfo {
  followerChannel: any;
  followingChannel: any;
  count: number;
}

const activeConnectionsChannels: Record<string, ActiveConnectionsInfo> = {};

export const useConnections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // We will use the manual fetch pattern below to ensure compatibility with existing data structures


  // Since we might not be sure if the join works, let's just stick to the manual join pattern inside queryFn for safety,
  // or better, FIX the query to not rely on JOIN if we aren't sure.
  // The previous code did manual join. Let's replicate that manual join inside the queryFn to be 100% safe.

  const { data: safeData, isLoading: safeLoading } = useQuery({
    queryKey: ['connections_manual', user?.id],
    queryFn: async () => {
      if (!user) return { connections: [], pendingRequests: [], sentRequests: [], ignoredRequests: [] };

      // one call: my connections and requests, the other person's profile and the mutual-connection count
      const { data: rows, error } = await (supabase as any).rpc('network_overview');
      if (error) throw error;

      const mapped = ((rows || []) as any[]).map(r => {
        const other = {
          id: r.other_id, full_name: r.full_name, username: r.username, avatar_url: r.avatar_url,
          cover_image_url: r.cover_image_url, bio: r.bio, location: r.location, craft: r.craft,
          account_type: r.account_type, is_verified: r.is_verified,
        };
        const otherIsFollower = r.follower_id === r.other_id;
        return {
          id: r.id, follower_id: r.follower_id, following_id: r.following_id, status: r.status, created_at: r.created_at,
          note: r.note, ignored_at: r.ignored_at, mutual_count: r.mutual_count,
          my_note: r.my_note, my_tags: r.my_tags || [], availability: r.availability,
          follower_profile: otherIsFollower ? other : undefined,
          following_profile: otherIsFollower ? undefined : other,
        };
      });

      const connections = mapped.filter(c => c.status === 'accepted') as unknown as Connection[];
      const received = mapped.filter(c => c.following_id === user.id && c.status === 'pending');
      const pendingRequests = received.filter(c => !c.ignored_at) as unknown as Connection[];
      const ignoredRequests = received.filter(c => !!c.ignored_at) as unknown as Connection[];
      const sentRequests = mapped.filter(c => c.follower_id === user.id && c.status === 'pending') as unknown as Connection[];

      return { connections, pendingRequests, sentRequests, ignoredRequests };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Mutations
  const sendMutation = useMutation({
    mutationFn: async ({ userId, note }: { userId: string; note?: string }) => {
      if (!user) throw new Error("No user");
      const { error } = await (supabase as any)
        .from('user_connections')
        .insert({ follower_id: user.id, following_id: userId, status: 'pending', note: note || null });
      if (error) throw error;
    },
    onMutate: async ({ userId }: { userId: string; note?: string }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['connections_manual'] });
      const previousData = queryClient.getQueryData(['connections_manual', user?.id]);

      queryClient.setQueryData(['connections_manual', user?.id], (old: any) => {
        if (!old) return old;
        const tempConn = {
          id: `temp_${Date.now()}`,
          follower_id: user?.id,
          following_id: userId,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        return {
          ...old,
          sentRequests: [...(old.sentRequests || []), tempConn]
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any, newTodo, context: any) => {
      if (context?.previousData && user) {
        queryClient.setQueryData(['connections_manual', user.id], context.previousData);
      }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const ignoreMutation = useMutation({
    mutationFn: async ({ id, ignore }: { id: string; ignore: boolean }) => {
      const { error } = await (supabase as any).rpc('ignore_connection_request', { p_id: id, p_ignore: ignore });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'accepted' }) => {
      const { error } = await supabase.from('user_connections').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['connections_manual'] });
      const previousData = queryClient.getQueryData(['connections_manual', user?.id]);

      queryClient.setQueryData(['connections_manual', user?.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          connections: old.connections?.filter((c: any) => c.id !== id),
          pendingRequests: old.pendingRequests?.filter((c: any) => c.id !== id),
          sentRequests: old.sentRequests?.filter((c: any) => c.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any, newTodo, context: any) => {
      if (context?.previousData && user) {
        queryClient.setQueryData(['connections_manual', user.id], context.previousData);
      }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    
    const userId = user.id;
    if (!activeConnectionsChannels[userId]) {
      // Separate channels to avoid filter overwrite issues in Supabase JS
      const followerChannel = supabase.channel(`user_connections_follower_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_connections', filter: `follower_id=eq.${userId}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
          })
        .subscribe();

      const followingChannel = supabase.channel(`user_connections_following_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_connections', filter: `following_id=eq.${userId}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
          })
        .subscribe();

      activeConnectionsChannels[userId] = { followerChannel, followingChannel, count: 1 };
    } else {
      activeConnectionsChannels[userId].count++;
    }

    return () => { 
      const info = activeConnectionsChannels[userId];
      if (info) {
        info.count--;
        if (info.count === 0) {
          supabase.removeChannel(info.followerChannel);
          supabase.removeChannel(info.followingChannel);
          delete activeConnectionsChannels[userId];
        }
      }
    };
  }, [user?.id, queryClient]);

  return {
    connections: safeData?.connections || [],
    pendingRequests: safeData?.pendingRequests || [],
    sentRequests: safeData?.sentRequests || [],
    ignoredRequests: safeData?.ignoredRequests || [],
    loading: safeLoading,
    sendConnectionRequest: (userId: string, note?: string) => sendMutation.mutate({ userId, note }),
    ignoreRequest: (id: string) => ignoreMutation.mutate({ id, ignore: true }),
    unignoreRequest: (id: string) => ignoreMutation.mutate({ id, ignore: false }),
    acceptConnectionRequest: (id: string) => updateStatusMutation.mutate({ id, status: 'accepted' }),
    rejectConnectionRequest: (id: string) => {
      deleteMutation.mutate(id);
    },
    cancelConnectionRequest: (id: string) => {
      deleteMutation.mutate(id);
    },
    removeConnection: (id: string) => {
      deleteMutation.mutate(id);
    },
  };
};
