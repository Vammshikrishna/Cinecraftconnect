import { useEffect, useState } from 'react';
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch all users except current user
        let query = supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id);

        // Apply search filter
        if (searchQuery) {
          query = query.or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,craft.ilike.%${searchQuery}%`);
        }

        // Apply craft filter
        if (craftFilter && craftFilter !== 'All') {
          query = query.ilike('craft', `%${craftFilter}%`);
        }

        const { data: profilesData, error: profilesError } = await query.limit(50);

        if (profilesError) throw profilesError;

        // Fetch user's connections to determine status
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('user_connections')
          .select('*')
          .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

        if (connectionsError) throw connectionsError;

        // Map connection status to each user
        const usersWithStatus = profilesData?.map((profile) => {
          const sentConnection = connectionsData?.find(
            (c) => c.follower_id === user.id && c.following_id === profile.id
          );
          const receivedConnection = connectionsData?.find(
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
        }) || [];

        setUsers(usersWithStatus);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user?.id, searchQuery, craftFilter]);

  return { users, loading };
};
