import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, UserCheck, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface NetworkListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialTab?: 'followers' | 'following' | 'connections';
}

export function NetworkListDialog({ isOpen, onClose, userId, initialTab = 'followers' }: NetworkListDialogProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Update active tab if initialTab changes while open
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  const { data: followers, isLoading: loadingFollowers } = useQuery({
    queryKey: ['profile_followers', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          id,
          created_at,
          profile:profiles!fk_follower_user(
            id,
            full_name,
            avatar_url,
            craft
          )
        `)
        .eq('following_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => item.profile).filter(Boolean);
    },
    enabled: isOpen && activeTab === 'followers',
  });

  const { data: following, isLoading: loadingFollowing } = useQuery({
    queryKey: ['profile_following', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          id,
          created_at,
          profile:profiles!fk_following_user(
            id,
            full_name,
            avatar_url,
            craft
          )
        `)
        .eq('follower_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => item.profile).filter(Boolean);
    },
    enabled: isOpen && activeTab === 'following',
  });

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['profile_connections', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_connections')
        .select(`
          id,
          user1:profiles!user_connections_follower_id_fkey(id, full_name, avatar_url, craft),
          user2:profiles!user_connections_following_id_fkey(id, full_name, avatar_url, craft)
        `)
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (error) throw error;
      
      return (data || []).map((conn: any) => {
        return conn.user1.id === userId ? conn.user2 : conn.user1;
      }).filter(Boolean);
    },
    enabled: isOpen && activeTab === 'connections',
  });

  const handleUserClick = (id: string) => {
    onClose();
    navigate(`/profile/${id}`);
  };

  const UserList = ({ users, isLoading, emptyMessage }: { users: any[], isLoading: boolean, emptyMessage: string }) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }

    const filteredUsers = users?.filter(u => 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.craft?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (filteredUsers.length === 0) {
      return (
        <div className="text-center p-12 text-muted-foreground text-sm">
          {searchQuery ? 'No users found matching your search.' : emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredUsers.map((u, i) => (
          <div 
            key={u.id || i}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => handleUserClick(u.id)}
          >
            <Avatar className="h-12 w-12 border border-border/50">
              <AvatarImage src={u.avatar_url} />
              <AvatarFallback>{u.full_name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-foreground">{u.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{u.craft || 'Member'}</p>
            </div>
            
            {/* Action Button */}
            <Button
              variant={activeTab === 'followers' ? 'default' : 'secondary'}
              size="sm"
              className={`h-8 rounded-lg px-4 text-[11px] font-bold tracking-wide ${activeTab === 'followers' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleUserClick(u.id);
              }}
            >
              {activeTab === 'following' ? 'Following' : activeTab === 'connections' ? 'Connected' : 'Follow'}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-full max-h-[90vh] h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden p-0 gap-0 !top-auto !bottom-0 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%] rounded-b-none sm:rounded-b-xl rounded-t-2xl sm:rounded-t-xl transition-transform duration-300">
        <DialogHeader className="p-4 pb-2 border-b border-border/10">
          <DialogTitle className="text-center font-bold text-lg">Network</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => { setActiveTab(val); setSearchQuery(''); }} className="w-full flex-1 flex flex-col min-h-0">
          {/* Custom Tabs List that looks like Instagram (Underlines instead of pills) */}
          <TabsList className="w-full grid grid-cols-3 bg-transparent rounded-none p-0 h-12 border-b border-border/30">
            <TabsTrigger 
              value="followers" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs md:text-sm font-bold text-muted-foreground data-[state=active]:text-foreground h-full"
            >
              Followers
            </TabsTrigger>
            <TabsTrigger 
              value="following" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs md:text-sm font-bold text-muted-foreground data-[state=active]:text-foreground h-full"
            >
              Following
            </TabsTrigger>
            <TabsTrigger 
              value="connections" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs md:text-sm font-bold text-muted-foreground data-[state=active]:text-foreground h-full"
            >
              Connections
            </TabsTrigger>
          </TabsList>
          
          {/* Search Bar */}
          <div className="p-3 border-b border-border/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 border-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl h-10 shadow-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <TabsContent value="followers" className="m-0 h-full">
              <UserList 
                users={followers || []} 
                isLoading={loadingFollowers} 
                emptyMessage="No followers yet."
              />
            </TabsContent>
            
            <TabsContent value="following" className="m-0 h-full">
              <UserList 
                users={following || []} 
                isLoading={loadingFollowing} 
                emptyMessage="Not following anyone yet."
              />
            </TabsContent>
            
            <TabsContent value="connections" className="m-0 h-full">
              <UserList 
                users={connections || []} 
                isLoading={loadingConnections} 
                emptyMessage="No connections yet."
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
