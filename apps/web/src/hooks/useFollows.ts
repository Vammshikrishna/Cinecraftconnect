import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@cinecraft/core';

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

interface ActiveFollowsInfo {
  channel: any;
  count: number;
}

const activeFollowsChannels: Record<string, ActiveFollowsInfo> = {};

export const useFollows = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followsData, isLoading } = useQuery({
    queryKey: ['follows_manual', user?.id],
    queryFn: async () => {
      if (!user) return { following: [], followers: [] };

      const { data, error } = await supabase
        .from('user_follows')
        .select('*')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      if (error) throw error;

      const following = data.filter(f => f.follower_id === user.id) as Follow[];
      const followers = data.filter(f => f.following_id === user.id) as Follow[];

      return { following, followers };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const sendFollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, following_id: userId });
      if (error) throw error;
    },
    // the button changes at once; if the server refuses, it goes back and says why
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: ['follows_manual', user?.id] });
      const previous = queryClient.getQueryData<{ following: Follow[]; followers: Follow[] }>(['follows_manual', user?.id]);
      if (previous && user) {
        queryClient.setQueryData(['follows_manual', user.id], {
          ...previous,
          following: [...previous.following, { id: `pending-${userId}`, follower_id: user.id, following_id: userId, created_at: new Date().toISOString() }],
        });
      }
      return { previous };
    },
    onError: (error: any, _userId: string, context: any) => {
      if (context?.previous && user) queryClient.setQueryData(['follows_manual', user.id], context.previous);
      toast({ title: 'Could not follow', description: friendlyError(error), variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follows_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteFollowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_follows').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['follows_manual', user?.id] });
      const previous = queryClient.getQueryData<{ following: Follow[]; followers: Follow[] }>(['follows_manual', user?.id]);
      if (previous && user) {
        queryClient.setQueryData(['follows_manual', user.id], {
          ...previous,
          following: previous.following.filter((f) => f.id !== id),
        });
      }
      return { previous };
    },
    onError: (error: any, _id: string, context: any) => {
      if (context?.previous && user) queryClient.setQueryData(['follows_manual', user.id], context.previous);
      toast({ title: 'Could not unfollow', description: friendlyError(error), variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follows_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  useEffect(() => {
    if (!user) return;
    
    const userId = user.id;
    if (!activeFollowsChannels[userId]) {
      const channel = supabase.channel(`user_follows_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `follower_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ['follows_manual'] })
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `following_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ['follows_manual'] })
        )
        .subscribe();
      activeFollowsChannels[userId] = { channel, count: 1 };
    } else {
      activeFollowsChannels[userId].count++;
    }

    return () => {
      const info = activeFollowsChannels[userId];
      if (info) {
        info.count--;
        if (info.count === 0) {
          supabase.removeChannel(info.channel);
          delete activeFollowsChannels[userId];
        }
      }
    };
  }, [user?.id, queryClient]);

  return {
    following: followsData?.following || [],
    followers: followsData?.followers || [],
    isLoading,
    sendFollow: (userId: string) => sendFollowMutation.mutate(userId),
    deleteFollow: (id: string) => deleteFollowMutation.mutate(id),
    isSendingFollow: sendFollowMutation.isPending,
  };
};
