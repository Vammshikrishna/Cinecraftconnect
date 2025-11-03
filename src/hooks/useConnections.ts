import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  };
  following_profile?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    craft: string;
    location: string;
  };
}

export const useConnections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Connection[]>([]);
  const [sentRequests, setSentRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch accepted connections
      const { data: acceptedData, error: acceptedError } = await supabase
        .from('user_connections')
        .select('*')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (acceptedError) throw acceptedError;

      // Fetch pending requests received
      const { data: pendingData, error: pendingError } = await supabase
        .from('user_connections')
        .select('*')
        .eq('following_id', user.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Fetch sent requests
      const { data: sentData, error: sentError } = await supabase
        .from('user_connections')
        .select('*')
        .eq('follower_id', user.id)
        .eq('status', 'pending');

      if (sentError) throw sentError;

      // Fetch profiles for all connections
      const allUserIds = new Set<string>();
      [...(acceptedData || []), ...(pendingData || []), ...(sentData || [])].forEach((conn) => {
        allUserIds.add(conn.follower_id);
        allUserIds.add(conn.following_id);
      });

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(allUserIds));

      const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

      // Map profiles to connections
      const mapConnections = (connections: any[]) =>
        connections.map((conn) => ({
          ...conn,
          follower_profile: profilesMap.get(conn.follower_id),
          following_profile: profilesMap.get(conn.following_id),
        }));

      setConnections(mapConnections(acceptedData || []));
      setPendingRequests(mapConnections(pendingData || []));
      setSentRequests(mapConnections(sentData || []));
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connections',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('user_connections_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_connections',
          filter: `follower_id=eq.${user?.id}`,
        },
        () => {
          fetchConnections();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_connections',
          filter: `following_id=eq.${user?.id}`,
        },
        () => {
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const sendConnectionRequest = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_connections')
        .insert({
          follower_id: user.id,
          following_id: userId,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request sent',
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error sending connection request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send connection request',
        variant: 'destructive',
      });
    }
  };

  const acceptConnectionRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request accepted',
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error accepting connection request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept connection request',
        variant: 'destructive',
      });
    }
  };

  const rejectConnectionRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request rejected',
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error rejecting connection request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject connection request',
        variant: 'destructive',
      });
    }
  };

  const cancelConnectionRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request cancelled',
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error cancelling connection request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel connection request',
        variant: 'destructive',
      });
    }
  };

  const removeConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection removed',
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error removing connection:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove connection',
        variant: 'destructive',
      });
    }
  };

  return {
    connections,
    pendingRequests,
    sentRequests,
    loading,
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
    cancelConnectionRequest,
    removeConnection,
  };
};
