
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Search, MessageSquare, PlusCircle, Lock, Globe } from 'lucide-react';
import { Category } from '@/components/discussions/types';
import { DiscussionChatInterface } from '@/components/discussions/DiscussionChatInterface';

// --- DATA INTERFACES ---


interface Room {
  id: string;
  title: string;
  description: string | null;
  member_count: number;
  room_type: 'public' | 'private' | 'secret';
  category_id: string;
  creator_id: string;
  created_at: string;
  room_categories: { name: string } | null;
  // This is a client-side addition
  tags?: string[];
}

// --- MAIN PAGE COMPONENT ---
const DiscussionRoomsPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, categoriesRes] = await Promise.all([
        supabase
          .from('discussion_rooms')
          .select('id, title, description, created_at, category_id, room_type, creator_id, member_count:room_members(count), room_categories(name)'),
        supabase.from('room_categories').select('id, name')
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      // @ts-ignore
      const formattedRooms = roomsRes.data.map(room => ({
        ...room,
        member_count: room.member_count[0]?.count || 0,
        room_type: room.room_type as 'public' | 'private' | 'secret',
        category_id: room.category_id || '',
        creator_id: room.creator_id || '',
        // Mock tags for UI richness
        tags: ['cinema', 'directing', 'qa'].slice(0, Math.floor(Math.random() * 3) + 1),
      }));

      setRooms(formattedRooms);
      setCategories((categoriesRes.data || []).map(c => ({ ...c, description: null, icon: null })));
    } catch (error: any) {
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('discussion-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_rooms' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_categories' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Handle deep linking to a specific room
  useEffect(() => {
    if (roomId && rooms.length > 0 && !selectedRoom) {
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        setSelectedRoom(room);
      }
    }
  }, [roomId, rooms, selectedRoom]);

  const handleRoomCreated = (newRoom: Room) => {
    setRooms(prevRooms => [newRoom, ...prevRooms]);
    setSelectedRoom(newRoom);
  };

  const handleRoomUpdated = (roomId: string, newTitle: string, newDescription: string) => {
    setRooms(prevRooms => prevRooms.map(r => r.id === roomId ? { ...r, title: newTitle, description: newDescription } : r));
    if (selectedRoom && selectedRoom.id === roomId) {
      setSelectedRoom(prev => prev ? { ...prev, title: newTitle, description: newDescription } : null);
    }
  }

  const filteredAndSortedRooms = useMemo(() => {
    let processedRooms = rooms.filter(room =>
      (room.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filterCategory !== 'all') {
      processedRooms = processedRooms.filter(room => room.category_id === filterCategory);
    }

    switch (sortBy) {
      case 'popularity':
        processedRooms.sort((a, b) => b.member_count - a.member_count);
        break;
      case 'name':
        processedRooms.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'newest':
        processedRooms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return processedRooms;
  }, [rooms, searchQuery, filterCategory, sortBy]);

  const featuredRooms = useMemo(() => {
    return [...rooms].sort((a, b) => b.member_count - a.member_count).slice(0, 3);
  }, [rooms]);


  if (loading && rooms.length === 0) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-20 w-20 animate-spin text-primary" /></div>;
  }

  if (selectedRoom) {
    return (
      <div className="fixed inset-0 bg-background text-foreground flex flex-col pt-0 lg:pt-16 z-50">
        <DiscussionChatInterface
          roomId={selectedRoom.id}
          userRole="member"
          roomTitle={selectedRoom.title}
          roomDescription={selectedRoom.description}
          categoryId={selectedRoom.category_id}
          categories={categories}
          onClose={() => {
            setSelectedRoom(null);
            navigate('/discussion-rooms');
          }}
          onRoomUpdated={handleRoomUpdated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto pt-16 pb-24">
        {/* Header and Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-foreground">Discussion Rooms</h1>
          <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                <PlusCircle size={20} /> Create Room
              </Button>
            </DialogTrigger>
            <CreateRoomModal
              categories={categories}
              closeModal={() => setCreateModalOpen(false)}
              onRoomCreated={handleRoomCreated}
            />
          </Dialog>
        </div>

        {/* Featured Rooms */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-primary">Featured Rooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredRooms.map(room => <RoomCard key={room.id} room={room} onJoin={setSelectedRoom} />)}
          </div>
        </section>

        {/* All Rooms Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-primary">All Rooms</h2>
          {/* Filtering and Sorting UI */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-card border border-border rounded-lg">
            <div className="relative flex-grow sm:flex-grow-0 sm:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-input border-border pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px] bg-input border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px] bg-input border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="popularity">Popularity</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedRooms.map(room => <RoomCard key={room.id} room={room} onJoin={setSelectedRoom} />)}
          </div>
          {filteredAndSortedRooms.length === 0 && !loading && (
            <div className="text-center col-span-full py-12">
              <p className="text-muted-foreground text-lg">No rooms found matching your criteria.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// --- ROOM CARD COMPONENT ---
const RoomCard = ({ room, onJoin }: { room: Room; onJoin: (room: Room) => void; }) => {
  return (
    <Card className="glass-card hover-lift flex flex-col justify-between transform hover:-translate-y-1 transition-transform duration-300 overflow-hidden border-border">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-3">
          <h3 className="text-lg font-bold text-foreground line-clamp-2 md:line-clamp-1 md:truncate md:pr-2">{room.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-xs font-bold uppercase px-2 py-1 rounded-md bg-primary/20 text-primary whitespace-nowrap">
              {room.room_categories?.name || 'General'}
            </div>
            {room.room_type === 'private' && (
              <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
                <Lock className="h-3 w-3" />
                Private
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground h-10 mb-4 overflow-hidden">{room.description || 'No description available.'}</p>
        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <Users className="w-4 h-4 mr-2 text-primary" /> {room.member_count} active members
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {room.tags?.map(tag => (
            <span key={tag} className="text-xs glass-badge">{tag}</span>
          ))}
        </div>
      </CardContent>
      <div className="bg-card/50 p-4 border-t border-border">
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => onJoin(room)}>
          <MessageSquare className="w-4 h-4 mr-2" /> Join Chat
        </Button>
      </div>
    </Card>
  );
}

// --- CREATE ROOM MODAL ---
interface CreateRoomModalProps {
  categories: Category[];
  closeModal: () => void;
  onRoomCreated: (room: Room) => void;
}

const CreateRoomModal = ({ categories, closeModal, onRoomCreated }: CreateRoomModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !categoryId || !user) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the room by calling the RPC function
      const { data: newRoomId, error: rpcError } = await supabase.rpc('create_discussion_room_with_creator' as any, {
        c_id: user.id,
        cat_id: categoryId,
        room_title: title,
        room_description: description,
        type: isPrivate ? 'private' : 'public',
        room_tags: [] // Pass empty array for now
      });

      if (rpcError) throw rpcError;
      if (!newRoomId) throw new Error("Could not create the new room.");

      // 2. Fetch the full room data to update the UI
      const { data: newRoomData, error: fetchError } = await supabase
        .from('discussion_rooms')
        .select('id, title, description, created_at, category_id, room_type, creator_id, room_categories(name)')
        .eq('id', newRoomId as unknown as string)
        .single();

      if (fetchError) throw fetchError;

      toast({ title: "Success!", description: "Your room has been created." });

      // 3. Construct the final Room object for the UI
      // 3. Construct the final Room object for the UI
      const finalRoomObject: Room = {
        ...newRoomData,
        room_type: newRoomData.room_type as 'public' | 'private' | 'secret',
        category_id: newRoomData.category_id || '',
        creator_id: newRoomData.creator_id || '',
        member_count: 1, // Creator is the first member
        tags: [], // Mock tags or leave empty
      };

      onRoomCreated(finalRoomObject);
      closeModal();
    } catch (error: any) {
      toast({ title: "Error creating room", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="glass-modal border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">Create a New Discussion Room</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1 text-foreground">Room Name *</label>
          <Input id="name" value={title} onChange={e => setTitle(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1 text-foreground">Description</label>
          <Input id="description" value={description} onChange={e => setDescription(e.target.value)} className="glass-input" />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1 text-foreground">Category *</label>
          <Select onValueChange={setCategoryId}>
            <SelectTrigger id="category" className="w-full glass-input">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="glass-dropdown">
              {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-foreground">
            {!isPrivate ? <Globe className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
            Room Visibility
          </Label>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/50">
            <div className="flex-1">
              <p className="font-medium text-foreground">{!isPrivate ? 'Public Room' : 'Private Room'}</p>
              <p className="text-sm text-muted-foreground">
                {!isPrivate
                  ? 'Visible to everyone. Anyone can view and join.'
                  : 'Only visible to invited members. Others cannot see this room.'}
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default DiscussionRoomsPage;
