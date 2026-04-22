import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { supabase } from '@/integrations/supabase/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Search, PlusCircle, Lock, Globe, MoreVertical, Edit, Trash2, Radio, Share2, ArrowLeft, Bell } from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { Category } from '@/components/discussions/types';
import { DiscussionChatInterface } from '@/components/discussions/DiscussionChatInterface';
import { EnhancedSkeleton, CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';
import { getDisplayMessage } from '@/lib/chat-utils';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import { useGlobalCall } from '@/contexts/CallContext';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

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
  last_message?: { content: string; created_at: string; sender_name?: string } | null;
  // This is a client-side addition
  tags?: string[];
}

// --- MAIN PAGE COMPONENT ---
const DiscussionRoomsPage = ({ openCreate = false }: { openCreate?: boolean }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCallRoomIds, setActiveCallRoomIds] = useState<Set<string>>(new Set());
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { callState } = useGlobalCall();
  const { unreadDiscussionIds } = useUnreadMessages();
  const isInCall = callState.isActive && callState.roomId === roomId;
  const isCallMinimized = callState.isMinimized;

  // Use URL as the source of truth for the selected room
  const activeRoom = useMemo(() => {
    if (!roomId || rooms.length === 0) return null;
    return rooms.find(r => r.id === roomId) || null;
  }, [roomId, rooms]);

  // Generate a stable anonymous display name for fans in public rooms
  const fanAnonName = useMemo(() => {
    if (!user) return 'Viewer';
    // Deterministic number from user id so it's consistent per session
    const num = parseInt(user.id.replace(/-/g, '').slice(0, 6), 16) % 999 + 1;
    return `Viewer #${num}`;
  }, [user]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [isCreateModalOpen, setCreateModalOpen] = useState(openCreate);
  const [roomToShare, setRoomToShare] = useState<Room | null>(null);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (openCreate) setCreateModalOpen(true);
  }, [openCreate]);

  const fetchData = useCallback(async () => {
    // Keep silent refresh for background updates
    try {
      const [roomsRes, categoriesRes] = await Promise.all([
        supabase
          .from('discussion_rooms')
          .select(`
            id, 
            title, 
            description, 
            created_at, 
            category_id, 
            room_type, 
            creator_id, 
            member_count, 
            room_categories(name), 
            tags,
            room_messages(content, created_at, profiles(full_name))
          `)
          .order('created_at', { foreignTable: 'room_messages', ascending: false }),
        supabase.from('room_categories').select('id, name')
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const formattedRooms = (roomsRes.data as any[]).map(room => {
        const lastMsg = room.room_messages?.[0];
        return {
          ...room,
          member_count: room.member_count || 0,
          room_type: room.room_type as 'public' | 'private' | 'secret',
          category_id: room.category_id || '',
          creator_id: room.creator_id || '',
          tags: room.tags || [],
          last_message: lastMsg ? {
            content: lastMsg.content,
            created_at: lastMsg.created_at,
            sender_name: lastMsg.profiles?.full_name || 'User'
          } : null
        };
      });

      setRooms(formattedRooms);
      setCategories((categoriesRes.data || []).map(c => ({ ...c, description: null, icon: null })));

      // Fetch active calls for discussion rooms (only started in last 6 hours to avoid stale status)
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: activeCalls } = await supabase
        .from('calls' as any)
        .select('room_id')
        .eq('room_type', 'discussion')
        .eq('status', 'active')
        .gt('created_at', sixHoursAgo);

      if (activeCalls) {
        setActiveCallRoomIds(new Set(activeCalls.map((c: any) => c.room_id)));
      }
    } catch (error: any) {
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();

    // Debounce the refresh to prevent UI freezing on rapid updates
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData();
      }, 1000); // Wait 1s after last update before refreshing
    };

    const channel = supabase.channel('discussion-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_rooms' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_categories' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, debouncedRefresh)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleRoomJoin = (room: Room) => {
    // Fans can only join PUBLIC rooms
    if (isFan && room.room_type !== 'public') {
      toast({
        title: 'Access Restricted',
        description: 'Fans can only participate in Public discussion rooms. Upgrade to Creator Pro for private room access.',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/discussion-rooms/${room.id}`);
  };


  const handleRoomCreated = (newRoom: Room) => {
    setRooms(prevRooms => [newRoom, ...prevRooms]);
    navigate(`/discussion-rooms/${newRoom.id}`);
  };

  const handleRoomUpdated = (roomId: string, newTitle: string, newDescription: string) => {
    setRooms(prevRooms => prevRooms.map(r => r.id === roomId ? { ...r, title: newTitle, description: newDescription } : r));
  }

  const handleRoomDelete = (roomId: string) => {
    setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId));
    if (activeRoom?.id === roomId) {
      navigate('/discussion-rooms');
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

  // Loading state (initial load or resolving deep link)
  // If we have a roomId but haven't found the room yet (and strict loading is true or rooms empty), show loading.
  const isResolvingDeepLink = loading || (!!roomId && !activeRoom && rooms.length === 0);

  // JS-based screen size detection for conditional layout
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktopLayout(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (isResolvingDeepLink) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
        <div className="container mx-auto pt-16 pb-24">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <EnhancedSkeleton className="h-10 w-64" />
            <EnhancedSkeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // --- Instagram-style Desktop Layout (Only when a room is selected) ---
  if (isDesktopLayout && activeRoom) {
    return (
      <div className="h-screen w-full flex flex-col pt-16 bg-background overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {! (isInCall && !isCallMinimized) && (
            <div className="w-[350px] lg:w-[400px] border-r border-border flex flex-col bg-card/40 backdrop-blur-xl shrink-0 animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b border-border space-y-4">
              <div className="flex items-center justify-between">
                <Link to="/discussion-rooms" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <ArrowLeft size={18} />
                  <h2 className="text-xl font-black tracking-tight">Discussions</h2>
                </Link>
                {!isFan && (
                  <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                        <PlusCircle size={18} />
                      </Button>
                    </DialogTrigger>
                    <CreateRoomModal
                      categories={categories}
                      closeModal={() => setCreateModalOpen(false)}
                      onRoomCreated={handleRoomCreated}
                    />
                  </Dialog>
                )}
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-muted/50 border-none pl-9 h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="flex gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="flex-1 bg-muted/30 border-none h-8 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1 bg-muted/30 border-none h-8 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popularity">Popular</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
              {filteredAndSortedRooms
                .filter(room => !(isFan && room.room_type === 'private'))
                .map(room => {
                  const hasUnread = unreadDiscussionIds.includes(room.id);
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleRoomJoin(room)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl transition-all duration-300 group relative border border-transparent",
                        activeRoom?.id === room.id 
                          ? "bg-primary/10 border-primary/20 shadow-sm" 
                          : "hover:bg-muted/50 hover:border-border/30"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 pr-2 flex-1">
                          <h3 className={cn(
                            "font-bold text-sm truncate",
                            activeRoom?.id === room.id ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"
                          )}>
                            {room.title}
                          </h3>
                          {hasUnread && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {activeCallRoomIds.has(room.id) && (
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2 opacity-70">
                        {room.last_message 
                          ? `${room.last_message.sender_name}: ${getDisplayMessage(room.last_message.content)}` 
                          : (room.description || 'No messages yet...')}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                          <Users className="h-3 w-3" />
                           {room.member_count}
                        </div>
                        <Badge variant="secondary" className="bg-muted text-[9px] px-1.5 py-0 rounded-md border-0 h-4">
                          {room.room_categories?.name || 'General'}
                        </Badge>
                        {room.room_type === 'private' && (
                          <Lock className="h-2.5 w-2.5 text-amber-500" />
                        )}
                      </div>
                      {activeRoom?.id === room.id && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full" />
                      )}
                    </button>
                  );
                })}
              {filteredAndSortedRooms.length === 0 && (
                <div className="text-center py-12">
                   <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">No results found</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 bg-background flex flex-col overflow-hidden relative border-l border-border/10">
             <DiscussionChatInterface
              roomId={activeRoom.id}
              userRole={user?.id === activeRoom.creator_id ? 'creator' : 'member'}
              roomTitle={activeRoom.title}
              roomDescription={activeRoom.description}
              categoryId={activeRoom.category_id}
              categories={categories}
              roomType={activeRoom.room_type}
              onClose={() => navigate('/discussion-rooms')}
              onRoomUpdated={handleRoomUpdated}
              showBackButton={isInCall && !isCallMinimized}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Mobile/Tablet Fullscreen View (when active) ---
  if (activeRoom) {
    // Extra guard: fans cannot view private rooms they stumbled into via URL
    if (isFan && activeRoom.room_type === 'private') {
      return (
        <div className="fixed inset-x-0 top-14 md:top-16 bottom-[calc(env(safe-area-inset-bottom)+56px)] bg-background flex flex-col items-center justify-center z-40 gap-4">
          <div className="text-center max-w-sm px-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Private Room</h2>
            <p className="text-muted-foreground text-sm mb-6">This is a private discussion room. You need an explicit invitation from the creator to join.</p>
            <button onClick={() => navigate('/discussion-rooms')} className="text-primary text-sm font-medium hover:underline">← Back to all rooms</button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-x-0 top-14 md:top-16 bottom-[calc(env(safe-area-inset-bottom)+56px)] bg-background text-foreground flex flex-col z-40 lg:pb-0">
        <DiscussionChatInterface
          roomId={activeRoom.id}
          userRole={user?.id === activeRoom.creator_id ? 'creator' : 'member'}
          roomTitle={activeRoom.title}
          roomDescription={activeRoom.description}
          categoryId={activeRoom.category_id}
          categories={categories}
          roomType={activeRoom.room_type}
          onClose={() => {
            navigate('/discussion-rooms');
          }}
          onRoomUpdated={handleRoomUpdated}
        />
      </div>
    );
  }

  // --- Mobile List View ---
  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-36">
        {/* Header and Controls */}
        <PageHeader 
          title="Discussion Rooms" 
          subtitle="Connect and chat with film community in dedicated rooms" 
          Icon={DiscussionRoomIcon}
          actions={
            // Only creators can create rooms
            !isFan ? (
              <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                    <PlusCircle size={20} />
                    <span>Create Room</span>
                  </Button>
                </DialogTrigger>
                <CreateRoomModal
                  categories={categories}
                  closeModal={() => setCreateModalOpen(false)}
                  onRoomCreated={handleRoomCreated}
                />
              </Dialog>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 border border-border/30 text-sm text-muted-foreground">
                <span>🎬</span>
                <span>Viewing as <strong className="text-foreground">{fanAnonName}</strong></span>
              </div>
            )
          }
        />

        {/* Featured Rooms */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-primary">Featured Rooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {featuredRooms
              // Hide private rooms from fans in the featured section
              .filter(room => !(isFan && room.room_type === 'private'))
              .map(room => <RoomCard key={room.id} room={room} isActive={activeCallRoomIds.has(room.id)} onJoin={handleRoomJoin} onDelete={handleRoomDelete} onShare={(r) => { setRoomToShare(r); setIsShareSheetOpen(true); }} />)}
          </div>
        </section>

        {/* All Rooms Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-primary">All Rooms</h2>
          {/* Filtering and Sorting UI */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 sm:gap-4 mb-6 p-2 sm:p-4 bg-card border border-border rounded-lg">
            <div className="relative w-full sm:flex-grow sm:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-input border-border pl-9 h-9 sm:h-10 text-sm"
              />
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="flex-1 sm:w-[180px] bg-input border-border h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 sm:w-[180px] bg-input border-border h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedRooms
              // Hide private rooms from fans in the listing
              .filter(room => !(isFan && room.room_type === 'private'))
              .map(room => <RoomCard key={room.id} room={room} isActive={activeCallRoomIds.has(room.id)} onJoin={handleRoomJoin} onDelete={handleRoomDelete} onShare={(r) => { setRoomToShare(r); setIsShareSheetOpen(true); }} />)}
          </div>
          {filteredAndSortedRooms.length === 0 && !loading && (
            <div className="text-center col-span-full py-12">
              <p className="text-muted-foreground text-lg">No rooms found matching your criteria.</p>
            </div>
          )}
        </section>

        {/* Universal Share Sheet */}
        {roomToShare && (
           <UniversalShareSheet 
            isOpen={isShareSheetOpen}
            onOpenChange={setIsShareSheetOpen}
            shareType="room"
            shareId={roomToShare.id}
            shareData={{
              roomId: roomToShare.id,
              title: roomToShare.title,
              category: roomToShare.room_categories?.name,
              memberCount: roomToShare.member_count,
              roomType: roomToShare.room_type,
              isActive: activeCallRoomIds.has(roomToShare.id)
            }}
           />
        )}
      </div>
    </div>
  );
};

// --- ROOM CARD COMPONENT ---
const RoomCard = ({ room, onJoin, onDelete, onShare, isActive }: { room: Room; onJoin: (room: Room) => void; onDelete?: (roomId: string) => void; onShare?: (room: Room) => void; isActive?: boolean; }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadDiscussionIds } = useUnreadMessages();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const isOwner = user?.id === room.creator_id;
  const hasUnread = unreadDiscussionIds.includes(room.id);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('discussion_rooms')
        .delete()
        .eq('id', room.id);

      if (error) throw error;

      toast({ title: "Room deleted", description: "The discussion room has been deleted successfully." });
      onDelete(room.id);
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const categoryName = room.room_categories?.name || 'General';

  return (
    <div className="group h-full relative">
      <div className={cn(
        "glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2",
        hasUnread 
          ? "border-red-500/50 shadow-lg shadow-red-500/20" 
          : ""
      )}>

        {/* Top accent */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1 transition-opacity duration-500",
          hasUnread 
            ? "bg-gradient-to-r from-red-500 to-transparent opacity-100" 
            : "bg-gradient-to-r from-primary/60 via-primary/30 to-transparent opacity-0 group-hover:opacity-100"
        )} />

        {/* Unread Glow */}
        {hasUnread && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-2xl rounded-full -mr-12 -mt-12 animate-pulse" />
        )}

        <div className="p-5 flex flex-col flex-1">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 pr-2 flex-1">
              <h3 className={cn(
                "text-lg font-bold tracking-tight line-clamp-2 break-all duration-300",
                hasUnread ? "text-red-400" : "text-foreground group-hover:text-primary transition-colors"
              )}>
                {room.title}
              </h3>
              {hasUnread && (
                <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0" />
              )}
            </div>
            {isActive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                <Radio className="h-3 w-3" />
                ACTIVE
              </span>
            )}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 -mt-0.5">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem onClick={() => { /* Edit logic if needed */ }} className="cursor-pointer">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Room
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Room
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(room)} className="cursor-pointer">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!isOwner && (
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0 -mt-0.5"
                onClick={(e) => { e.stopPropagation(); onShare?.(room); }}
               >
                 <Share2 className="h-4 w-4" />
               </Button>
            )}
          </div>

          {/* Category & Time Row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge
              variant="secondary"
              className={cn(
                "transition-all uppercase text-[10px] tracking-widest font-bold px-2.5 py-0.5 rounded-md border-0",
                hasUnread ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              # {categoryName}
            </Badge>
            {room.room_type === 'private' && (
              <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap text-[10px] tracking-wider font-bold uppercase bg-amber-500/10 text-amber-400 border-0 rounded-md px-2.5 py-0.5">
                <Lock className="h-2.5 w-2.5" />
                Private
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 ml-auto">
              {timeAgo(room.created_at)}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed mb-4 flex-1">
            {room.description || 'No description available.'}
          </p>

          {/* Members/Notification Row */}
          <div className="flex items-center justify-between mt-auto mb-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <Users className="h-3 w-3 text-primary" />
              </div>
              <span className="font-medium">{room.member_count} {room.member_count === 1 ? 'member' : 'members'}</span>
            </div>
            {hasUnread && (
              <span className="text-[10px] font-black text-red-500 animate-pulse flex items-center gap-1">
                <Bell size={12} fill="currentColor" />
                NEW MESSAGE
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex gap-2">
              <Button
                className={cn(
                  "flex-1 font-semibold rounded-xl h-10 transition-all active:scale-[0.98]",
                  hasUnread 
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                )}
                onClick={() => onJoin(room)}
              >
                {hasUnread ? <Bell size={18} className="mr-2 animate-bounce" /> : <DiscussionRoomIcon size={22} className="mr-2" />}
                {hasUnread ? "View Messages" : "Join Discussion Room"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{room.title}"? This action cannot be undone and all messages will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
        <DialogDescription className="text-muted-foreground">
          Start a new topic or group for film professionals to connect.
        </DialogDescription>
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
