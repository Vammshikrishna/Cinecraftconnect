import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

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
    onSuccess: () => {
      toast({ title: 'Success', description: 'You are now following' });
      queryClient.invalidateQueries({ queryKey: ['follows_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFollowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_follows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follows_manual'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  useEffect(() => {
    if (!user) return;
    
    const channel = supabase.channel(`user_follows_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `follower_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['follows_manual'] })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `following_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['follows_manual'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    following: followsData?.following || [],
    followers: followsData?.followers || [],
    isLoading,
    sendFollow: (userId: string) => sendFollowMutation.mutate(userId),
    deleteFollow: (id: string) => deleteFollowMutation.mutate(id),
    isSendingFollow: sendFollowMutation.isPending,
  };
};
