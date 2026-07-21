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
      if (!user) return { connections: [], pendingRequests: [], sentRequests: [] };

      // 1. Fetch all raw connections
      const { data: rawConnections, error } = await supabase
        .from('user_connections')
        .select('*')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      if (error) throw error;

      // 2. Fetch profiles
      const userIds = new Set<string>();
      rawConnections?.forEach(c => {
        userIds.add(c.follower_id);
        userIds.add(c.following_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags')
        .in('id', Array.from(userIds));

      const profilesMap = new Map(profiles?.map(p => [p.id, p]));

      const mappedConnections = rawConnections?.map(conn => ({
        ...conn,
        follower_profile: profilesMap.get(conn.follower_id),
        following_profile: profilesMap.get(conn.following_id),
      })) || [];

      const connections = mappedConnections.filter(c => c.status === 'accepted') as Connection[];
      const pendingRequests = mappedConnections.filter(c => c.following_id === user?.id && c.status === 'pending') as Connection[];
      const sentRequests = mappedConnections.filter(c => c.follower_id === user?.id && c.status === 'pending') as Connection[];

      return { connections, pendingRequests, sentRequests };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Mutations
  const sendMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from('user_connections')
        .insert({ follower_id: user.id, following_id: userId, status: 'pending' });
      if (error) throw error;
    },
    onMutate: async (userId: string) => {
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
    
    // Separate channels to avoid filter overwrite issues in Supabase JS
    const followerChannel = supabase.channel(`user_connections_follower_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_connections', filter: `follower_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
          queryClient.invalidateQueries({ queryKey: ['users'] });
        })
      .subscribe();

    const followingChannel = supabase.channel(`user_connections_following_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_connections', filter: `following_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
          queryClient.invalidateQueries({ queryKey: ['users'] });
        })
      .subscribe();

    return () => { 
      supabase.removeChannel(followerChannel); 
      supabase.removeChannel(followingChannel);
    };
  }, [user, queryClient]);

  return {
    connections: safeData?.connections || [],
    pendingRequests: safeData?.pendingRequests || [],
    sentRequests: safeData?.sentRequests || [],
    loading: safeLoading,
    sendConnectionRequest: (userId: string) => sendMutation.mutate(userId),
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
