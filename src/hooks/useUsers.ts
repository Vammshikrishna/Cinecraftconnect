import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  craft: string;
  location: string;
  bio: string;
  website: string;
  connection_status?: 'none' | 'pending_sent' | 'pending_received' | 'connected';
  connection_id?: string;
}

export const useUsers = (searchQuery: string = '', craftFilter: string = 'All') => {
  const { user } = useAuth();

  const { data: users = [], isLoading: loading } = useQuery({
    queryKey: ['users', searchQuery, craftFilter, user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch profiles
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id);

      if (searchQuery) {
        profilesQuery = profilesQuery.or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,craft.ilike.%${searchQuery}%`);
      }

      if (craftFilter && craftFilter !== 'All') {
        profilesQuery = profilesQuery.ilike('craft', `%${craftFilter}%`);
      }

      // 2. Fetch connections (for status mapping)
      const connectionsQuery = supabase
        .from('user_connections')
        .select('*')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      // Execute in parallel
      const [currentUserResult, profilesResult, connectionsResult] = await Promise.all([
        supabase.from('profiles').select('craft').eq('id', user.id).single(),
        profilesQuery.limit(50),
        connectionsQuery
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (connectionsResult.error) throw connectionsResult.error;

      const userCraft = currentUserResult.data?.craft || '';
      const profilesData = profilesResult.data || [];
      const connectionsData = connectionsResult.data || [];

      // Map connection status
      const mappedUsers = profilesData.map((profile) => {
        const sentConnection = connectionsData.find(
          (c) => c.follower_id === user.id && c.following_id === profile.id
        );
        const receivedConnection = connectionsData.find(
          (c) => c.follower_id === profile.id && c.following_id === user.id
        );

        let connection_status: UserProfile['connection_status'] = 'none';
        let connection_id: string | undefined;

        if (sentConnection) {
          connection_status = sentConnection.status === 'accepted' ? 'connected' : 'pending_sent';
          connection_id = sentConnection.id;
        } else if (receivedConnection) {
          connection_status = receivedConnection.status === 'accepted' ? 'connected' : 'pending_received';
          connection_id = receivedConnection.id;
        }

        return {
          ...profile,
          connection_status,
          connection_id,
        };
      });

      // Recommendation Algorithm Sorting
      return mappedUsers.sort((a, b) => {
        const aConnected = a.connection_status !== 'none';
        const bConnected = b.connection_status !== 'none';

        // 1. Unconnected users first
        if (!aConnected && bConnected) return -1;
        if (aConnected && !bConnected) return 1;

        // 2. Exact craft match next
        const aCraftMatch = a.craft === userCraft;
        const bCraftMatch = b.craft === userCraft;
        if (aCraftMatch && !bCraftMatch) return -1;
        if (!aCraftMatch && bCraftMatch) return 1;

        return 0;
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute stale time for users list
  });

  return { users, loading };
};
