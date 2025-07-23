import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageCircle, 
  Users, 
  Plus, 
  Search, 
  Filter,
  Globe,
  Lock,
  Crown,
  UserPlus,
  Eye
} from 'lucide-react';

interface DiscussionRoom {
  id: string;
  title: string;
  description: string;
  room_type: string;
  member_count: number;
  creator_id: string;
  is_active: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  } | null;
}

const DiscussionRooms = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<DiscussionRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    title: '',
    description: '',
    room_type: 'public' as 'public' | 'private',
  });

  useEffect(() => {
    fetchRooms();
  }, [activeTab]);

  const fetchRooms = async () => {
    try {
      let query = supabase
        .from('discussion_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (activeTab === 'my') {
        query = query.eq('creator_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: "Error",
        description: "Failed to load discussion rooms.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!user || !newRoom.title.trim()) return;

    try {
      const { error } = await supabase
        .from('discussion_rooms')
        .insert({
          ...newRoom,
          creator_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Room Created",
        description: "Your discussion room has been created successfully!",
      });

      setCreateModalOpen(false);
      setNewRoom({ title: '', description: '', room_type: 'public' });
      fetchRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "Creation Failed",
        description: "There was an error creating your discussion room.",
        variant: "destructive",
      });
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Joined Room",
        description: "You have successfully joined the discussion room!",
      });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "Join Failed",
        description: "There was an error joining the room.",
        variant: "destructive",
      });
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const RoomCard = ({ room }: { room: DiscussionRoom }) => (
    <Card className="border-white/10 bg-cinesphere-dark/50 hover:bg-cinesphere-dark/70 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-xl mb-2 flex items-center">
              {room.room_type === 'private' ? (
                <Lock className="mr-2 h-5 w-5 text-yellow-400" />
              ) : (
                <Globe className="mr-2 h-5 w-5 text-green-400" />
              )}
              {room.title}
            </CardTitle>
            <div className="flex items-center space-x-2 mb-3">
              <Badge variant="outline" className="capitalize">
                {room.room_type}
              </Badge>
              <div className="flex items-center text-gray-400 text-sm">
                <Users className="mr-1 h-3 w-3" />
                {room.member_count} members
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300 mb-4 line-clamp-2">{room.description}</p>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-gray-400 text-sm">
            <div className="w-6 h-6 bg-cinesphere-purple rounded-full flex items-center justify-center mr-2">
              {room.profiles?.full_name?.charAt(0) || 'U'}
            </div>
            <span>{room.profiles?.full_name || 'Unknown'}</span>
            <Crown className="ml-2 h-4 w-4 text-yellow-400" />
          </div>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(room.created_at), { addSuffix: true })}
          </span>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={() => joinRoom(room.id)}
            className="flex-1 bg-cinesphere-purple hover:bg-cinesphere-purple/90"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Join Room
          </Button>
          <Button variant="outline" className="border-white/20 hover:bg-white/10">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-cinesphere-dark pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-white/10 bg-cinesphere-dark/50">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cinesphere-dark pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <MessageCircle className="mr-3 h-8 w-8" />
              Discussion Rooms
            </h1>
            <p className="text-gray-400">Join conversations about film, crafts, and industry trends</p>
          </div>
          
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                <Plus className="mr-2 h-4 w-4" />
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-cinesphere-dark/95 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Create Discussion Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-title">Room Title</Label>
                  <Input
                    id="room-title"
                    value={newRoom.title}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter room title"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-description">Description</Label>
                  <Textarea
                    id="room-description"
                    value={newRoom.description}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this room is about..."
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <div className="flex space-x-2">
                    <Button
                      variant={newRoom.room_type === 'public' ? 'default' : 'outline'}
                      onClick={() => setNewRoom(prev => ({ ...prev, room_type: 'public' }))}
                      className="flex-1"
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Public
                    </Button>
                    <Button
                      variant={newRoom.room_type === 'private' ? 'default' : 'outline'}
                      onClick={() => setNewRoom(prev => ({ ...prev, room_type: 'private' }))}
                      className="flex-1"
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Private
                    </Button>
                  </div>
                </div>
                <Button 
                  onClick={handleCreateRoom}
                  className="w-full bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                >
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <Button variant="outline" className="border-white/20 hover:bg-white/10">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-cinesphere-dark/50 border border-white/10">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                All Rooms ({rooms.length})
              </TabsTrigger>
              <TabsTrigger 
                value="my"
                className="data-[state=active]:bg-cinesphere-purple data-[state=active]:text-white"
              >
                My Rooms
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageCircle className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              {searchTerm ? 'No rooms match your search' : 'No discussion rooms found'}
            </p>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Be the first to create a discussion room'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Room
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscussionRooms;
