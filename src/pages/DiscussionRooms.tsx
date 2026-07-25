import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Search, PlusCircle, Lock, Globe, MoreVertical, Edit, Trash2, Radio, Share2, Bell, Flag, ArrowLeft } from 'lucide-react';
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
import { useAppRole } from '@/hooks/useAppRole';
import { BackButton } from '@/components/common/BackButton';
import { ReportDialog } from '@/components/governance/ReportDialog';
import SEO from '@/components/common/SEO';
import VerificationBadge from '@/components/common/VerificationBadge';
import { SpaceEscalationPanel } from '@/components/governance/SpaceEscalationPanel';
import { useE2EEChatKeys } from '@/hooks/useE2EEChatKeys';
import { decryptWithPrivateKey, importSymmetricKey, decryptGroupMessage, generateGroupKey, exportSymmetricKey, importPublicKey, encryptWithPublicKey } from '@/lib/e2ee';
import { syncGroupKeyToNative } from '@/lib/e2ee-bridge';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';

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
  last_message?: {
    content: string;
    created_at: string;
    sender_name?: string;
    sender_username?: string;
    is_verified?: boolean;
  } | null;
  // This is a client-side addition
  tags?: string[];
  settings?: any;
}

// In-memory profile cache for sidebar previews to make updates instant
const sidebarProfileCache = new Map<string, { full_name: string | null, username: string | null, is_verified: boolean }>();

// --- MAIN PAGE COMPONENT ---
const DiscussionRoomsPage = ({ openCreate = false }: { openCreate?: boolean }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCallRoomIds, setActiveCallRoomIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { roomId } = useParams<{ roomId: string }>();
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isInternal, loading: roleLoading } = useAppRole();

  const { privateKey } = useE2EEChatKeys();
  const [groupKeys, setGroupKeys] = useState<Record<string, CryptoKey>>({});
  const [decryptedLastMessages, setDecryptedLastMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || !privateKey) return;

    const fetchAndDecryptGroupKeys = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('group_keys')
          .select('target_id, encrypted_symmetric_key')
          .eq('target_type', 'room')
          .eq('user_id', user.id);

        if (error) {
          console.error("Error fetching group keys for list:", error);
          return;
        }

        if (data) {
          const keysMap: Record<string, CryptoKey> = {};
          for (const row of (data as any[])) {
            try {
              const rawSymmetricKeyBase64 = await decryptWithPrivateKey(row.encrypted_symmetric_key, privateKey);
              const loadedSymmetricKey = await importSymmetricKey(rawSymmetricKeyBase64);
              keysMap[row.target_id] = loadedSymmetricKey;
            } catch (decErr) {
              console.error(`Failed to decrypt group key for target ${row.target_id} (user keys may have been reset):`, decErr);
              // Self-healing: Delete mismatched key row from DB so it can be re-provisioned cleanly
              supabase
                .from('group_keys' as any)
                .delete()
                .eq('target_type', 'room')
                .eq('target_id', row.target_id)
                .eq('user_id', user.id)
                .then(({ error: delErr }) => {
                  if (!delErr) {
                    console.log(`[DiscussionRooms] Cleaned up mismatched group key for room: ${row.target_id}`);
                  }
                });
            }
          }
          setGroupKeys(keysMap);
        }
      } catch (err) {
        console.error("Failed to load and decrypt group keys for list:", err);
      }
    };

    fetchAndDecryptGroupKeys();
  }, [user?.id, privateKey]);

  useEffect(() => {
    let mounted = true;
    const decryptAll = async () => {
      const newDecrypted: Record<string, string> = {};
      for (const room of rooms) {
        const lastMsg = room.last_message;
        if (lastMsg && lastMsg.content) {
          if (lastMsg.content.includes('__e2ee_group')) {
            const symKey = groupKeys[room.id];
            if (symKey) {
              try {
                const dec = await decryptGroupMessage(lastMsg.content, symKey);
                newDecrypted[room.id] = dec;
              } catch (err) {
                console.error(`Failed to decrypt room last msg ${room.id}:`, err);
                newDecrypted[room.id] = '🔒 Encrypted Message';
              }
            } else {
              newDecrypted[room.id] = '🔒 Encrypted Message';
            }
          } else {
            newDecrypted[room.id] = lastMsg.content;
          }
        }
      }
      if (mounted) {
        setDecryptedLastMessages(newDecrypted);
      }
    };
    decryptAll();
    return () => {
      mounted = false;
    };
  }, [rooms, groupKeys]);

  const [deepLinkRoom, setDeepLinkRoom] = useState<any | null>(null);
  const [loadingDeepLinkRoom, setLoadingDeepLinkRoom] = useState<boolean>(false);

  useEffect(() => {
    if (!roomId) {
      setDeepLinkRoom(null);
      return;
    }

    const found = rooms.find(r => r.id === roomId);
    if (found) {
      setDeepLinkRoom(null);
      return;
    }

    const fetchSpecificRoom = async () => {
      setLoadingDeepLinkRoom(true);
      try {
        const { data, error } = await supabase
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
            settings
          `)
          .eq('id', roomId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setDeepLinkRoom({
            ...data,
            member_count: data.member_count || 0,
            room_type: data.room_type as 'public' | 'private' | 'secret',
            category_id: data.category_id || '',
            creator_id: data.creator_id || '',
            tags: data.tags || [],
            settings: data.settings || {}
          });
        }
      } catch (err) {
        console.error('Error fetching deep-link room:', err);
      } finally {
        setLoadingDeepLinkRoom(false);
      }
    };

    fetchSpecificRoom();
  }, [roomId, rooms]);

  // Use URL as the source of truth for the selected room
  const activeRoom = useMemo(() => {
    if (!roomId) return null;
    const found = rooms.find(r => r.id === roomId);
    return found || deepLinkRoom || null;
  }, [roomId, rooms, deepLinkRoom]);

  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(false);
  const verifiedRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const verifyRoomAccess = async () => {
      if (roleLoading) return;

      if (!user) {
        setHasAccess(activeRoom ? activeRoom.room_type === 'public' : false);
        setCheckingAccess(false);
        verifiedRoomIdRef.current = null;
        return;
      }

      if (!activeRoom) {
        setHasAccess(true);
        setCheckingAccess(false);
        verifiedRoomIdRef.current = null;
        return;
      }

      if (activeRoom.room_type === 'public') {
        setHasAccess(true);
        setCheckingAccess(false);
        verifiedRoomIdRef.current = activeRoom.id;
        return;
      }

      // Only show full loading spinner if we haven't already verified this room ID
      if (verifiedRoomIdRef.current !== activeRoom.id) {
        setCheckingAccess(true);
      }
      try {
        // Internal staff ALWAYS require an active grant for private/secret rooms.
        // Membership is intentionally ignored — governance accounts should never
        // bypass the break-glass flow by being a regular room member.
        if (isInternal) {
          const { data: grantData } = await (supabase as any)
            .from('space_access_grants')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'room')
            .eq('target_id', activeRoom.id)
            .gt('expires_at', new Date().toISOString())
            .limit(1);

          setHasAccess(grantData && grantData.length > 0);
          verifiedRoomIdRef.current = activeRoom.id;
          return;
        }

        // For regular users: check membership
        const { data: memberData } = await supabase
          .from('room_members')
          .select('role')
          .eq('room_id', activeRoom.id)
          .eq('user_id', user.id)
          .maybeSingle();

        const isRoomMember = !!memberData || activeRoom.creator_id === user.id;
        setHasAccess(isRoomMember);
        
        // Save successfully verified room ID
        verifiedRoomIdRef.current = activeRoom.id;
      } catch (err) {
        console.error('Error verifying room access:', err);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    verifyRoomAccess();
  }, [user, activeRoom?.id, isInternal, roleLoading]);

  useEffect(() => {
    const handleAccessRevoked = (e: any) => {
      const { targetType, targetId } = e.detail;
      if (targetType === 'room' && targetId === activeRoom?.id) {
        setHasAccess(false);
        verifiedRoomIdRef.current = null; // Clear cache so re-entry triggers a fresh DB check
      }
    };

    window.addEventListener('space_access_revoked', handleAccessRevoked);
    return () => {
      window.removeEventListener('space_access_revoked', handleAccessRevoked);
    };
  }, [activeRoom]);

  const { callState } = useGlobalCall();
  const { unreadDiscussionIds } = useUnreadMessages();
  const { isKeyboardVisible, isEmojiPickerOpen } = useKeyboard();
  const isInCall = callState.isActive && callState.roomId === roomId;
  const isCallMinimized = callState.isMinimized;


  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [isCreateModalOpen, setCreateModalOpen] = useState(openCreate);
  const [roomToShare, setRoomToShare] = useState<Room | null>(null);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [reportData, setReportData] = useState<{ id: string, title: string } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (openCreate) setCreateModalOpen(true);
  }, [openCreate]);

  // Global blur when room changes to kill any background focus from navbar/sidebar
  useEffect(() => {
    if (roomId) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [roomId]);

  const { data: discussionData, isLoading: loading, refetch: fetchData } = useQuery({
    queryKey: ['discussion-rooms', user?.id],
    queryFn: async () => {
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
            settings,
            room_messages(content, created_at, profiles(id, full_name, username, is_verified))
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
          settings: room.settings || {},
          last_message: lastMsg ? {
            content: lastMsg.content,
            created_at: lastMsg.created_at,
            sender_name: lastMsg.profiles?.full_name || 'User',
            sender_username: lastMsg.profiles?.username,
            is_verified: lastMsg.profiles?.is_verified
          } : null
        };
      });

      // Fetch active calls for discussion rooms
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: activeCalls } = await supabase
        .from('calls' as any)
        .select('room_id')
        .eq('room_type', 'discussion')
        .eq('status', 'active')
        .gt('created_at', sixHoursAgo);

      return {
        rooms: formattedRooms,
        categories: (categoriesRes.data || []).map(c => ({ ...c, description: null, icon: null })),
        activeCallIds: (activeCalls || []).map((c: any) => c.room_id) as string[]
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Sync state with query data
  useEffect(() => {
    if (discussionData) {
      setRooms(prevRooms => {
        if (prevRooms.length === 0) return discussionData.rooms;

        return discussionData.rooms.map(fetchedRoom => {
          const prevRoom = prevRooms.find(r => r.id === fetchedRoom.id);
          if (prevRoom && prevRoom.last_message) {
            if (!fetchedRoom.last_message) {
              return {
                ...fetchedRoom,
                last_message: prevRoom.last_message
              };
            }
            const prevTime = new Date(prevRoom.last_message.created_at).getTime();
            const fetchedTime = new Date(fetchedRoom.last_message.created_at).getTime();
            if (prevTime > fetchedTime) {
              return {
                ...fetchedRoom,
                last_message: prevRoom.last_message
              };
            }
          }
          return fetchedRoom;
        });
      });
      setCategories(discussionData.categories);
      setActiveCallRoomIds(discussionData.activeCallIds);
    }
  }, [discussionData]);

  // Real-time listener
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['discussion-rooms'] });
      }, 3000);
    };

    const channel = supabase.channel('discussion-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_rooms' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_categories' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages' }, debouncedRefresh)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Handle instant window message updates for sidebar previews
  useEffect(() => {
    const handleWindowMessage = async (e: any) => {
      const newMsg = e.detail;
      if (!newMsg || !newMsg.room_id) return;

      // 1. Get cached profile or use default immediately
      const cachedProfile = sidebarProfileCache.get(newMsg.user_id);
      let senderName = cachedProfile?.full_name || 'User';
      let senderUsername = cachedProfile?.username || '';
      let isVerified = cachedProfile?.is_verified || false;

      // 2. Decrypt content if E2EE
      let decryptedContent = newMsg.content;
      if (newMsg.content && newMsg.content.includes('__e2ee_group')) {
        const symKey = groupKeys[newMsg.room_id];
        if (symKey) {
          try {
            decryptedContent = await decryptGroupMessage(newMsg.content, symKey);
          } catch (decErr) {
            console.error('Failed to decrypt instant room message preview:', decErr);
            decryptedContent = '🔒 Encrypted Message';
          }
        } else {
          decryptedContent = '🔒 Encrypted Message';
        }
      }

      const updateRoomsState = (name: string, username: string, verified: boolean) => {
        setRooms(prevRooms => {
          return prevRooms.map(room => {
            if (room.id === newMsg.room_id) {
              return {
                ...room,
                last_message: {
                  content: newMsg.content,
                  created_at: newMsg.created_at,
                  sender_name: name,
                  sender_username: username,
                  is_verified: verified
                }
              };
            }
            return room;
          });
        });

        setDecryptedLastMessages(prev => ({
          ...prev,
          [newMsg.room_id]: decryptedContent
        }));
      };

      // 3. Update UI instantly with cached/default profile info
      updateRoomsState(senderName, senderUsername, isVerified);

      // 4. Fetch profile asynchronously if not cached, then update UI
      if (!cachedProfile) {
        // Run in background without blocking the main event flow
        (async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, username, is_verified')
              .eq('id', newMsg.user_id)
              .single();
            if (profile) {
              const profileInfo = {
                full_name: profile.full_name || 'User',
                username: profile.username || '',
                is_verified: profile.is_verified || false
              };
              sidebarProfileCache.set(newMsg.user_id, profileInfo);
              updateRoomsState(profileInfo.full_name, profileInfo.username, profileInfo.is_verified);
            }
          } catch (err) {
            console.error('Error fetching profile for sidebar message update:', err);
          }
        })();
      }
    };

    window.addEventListener('room_message_received', handleWindowMessage);
    window.addEventListener('room_message_received_sidebar', handleWindowMessage);
    return () => {
      window.removeEventListener('room_message_received', handleWindowMessage);
      window.removeEventListener('room_message_received_sidebar', handleWindowMessage);
    };
  }, [groupKeys]);

  const handleRoomJoin = (room: Room) => {
    // Clear any existing focus to prevent keyboard from following us into the room
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Fans can only join PUBLIC rooms
    if (isFan && room.room_type !== 'public') {
      toast({
        title: 'Access Restricted',
        description: 'Fans can only participate in Public discussion rooms. Upgrade to Creator Pro for private room access.',
        variant: 'destructive',
      });
      return;
    }
    push(`/discussion-rooms/${room.id}`);
  };


  const handleRoomCreated = (newRoom: Room) => {
    // Clear any existing focus
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setRooms(prevRooms => [newRoom, ...prevRooms]);
    push(`/discussion-rooms/${newRoom.id}`);
  };

  const handleRoomUpdated = (roomId: string, newTitle: string, newDescription: string) => {
    setRooms(prevRooms => prevRooms.map(r => r.id === roomId ? { ...r, title: newTitle, description: newDescription } : r));
  }

  const handleRoomDelete = (roomId: string) => {
    setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId));
      push('/discussion-rooms', { noScroll: true });
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

  const isResolvingDeepLink = loading || loadingDeepLinkRoom || (!!roomId && (roleLoading || checkingAccess));

  // JS-based screen size detection for conditional layout
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktopLayout(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  if (isResolvingDeepLink || checkingAccess || roleLoading) {
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

  // Optimistically render chat UI to eliminate latency. 
  // the background check will flip hasAccess to false and boot them to the PrivateRoomAccessPanel.

  // The early return for SpaceEscalationPanel was removed from here.
  // It is now embedded directly inside the desktop and mobile layouts.

  // --- Instagram-style Desktop Layout (Only when a room is selected) ---
  if (isDesktopLayout && activeRoom) {
    return (
      <div className="h-screen w-full flex flex-col pt-16 bg-background overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {!(isInCall && !isCallMinimized) && (
            <div className="w-[350px] lg:w-[400px] border-r border-border flex flex-col bg-card/40 backdrop-blur-xl shrink-0 animate-in slide-in-from-left duration-300">
              <div className="p-6 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                  <BackButton label="DISCUSSIONS" to="/discussion-rooms" />
                  {!isFan && !isInternal && (
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

                <UnifiedSearchBar
                  className="mb-0 p-2 bg-muted/20 border-none rounded-xl"
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder="Search rooms..."
                  hasActiveFilters={filterCategory !== 'all' || sortBy !== 'popularity'}
                  filterTitle="Filter Rooms"
                  filterContent={
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Category</Label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Sort by</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="popularity">Popularity</SelectItem>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full text-xs" 
                        onClick={() => { setFilterCategory('all'); setSortBy('popularity'); }}
                      >
                        Clear Filters
                      </Button>
                    </>
                  }
                />
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
                              "font-bold text-sm truncate flex items-center",
                              activeRoom?.id === room.id ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"
                            )}>
                              {room.settings?.roomEmoji && <span className="mr-2 text-base shrink-0">{room.settings.roomEmoji}</span>}
                              <span className="truncate">{room.title}</span>
                            </h3>
                            {hasUnread && (
                              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {Array.isArray(activeCallRoomIds) && activeCallRoomIds.includes(room.id) && (
                              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                          <p className="text-xs text-muted-foreground line-clamp-1 opacity-70 flex items-center gap-1 min-w-0">
                            {room.last_message ? (
                              <>
                                <span className="font-bold shrink-0">{room.last_message.sender_name}</span>
                                {room.last_message.is_verified && (
                                    <VerificationBadge size="xs" className="scale-75" />
                                  )}
                                <span className="truncate">: {getDisplayMessage(decryptedLastMessages[room.id] || room.last_message.content)}</span>
                              </>
                            ) : (
                              <span className="truncate">{room.description || 'No messages yet...'}</span>
                            )}
                          </p>
                        </div>
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
            <div id="active-discussion-anchor" data-room-id={activeRoom.id} className="hidden" />
            {hasAccess ? (
              <DiscussionChatInterface
                key={activeRoom.id}
                roomId={activeRoom.id}
                userRole={user?.id === activeRoom.creator_id ? 'creator' : 'member'}
                roomTitle={activeRoom.title}
                roomDescription={activeRoom.description}
                categoryId={activeRoom.category_id}
                categories={categories}
                roomType={activeRoom.room_type}
                roomSettings={activeRoom.settings}
                onClose={() => {
                  push('/discussion-rooms', { noScroll: true });
                }}
                onRoomUpdated={handleRoomUpdated}
                showBackButton={isInCall && !isCallMinimized}
                initialGrantedAccess={isInternal && hasAccess}
              />
            ) : isInternal ? (
              <SpaceEscalationPanel
                targetType="room"
                targetId={activeRoom.id}
                chatTitle={activeRoom.title}
                onAccessGranted={() => setHasAccess(true)}
              />
            ) : (
              <PrivateRoomAccessPanel
                roomId={activeRoom.id}
                roomTitle={activeRoom.title}
                roomDescription={activeRoom.description}
                onClose={() => push('/discussion-rooms', { noScroll: true })}
              />
            )}
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
        <div className="fixed inset-x-0 top-14 md:top-16 bottom-[calc(env(safe-area-inset-bottom)+80px)] bg-background flex flex-col items-center justify-center z-40 gap-4">
          <div className="text-center max-w-sm px-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Private Room</h2>
            <p className="text-muted-foreground text-sm mb-6">This is a private discussion room. You need an explicit invitation from the creator to join.</p>
            <button onClick={() => push('/discussion-rooms', { noScroll: true })} className="text-primary text-sm font-medium hover:underline">← Back to all rooms</button>
          </div>
        </div>
      );
    }
    if (!hasAccess) {
      return (
        <div className={cn(
          "fixed inset-0 pt-[calc(env(safe-area-inset-top)+56px)] md:pt-16 bg-background overflow-hidden flex flex-col z-40 pb-[calc(env(safe-area-inset-bottom)+76px)]"
        )}>
          {isInternal ? (
            <SpaceEscalationPanel
              targetType="room"
              targetId={activeRoom.id}
              chatTitle={activeRoom.title}
              onAccessGranted={() => setHasAccess(true)}
            />
          ) : (
            <PrivateRoomAccessPanel
              roomId={activeRoom.id}
              roomTitle={activeRoom.title}
              roomDescription={activeRoom.description}
              onClose={() => push('/discussion-rooms', { noScroll: true })}
              showBackButton={true}
            />
          )}
        </div>
      );
    }

    return (
      <div className={cn(
        "fixed inset-0 pt-[calc(env(safe-area-inset-top)+56px)] md:pt-16 bg-background overflow-hidden flex flex-col z-40",
        (!isKeyboardVisible && !isEmojiPickerOpen) && "pb-[calc(env(safe-area-inset-bottom)+76px)]"
      )}>
        <div id="active-discussion-anchor" data-room-id={activeRoom.id} className="hidden" />
        <DiscussionChatInterface
          key={activeRoom.id}
          roomId={activeRoom.id}
          userRole={user?.id === activeRoom.creator_id ? 'creator' : 'member'}
          roomTitle={activeRoom.title}
          roomDescription={activeRoom.description}
          categoryId={activeRoom.category_id}
          categories={categories}
          roomType={activeRoom.room_type}
          roomSettings={activeRoom.settings}
          onClose={() => push('/discussion-rooms', { noScroll: true })}
          onRoomUpdated={handleRoomUpdated}
          initialGrantedAccess={isInternal && hasAccess}
        />
      </div>
    );
  }

  // --- Mobile List View ---
  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <SEO
        title="Discussion Hub"
        description="Join real-time conversations with film crews and creators. Discuss projects, share techniques, and network with industry professionals."
      />
      <div className="max-w-7xl mx-auto px-4 md:px-8 pb-36">
        {/* Header and Controls */}
        <PageHeader
          title="Discussion Rooms"
          subtitle="Connect and chat with film community in dedicated rooms"
          Icon={DiscussionRoomIcon}
          actionsAtTop={true}
          actions={
            // Only creators can create rooms
            !isFan && !isInternal ? (
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
            ) : isInternal ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 border border-border/30 text-sm text-muted-foreground font-bold uppercase tracking-widest">
                <span>👁️</span>
                <span>Observation Mode</span>
              </div>
            ) : null
          }
        />

        {/* Featured Rooms */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-primary">Featured Rooms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {featuredRooms
              // Hide private rooms from fans in the featured section
              .filter(room => !(isFan && room.room_type === 'private'))
              .map(room => <RoomCard key={room.id} room={room} isActive={Array.isArray(activeCallRoomIds) && activeCallRoomIds.includes(room.id)} onJoin={handleRoomJoin} onDelete={handleRoomDelete} onShare={(r) => { setRoomToShare(r); setIsShareSheetOpen(true); }} onReport={(r) => { setReportData({ id: r.id, title: r.title }); setIsReportOpen(true); }} />)}
          </div>
        </section>

        {/* All Rooms Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-primary">All Rooms</h2>
          {/* Filtering and Sorting UI */}
          {/* Filtering and Sorting UI */}
          <UnifiedSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search rooms..."
            hasActiveFilters={filterCategory !== 'all' || sortBy !== 'popularity'}
            filterTitle="Filter Rooms"
            filterContent={
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Sort by</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">Popularity</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full text-xs" 
                  onClick={() => { setFilterCategory('all'); setSortBy('popularity'); }}
                >
                  Clear Filters
                </Button>
              </>
            }
          />

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedRooms
              // Hide private rooms from fans in the listing
              .filter(room => !(isFan && room.room_type === 'private'))
              .map(room => <RoomCard key={room.id} room={room} isActive={Array.isArray(activeCallRoomIds) && activeCallRoomIds.includes(room.id)} onJoin={handleRoomJoin} onDelete={handleRoomDelete} onShare={(r) => { setRoomToShare(r); setIsShareSheetOpen(true); }} onReport={(r) => { setReportData({ id: r.id, title: r.title }); setIsReportOpen(true); }} />)}
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
              isActive: Array.isArray(activeCallRoomIds) && activeCallRoomIds.includes(roomToShare.id)
            }}
          />
        )}

        {/* Report Dialog */}
        {reportData && (
          <ReportDialog
            isOpen={isReportOpen}
            onOpenChange={setIsReportOpen}
            targetType="discussion"
            targetId={reportData.id}
            targetTitle={reportData.title}
          />
        )}
      </div>
    </div>
  );
};

// --- ROOM CARD COMPONENT ---
const RoomCard = ({ room, onJoin, onDelete, onShare, onReport, isActive }: { room: Room; onJoin: (room: Room) => void; onDelete?: (roomId: string) => void; onShare?: (room: Room) => void; onReport?: (room: Room) => void; isActive?: boolean; }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { unreadDiscussionIds } = useUnreadMessages();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const isOwner = user?.id === room.creator_id;
  // Even if they are platform admins, they should not manage rooms from the public UI
  const canManage = isOwner;
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
    <div
      className="group h-full relative cursor-pointer"
      onClick={() => onJoin(room)}
    >
      <div className={cn(
        "glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2 group-hover:border-primary/40",
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
                "font-serif text-2xl font-bold tracking-tight line-clamp-2 break-all duration-300 flex items-center",
                hasUnread ? "text-red-400" : "text-foreground group-hover:text-primary transition-colors"
              )}>
                {room.settings?.roomEmoji && <span className="mr-2 text-2xl shrink-0">{room.settings.roomEmoji}</span>}
                <span className="line-clamp-2">{room.title}</span>
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
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 -mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => { /* Edit logic if needed */ }} className="cursor-pointer">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Room
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setDeleteDialogOpen(true); }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Room
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(room)} className="cursor-pointer">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Room
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onReport?.(room)}
                    className="cursor-pointer text-amber-500 focus:text-amber-500"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!canManage && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0 -mt-0.5 relative z-10"
                  onClick={(e) => { e.stopPropagation(); onShare?.(room); }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0 -mt-0.5 relative z-10"
                  onClick={(e) => { e.stopPropagation(); onReport?.(room); }}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Category & Time Row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div
              className={cn(
                "font-mono transition-all uppercase text-[10px] tracking-widest font-bold px-2 py-1 rounded border border-primary/20",
                hasUnread ? "bg-red-500/10 text-red-400" : "bg-primary/5 text-primary"
              )}
            >
              CATEGORY // {categoryName}
            </div>
            {room.room_type === 'private' && (
              <div className="font-mono whitespace-nowrap text-[10px] tracking-widest font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-2 py-1">
                TYPE // PRIVATE
              </div>
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
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest bg-muted/10 border border-border/40 text-muted-foreground px-2 py-1 rounded">
              MEMBERS // {room.member_count}
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
                  "flex-1 font-semibold rounded-xl h-10 transition-all active:scale-[0.98] group-hover:scale-[1.02]",
                  hasUnread
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                )}
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

      // Silently provision E2EE keys for this new room so the user doesn't see "Initializing E2EE"
      try {
        const aesKey = await generateGroupKey();
        const rawAesKeyBase64 = await exportSymmetricKey(aesKey);
        
        const { data: profile } = await supabase.from('profiles').select('public_key').eq('id', user.id).single();
        
        if (profile?.public_key) {
          const importedPubKey = await importPublicKey(profile.public_key);
          const encryptedAesKey = await encryptWithPublicKey(rawAesKeyBase64, importedPubKey);
          
          await (supabase as any).from('group_keys').insert({
            target_type: 'room',
            target_id: newRoomId,
            user_id: user.id,
            encrypted_symmetric_key: encryptedAesKey
          });
          
          await syncGroupKeyToNative(newRoomId as string, rawAesKeyBase64);
          console.log("Silently provisioned E2EE group key for new Discussion Room");
        }
      } catch (e2eeError) {
        console.error("Failed silent E2EE provisioning:", e2eeError);
      }

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

// --- PRIVATE ROOM ACCESS PANEL ---
const PrivateRoomAccessPanel = ({
  roomId,
  roomTitle,
  roomDescription,
  onClose,
  showBackButton = false
}: {
  roomId: string;
  roomTitle: string;
  roomDescription: string | null;
  onClose: () => void;
  showBackButton?: boolean;
}) => {
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'loading'>('loading');
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { toast } = useToast();

  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!user) {
        setRequestStatus('none');
        return;
      }
      if (!roomId) return;
      try {
        const { data, error } = await supabase
          .from('room_join_requests')
          .select('status')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setRequestStatus('pending');
        } else {
          setRequestStatus('none');
        }
      } catch (err) {
        console.error('Error checking join request status:', err);
        setRequestStatus('none');
      }
    };
    checkRequestStatus();
  }, [user, roomId]);

  const handleRequestAccess = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Redirecting to sign in page...',
        variant: 'destructive'
      });
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!roomId) return;
    try {
      setRequestStatus('loading');
      const { error } = await supabase
        .from('room_join_requests')
        .insert({
          room_id: roomId,
          user_id: user.id,
          status: 'pending'
        });

      if (error) throw error;

      setRequestStatus('pending');
      toast({
        title: "Request Sent",
        description: "Your request to join this private room has been sent to the admin.",
      });
    } catch (err: any) {
      console.error('Error sending join request:', err);
      toast({
        title: "Request Failed",
        description: err.message,
        variant: "destructive",
      });
      setRequestStatus('none');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative select-none animate-in fade-in duration-300">
      {showBackButton && (
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 hover:bg-white/5 rounded-xl px-4 h-10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold text-xs uppercase tracking-wider">Back</span>
          </Button>
        </div>
      )}

      <div className="w-full max-w-md p-8 rounded-3xl glass-card-premium border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6">
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -ml-16 -mb-16" />

        {/* Animated Lock Icon */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 relative shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping duration-1000 opacity-60" />
          <Lock className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-foreground">Private Room</h2>
          <p className="text-sm font-bold text-primary uppercase tracking-widest">{roomTitle}</p>
        </div>

        {roomDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed px-2 bg-white/5 border border-white/5 rounded-2xl py-3 w-full">
            "{roomDescription}"
          </p>
        )}

        <div className="w-full pt-4 border-t border-border/40">
          {requestStatus === 'loading' ? (
            <Button disabled className="w-full h-12 rounded-xl flex items-center justify-center font-bold text-sm bg-primary/80">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking status...
            </Button>
          ) : requestStatus === 'pending' ? (
            <div className="space-y-3 w-full">
              <Button disabled className="w-full h-12 rounded-xl font-bold text-sm bg-muted text-muted-foreground border border-border/30 cursor-not-allowed">
                Request Pending
              </Button>
              <p className="text-[11px] text-muted-foreground font-semibold">
                Your request is awaiting admin approval. You will be notified once approved.
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              <Button
                onClick={handleRequestAccess}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all duration-300"
              >
                Request to Join
              </Button>
              <p className="text-[11px] text-muted-foreground">
                This room requires admin permission to join.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscussionRoomsPage;
