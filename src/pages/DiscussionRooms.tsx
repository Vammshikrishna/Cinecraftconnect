import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Users, Plus, Search, Globe, Lock, Tag, TrendingUp, Clock, Star } from 'lucide-react';
import EnhancedRealTimeChat from '@/components/chat/EnhancedRealTimeChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Interfaces
interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// Represents the raw data from Supabase, which might have invalid nested relations.
interface RawDiscussionRoom {
  id: string;
  title: string;
  description: string;
  room_type: string;
  member_count: number;
  creator_id: string;
  created_at: string;
  last_activity_at: string | null;
  category_id: string | null;
  tags: string[] | null;
  creator_profile?: Profile | null | { error: true; };
  room_categories?: Category | null;
  members?: { profiles: Profile | null | { error: true; } }[] | null;
}

// Represents the clean, reliable data structure used in the component's state.
interface SanitizedDiscussionRoom {
  id: string;
  title: string;
  description: string;
  room_type: string;
  member_count: number;
  creator_id: string;
  created_at: string;
  last_activity_at: string | null;
  category_id: string | null;
  tags: string[] | null;
  creator_profile: Profile | null; // No error union
  room_categories?: Category | null;
  members: { profiles: Profile }[]; // Guaranteed to be an array of valid profiles
}

// Type guard for Profile
function isProfile(obj: any): obj is Profile {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj && typeof obj.id === 'string' &&
    'full_name' in obj && (typeof obj.full_name === 'string' || obj.full_name === null) &&
    'avatar_url' in obj && (typeof obj.avatar_url === 'string' || obj.avatar_url === null) &&
    !('error' in obj) // This line ensures objects with an 'error' property return false.
  );
}


const DiscussionRooms = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const MAX_TITLE_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 500;
  const MAX_TAGS = 5;
  const MAX_TAG_LENGTH = 25;
  const TAG_REGEX = /^[a-zA-Z0-9-]+$/;

  const [rooms, setRooms] = useState<SanitizedDiscussionRoom[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const [newRoom, setNewRoom] = useState({
    title: '',
    description: '',
    room_type: 'public' as 'public' | 'private',
    category_id: '',
  });
  const [tagInput, setTagInput] = useState('');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('discussion_rooms').select(`
        *,
        creator_profile:creator_id ( id, full_name, avatar_url ),
        room_categories ( * ),
        members:room_members ( profiles ( id, full_name, avatar_url ) )
      `);

      if (selectedCategory && selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      if (sortBy === 'member_count') query = query.order('member_count', { ascending: false });
      else if (sortBy === 'created_at') query = query.order('created_at', { ascending: false });
      else query = query.order('last_activity_at', { ascending: false, nullsFirst: false });

      const { data, error } = await query.limit(100);
      if (error) {
        console.error("Supabase error:", error);
        throw new Error("Failed to fetch discussion rooms. Check RLS policies.");
      }
      
      const rawRooms: RawDiscussionRoom[] = data || [];

      // Sanitize the raw data from Supabase
      const sanitizedRooms: SanitizedDiscussionRoom[] = rawRooms.map(rawRoom => {
        const validCreatorProfile = isProfile(rawRoom.creator_profile) ? rawRoom.creator_profile : null;
        
        const validMembers = (rawRoom.members || [])
          .filter(member => isProfile(member.profiles))
          .map(member => ({ profiles: member.profiles as Profile }));

        return {
          ...rawRoom,
          creator_profile: validCreatorProfile,
          members: validMembers,
        };
      });

      setRooms(sanitizedRooms);

    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({ title: "Error", description: "Failed to load discussion rooms.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy, toast]);

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchRooms();
    }
  }, [isAuthLoading, user, fetchRooms]);

  useEffect(() => {
    const initializeCategories = async () => {
      try {
        const { data, error } = await supabase.from('room_categories').select('*');
        if (error) throw error;

        let categoriesData = data || [];
        let generalCat = categoriesData.find(cat => cat.name === 'General Discussion');

        if (!generalCat) {
          const { data: newCatData, error: newCatError } = await supabase
            .from('room_categories')
            .insert({ name: 'General Discussion', description: 'A place for all topics.' })
            .select()
            .single();
          
          if (newCatError) throw newCatError;
          
          generalCat = newCatData;
          categoriesData = [...categoriesData, generalCat];
        }
        
        categoriesData.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(categoriesData);

        if (generalCat) {
          setDefaultCategoryId(generalCat.id);
          setSelectedCategory(generalCat.id);
          setNewRoom(prev => ({ ...prev, category_id: generalCat.id }));
        }
      } catch (error) {
        console.error('Error initializing categories:', error);
        toast({ title: "Error", description: "Could not initialize room categories.", variant: "destructive" });
      }
    };
    
    if (user) {
      initializeCategories();
    }
  }, [user, toast]);

  const handleCreateRoom = async () => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    const title = newRoom.title.trim();
    const description = newRoom.description.trim();

    if (!title || title.length > MAX_TITLE_LENGTH || /[<>]/.test(title)) {
      toast({ title: "Invalid Title", description: `Title is required, must be under ${MAX_TITLE_LENGTH} chars, and cannot contain '<' or '>'.`, variant: "destructive" });
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH || /[<>]/.test(description)) {
      toast({ title: "Invalid Description", description: `Description must be under ${MAX_DESCRIPTION_LENGTH} chars and cannot contain '<' or '>'.`, variant: "destructive" });
      return;
    }

    const tags = tagInput.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tags.length > MAX_TAGS) {
      toast({ title: "Too Many Tags", description: `You can add a maximum of ${MAX_TAGS} tags.`, variant: "destructive" });
      return;
    }
    for (const tag of tags) {
      if (tag.length > MAX_TAG_LENGTH || !TAG_REGEX.test(tag)) {
        toast({ title: "Invalid Tag", description: `Tag "${tag}" is invalid. Tags must be ${MAX_TAG_LENGTH} chars or less and contain only letters, numbers, and hyphens.`, variant: "destructive" });
        return;
      }
    }

    try {
      const { data: newRoomId, error } = await supabase.rpc('create_discussion_room_with_creator', {
        room_title: title,
        room_description: description,
        type: newRoom.room_type,
        cat_id: newRoom.category_id || defaultCategoryId,
        room_tags: tags.length > 0 ? tags : null,
        c_id: user.id,
      });

      if (error) throw error;
      
      const newRoomForUI: SanitizedDiscussionRoom = {
        id: newRoomId,
        title: title,
        description: description,
        room_type: newRoom.room_type,
        member_count: 1,
        creator_id: user.id,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        category_id: newRoom.category_id || defaultCategoryId,
        tags: tags.length > 0 ? tags : null,
        creator_profile: {
            id: user.id,
            full_name: user.user_metadata.full_name || null,
            avatar_url: user.user_metadata.avatar_url || null
        },
        room_categories: categories.find(c => c.id === (newRoom.category_id || defaultCategoryId)),
        members: [{ profiles: { id: user.id, full_name: user.user_metadata.full_name || null, avatar_url: user.user_metadata.avatar_url || null } }]
      };

      setRooms(prevRooms => [newRoomForUI, ...prevRooms]);
      toast({ title: "Room Created", description: "Your discussion room has been created successfully!" });
      setCreateModalOpen(false);
      setNewRoom({ title: '', description: '', room_type: 'public', category_id: defaultCategoryId || '' });
      setTagInput('');

    } catch (error: any) {
      console.error('Error creating room:', error);
      toast({ title: "Creation Failed", description: error.message || "There was an error creating your room.", variant: "destructive" });
    }
  };

  const joinRoom = (roomId: string) => {
    setSelectedRoom(roomId);
    setChatOpen(true);
  };

  const filteredRooms = useMemo(() => rooms.filter(room => {
    const searchTermLower = searchTerm.toLowerCase();
    return room.title.toLowerCase().includes(searchTermLower) ||
           room.description.toLowerCase().includes(searchTermLower) ||
           (room.tags && room.tags.some(tag => tag.toLowerCase().includes(searchTermLower)));
  }), [rooms, searchTerm]);

  const featuredRooms = useMemo(() => [...rooms].sort((a, b) => b.member_count - a.member_count).slice(0, 3), [rooms]);

  const RoomCard = ({ room, isFeatured = false }: { room: SanitizedDiscussionRoom, isFeatured?: boolean }) => {
    return (
      <Card className={`transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-xl ${isFeatured ? 'bg-gradient-to-br from-purple-800 to-indigo-900 border-purple-600' : 'bg-gray-800/80 border-gray-700'}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              {room.room_type === 'private' ? <Lock className="w-4 h-4 text-yellow-400" /> : <Globe className="w-4 h-4 text-green-400" />}
              {room.title}
            </CardTitle>
            {room.room_categories && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">{room.room_categories.name}</Badge>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{room.description}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 mb-4">
            {room.tags?.map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs border-gray-600 text-gray-300"><Tag className="mr-1 h-3 w-3" />{tag}</Badge>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
            <div className="flex items-center"><Users className="w-3 h-3 mr-1.5" /><span>{room.member_count} Members</span></div>
            <div className="flex items-center"><Clock className="w-3 h-3 mr-1.5" /><span>{room.last_activity_at ? formatDistanceToNow(new Date(room.last_activity_at), { addSuffix: true }) : 'Never active'}</span></div>
          </div>
          <div className="flex items-center mb-4">
            <div className="flex -space-x-2 overflow-hidden">
              {room.members.slice(0, 5).map((member, index) => (
                <Avatar key={member.profiles.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-gray-800">
                  <AvatarImage src={member.profiles.avatar_url || undefined} />
                  <AvatarFallback>{member.profiles.full_name?.[0] ?? '?'}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {room.member_count > 5 && <span className="pl-2 text-xs text-gray-500">+{room.member_count - 5} more</span>}
          </div>
          <Button onClick={() => joinRoom(room.id)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"><MessageCircle className="w-4 h-4 mr-2" />Join Discussion</Button>
        </CardContent>
      </Card>
    );
  };

  if ((isAuthLoading || loading) && rooms.length === 0) {
    return <div className="flex items-center justify-center h-screen bg-gray-900"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 pt-24">
      <div className="container mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div className="text-center md:text-left">
                <h1 className="text-4xl lg:text-5xl font-extrabold text-white flex items-center justify-center md:justify-start gap-3">
                    <MessageCircle className="w-10 h-10 text-indigo-500" /> Discussion Rooms
                </h1>
                <p className="mt-2 text-lg text-gray-400 max-w-2xl">
                    Explore and engage in topics that matter to you. From filmmaking to post-production, there's a room for everyone.
                </p>
            </div>
            <div className="mt-4 md:mt-0">
                <Button onClick={() => setCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-lg flex items-center">
                    <Plus className="mr-2 h-5 w-5" />Create New Room
                </Button>
            </div>
        </header>

        {featuredRooms.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Star className="w-6 h-6 text-yellow-400"/> Featured Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{featuredRooms.map(room => <RoomCard key={room.id} room={room} isFeatured />)}</div>
          </section>
        )}

        <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-sm py-4 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-grow w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><Input placeholder="Search by title, description, or tag..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 w-full bg-gray-800 border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" /></div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger className="w-full md:w-[200px] bg-gray-800 border-gray-700"><SelectValue placeholder="Filter by category" /></SelectTrigger><SelectContent className="bg-gray-800 border-gray-700 text-white">{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent></Select>
              <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-full md:w-[200px] bg-gray-800 border-gray-700"><SelectValue placeholder="Sort by" /></SelectTrigger><SelectContent className="bg-gray-800 border-gray-700 text-white"><SelectItem value="last_activity_at"><TrendingUp className="w-4 h-4 inline-block mr-2"/>Recently Active</SelectItem><SelectItem value="member_count"><Users className="w-4 h-4 inline-block mr-2"/>Most Popular</SelectItem><SelectItem value="created_at"><Clock className="w-4 h-4 inline-block mr-2"/>Newest</SelectItem></SelectContent></Select>
            </div>
          </div>
        </div>
        
        <Dialog open={chatOpen} onOpenChange={setChatOpen}>
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 bg-gray-800 border-gray-700 text-white">
            <DialogHeader className="p-4 border-b border-gray-700">
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-indigo-400" />
                {rooms.find(r => r.id === selectedRoom)?.title || 'Loading Room...'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-0">
              {selectedRoom && <EnhancedRealTimeChat roomId={selectedRoom} roomTitle={rooms.find(r => r.id === selectedRoom)?.title || ''} />}
            </div>
          </DialogContent>
        </Dialog>

        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{filteredRooms.map(room => <RoomCard key={room.id} room={room} />)}</div>
        ) : (
          <div className="text-center py-16 px-4 bg-gray-800/50 rounded-lg">
            <MessageCircle className="mx-auto h-16 w-16 text-gray-500 mb-4" /><h3 className="text-xl font-semibold text-white mb-2">No Rooms Found</h3><p className="text-gray-400 mb-6">Be the first to spark a conversation! Create a new room and invite others to join.</p><Button onClick={() => setCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg"><Plus className="mr-2 h-5 w-5" />Create a Discussion Room</Button>
          </div>
        )}

        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogContent className="bg-gray-800 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>Create a New Discussion Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label htmlFor="room-title">Title</Label><Input id="room-title" value={newRoom.title} onChange={e => setNewRoom({...newRoom, title: e.target.value})} placeholder="e.g., VFX for Indie Films" className="bg-gray-700 border-gray-600"/></div>
                <div><Label htmlFor="room-desc">Description</Label><Textarea id="room-desc" value={newRoom.description} onChange={e => setNewRoom({...newRoom, description: e.target.value})} placeholder="A place to discuss techniques, software, and challenges..." className="bg-gray-700 border-gray-600"/></div>
                <div><Label htmlFor="room-tags">Tags (comma-separated)</Label><Input id="room-tags" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="e.g., vfx, indie-film, color-grading" className="bg-gray-700 border-gray-600"/></div>
                <div><Label htmlFor="room-cat">Category</Label><Select value={newRoom.category_id} onValueChange={val => setNewRoom({...newRoom, category_id: val})}><SelectTrigger className="w-full md:w-[200px] bg-gray-800 border-gray-700"><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent className="bg-gray-800 border-gray-700 text-white">{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Room Type</Label><div className="flex gap-2"> <Button onClick={() => setNewRoom({...newRoom, room_type: 'public'})} variant={newRoom.room_type === 'public' ? 'secondary' : 'outline'} className="w-full"><Globe className="mr-2 w-4 h-4"/>Public</Button> <Button onClick={() => setNewRoom({...newRoom, room_type: 'private'})} variant={newRoom.room_type === 'private' ? 'secondary' : 'outline'} className="w-full"><Lock className="mr-2 w-4 h-4"/>Private</Button></div></div>
                <Button onClick={handleCreateRoom} className="w-full bg-indigo-600 hover:bg-indigo-700">Create Room</Button>
              </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DiscussionRooms;
