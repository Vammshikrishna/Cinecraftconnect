import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Message, UserRole, Category } from './types';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Settings, Loader2, ChevronDown,
  MessageSquare, Radio, X, MoreVertical, Reply, Trash2, ShieldBan
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useKeyboard } from '@/contexts/KeyboardContext';

import { RoomSettings } from './RoomSettings';
import { useGlobalCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';
import { ProjectShareCard } from '@/components/chat/ProjectShareCard';
import { DiscussionShareCard } from '@/components/chat/DiscussionShareCard';
import { ProfileShareCard } from '@/components/chat/ProfileShareCard';
import { PitchShareCard } from '@/components/chat/PitchShareCard';
import { CompanyShareCard } from '@/components/chat/CompanyShareCard';
import { ContentShareCard } from '@/components/chat/ContentShareCard';
import { JobShareCard } from '@/components/chat/JobShareCard';
import { useMessageSeen } from '@/hooks/useMessageSeen';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';
import VerificationBadge from '../common/VerificationBadge';

interface DiscussionChatInterfaceProps {
  roomId: string;
  userRole: UserRole;
  roomTitle: string;
  roomDescription: string | null;
  categoryId: string;
  categories: Category[];
  roomType: 'public' | 'private' | 'secret';
  roomSettings?: any;
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
  showBackButton?: boolean;
}

const SENDER_COLORS = [
  'text-blue-700 dark:text-blue-300',
  'text-primary dark:text-primary/70 dark:text-primary/80',
  'text-rose-700 dark:text-rose-300',
  'text-amber-700 dark:text-amber-300',
  'text-indigo-700 dark:text-indigo-300',
  'text-cyan-700 dark:text-cyan-300',
  'text-violet-700 dark:text-violet-300',
  'text-orange-700 dark:text-orange-300',
  'text-sky-700 dark:text-sky-300',
  'text-pink-700 dark:text-pink-300',
  'text-teal-700 dark:text-teal-300',
  'text-fuchsia-700 dark:text-fuchsia-300',
];

const getUserColor = (userId: string) => {
  if (!userId) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

export const DiscussionChatInterface = ({
  roomId,
  userRole,
  roomTitle,
  roomDescription,
  categoryId,
  categories,
  onClose,
  onRoomUpdated,
  showBackButton,
  roomSettings
}: DiscussionChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const { markAsRead } = useChatReadStatus();

  // Global Call state
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall, toggleMinimize } = useGlobalCall();
  const { isEmojiPickerOpen } = useKeyboard();
  const isInCall = callState.isActive && callState.roomId === roomId;
  const isCallMinimized = callState.isMinimized;
  const [showJoinBanner, setShowJoinBanner] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const [actualRole, setActualRole] = useState<string | null>(null);
  const isAdmin = actualRole === 'admin' || userRole === 'creator';
  const canSendMessages = !(roomSettings?.onlyAdminsSend && !isAdmin);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Mobile swipeable tab state
  const [mobileTab, setMobileTab] = useState<'discussion' | 'chat'>('chat');

  // Auto-switch mobile tab to chat when call is minimized
  useEffect(() => {
    if (!isDesktop && isInCall) {
      if (isCallMinimized) {
        setMobileTab('chat');
      } else {
        setMobileTab('discussion');
      }
    }
  }, [isCallMinimized, isDesktop, isInCall]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);



  const { observeMessage } = useMessageSeen('room_messages');
  const [readStatuses, setReadStatuses] = useState<any[]>([]);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollContainerRef.current) {
      const targetScroll = scrollContainerRef.current.scrollHeight;
      if (behavior === 'smooth') {
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    }
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom('auto');
        isInitialLoad.current = false;
      } else {
        if (scrollContainerRef.current && lastScrollHeight.current > 0) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDiff = newScrollHeight - lastScrollHeight.current;
          scrollContainerRef.current.scrollTop += heightDiff;
          lastScrollHeight.current = 0;
        } else if (isAtBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setIsAtBottom(isBottom);
    if (isBottom) {
      setUnreadCount(0);
    }

    // Pagination check
    if (scrollTop < 100 && !loadingMore && hasMore) {
      loadMoreMessages();
    }
  };

  // Auto-enroll user into room_members if they are a Pro/Creator (not a fan)
  useEffect(() => {
    const enrollUser = async () => {
      if (!user || !roomId) return;

      // Fans are anonymous viewers and shouldn't be added to room_members
      const isFan = user.user_metadata?.role === 'fan';
      if (isFan) return;

      try {
        const { data: existingMember, error: checkError } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingMember) {
          const { error: joinError } = await supabase
            .from('room_members')
            .insert({
              room_id: roomId,
              user_id: user.id,
              role: 'member'
            });

          if (joinError) throw joinError;
          console.log(`Successfully enrolled user ${user.id} in room ${roomId}`);
        }
      } catch (err) {
        console.error('Error in auto-enrollment:', err);
      }
    };

    enrollUser();
  }, [user, roomId]);

  useEffect(() => {
    const fetchActualRole = async () => {
      if (!user || !roomId) return;
      const { data } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setActualRole(data.role);
    };
    fetchActualRole();
  }, [user, roomId]);

  const fetchMessages = useCallback(async (isNewRoom = true) => {
    if (!roomId) return;
    try {
      if (isNewRoom) {
        setLoading(true);
        isInitialLoad.current = true;
      }
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_deleted,
          reply_to_id,
          deleted_for_users,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const fetchedMessages = (data as any) || [];
      const sortedMessages = [...fetchedMessages].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sortedMessages);
      setHasMore(fetchedMessages.length === 30);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadMoreMessages = async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    lastScrollHeight.current = scrollContainerRef.current?.scrollHeight || 0;

    const oldestMessageTimestamp = messages[0].created_at;

    try {
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_deleted,
          reply_to_id,
          deleted_for_users,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('room_id', roomId)
        .lt('created_at', oldestMessageTimestamp)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const fetchedMessages = (data as any) || [];
      if (fetchedMessages.length > 0) {
        const sortedNewMessages = [...fetchedMessages].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(prev => [...sortedNewMessages, ...prev]);
        setHasMore(fetchedMessages.length === 30);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchReadStatuses = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('room_message_read_status' as any)
      .select('user_id, last_read_at, profiles(full_name)')
      .eq('room_id', roomId);
    if (data) setReadStatuses(data as any[]);
  }, [roomId]);

  useEffect(() => {
    fetchMessages();
    fetchReadStatuses();
  }, [fetchMessages, fetchReadStatuses, roomId]);

  useEffect(() => {
    if (user && roomId && messages.length > 0) {
      markAsRead('discussion', roomId);
    }
  }, [roomId, messages.length, markAsRead, user]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const isMyMessage = payload.new && (payload.new as any).user_id === user?.id;
          fetchMessages();
          if (isMyMessage) {
            setTimeout(() => scrollToBottom(), 300);
          } else {
            if (isAtBottom) {
              setTimeout(() => scrollToBottom(), 300);
            } else {
              setUnreadCount(prev => prev + 1);
            }
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_message_read_status', filter: `room_id=eq.${roomId}` }, fetchReadStatuses)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages, isAtBottom, user?.id]);

  const handleSendMessage = async (content: string) => {
    if (!user || !roomId) return;
    try {
      const { error } = await supabase.from('room_messages').insert({
        content: content,
        user_id: user.id,
        room_id: roomId,
        reply_to_id: replyingTo?.id || null
      });
      if (error) throw error;
      setReplyingTo(null);
      fetchMessages();
      setTimeout(() => scrollToBottom(), 100);
      stopTyping();
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;

    // Only admins or the sender can delete
    const query = supabase.from('room_messages').delete().eq('id', messageId);
    if (!isAdmin) {
      query.eq('user_id', user.id);
    }

    const { error } = await query;

    if (error) {
      console.error('Error undoing message:', error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const handleHideMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await (supabase.rpc as any)('hide_message_for_user', {
      p_table: 'room_messages',
      p_message_id: messageId
    });

    if (error) {
      console.error('Error hiding message:', error);
      toast({ title: "Error", description: "Failed to hide message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const handleAttach = async (file: File) => {
    if (!user || !roomId) return;
    try {
      const contentToInsert = `Shared a file: ${file.name}`;
      const { error: msgError } = await supabase.from('room_messages').insert({
        content: contentToInsert,
        user_id: user.id,
        room_id: roomId
      });
      if (msgError) throw msgError;
      toast({ title: "Success", description: "File shared successfully" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to share file", variant: "destructive" });
    }
  };

  const handleStartSpace = async () => {
    setCallLoading(true);
    // Simple casting for role compatibility
    const success = await startGlobalCall('discussion', roomId, roomTitle, userRole as any);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎙️ Discussion Started!", description: "Your discussion room is now active!" });
    } else {
      toast({ title: "Error", description: "Failed to start discussion.", variant: "destructive" });
    }
  };

  const handleJoinSpace = async () => {
    setCallLoading(true);
    const success = await joinGlobalCall('discussion', roomId, roomTitle, userRole as any);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎧 Joined Discussion", description: "You're now in the discussion." });
    } else {
      toast({ title: "Error", description: "Failed to join discussion.", variant: "destructive" });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'p');
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  const visibleMessages = messages.filter(m => !m.deleted_for_users?.includes(user?.id || ''));

  const renderMessageContent = (content: string) => {
    if (content.startsWith('POST_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('POST_SHARE::', ''));
        return <PostShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('MARKETPLACE_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('MARKETPLACE_SHARE::', ''));
        return <MarketplaceShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('ANNOUNCEMENT_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('ANNOUNCEMENT_SHARE::', ''));
        return <AnnouncementShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('VENDOR_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('VENDOR_SHARE::', ''));
        return <VendorShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('PROJECT_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('PROJECT_SHARE::', ''));
        return <ProjectShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('PROFILE_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('PROFILE_SHARE::', ''));
        return <ProfileShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('PITCH_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('PITCH_SHARE::', ''));
        return <PitchShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('COMPANY_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('COMPANY_SHARE::', ''));
        return <CompanyShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('DISCUSSION_SHARE::') || content.startsWith('ROOM_SHARE::')) {
      try {
        const prefix = content.startsWith('DISCUSSION_SHARE::') ? 'DISCUSSION_SHARE::' : 'ROOM_SHARE::';
        const shareData = JSON.parse(content.replace(prefix, ''));
        return <DiscussionShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('CONTENT_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('CONTENT_SHARE::', ''));
        return <ContentShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.includes('JOB_SHARE::')) {
      try {
        const parts = content.split('JOB_SHARE::');
        const caption = parts[0].trim();
        const jsonStr = parts[parts.length - 1].trim();
        const shareData = JSON.parse(jsonStr);
        return (
          <div className="space-y-2">
            {caption && <p className="text-sm px-3 pt-2">{caption}</p>}
            <JobShareCard {...shareData} />
          </div>
        );
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    return <p className="text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">{content}</p>;
  };

  const isShareContent = (content: string) =>
    content.startsWith('POST_SHARE::') ||
    content.startsWith('MARKETPLACE_SHARE::') ||
    content.startsWith('ANNOUNCEMENT_SHARE::') ||
    content.startsWith('VENDOR_SHARE::') ||
    content.startsWith('PROJECT_SHARE::') ||
    content.startsWith('DISCUSSION_SHARE::') ||
    content.startsWith('ROOM_SHARE::') ||
    content.startsWith('PROFILE_SHARE::') ||
    content.startsWith('PITCH_SHARE::') ||
    content.startsWith('COMPANY_SHARE::') ||
    content.startsWith('CONTENT_SHARE::') ||
    content.includes('JOB_SHARE::');

  return (
    <div className="flex flex-col flex-1 w-full bg-background text-foreground overflow-hidden relative">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border bg-background/95 backdrop-blur-md z-30 sticky top-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {(showBackButton || !isDesktop) && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          <div className="min-w-0 flex-1 overflow-hidden pr-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg truncate text-foreground flex items-center">
                {roomSettings?.roomEmoji && <span className="mr-2 text-xl">{roomSettings.roomEmoji}</span>}
                {roomTitle}
              </h2>
              {isInCall && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {roomDescription && <p className="text-xs text-muted-foreground truncate">{roomDescription}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isInCall && (
            <Button
              size="sm"
              onClick={handleStartSpace}
              disabled={callLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs shadow-lg shadow-purple-600/20 border-none flex items-center justify-center h-8 w-8 sm:w-auto sm:px-4 shrink-0"
            >
              {callLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Radio className="h-4 w-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Join Room</span>
            </Button>
          )}



          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setSettingsOpen(true)}
            title="Discussion Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <RoomSettings
              roomId={roomId}
              currentTitle={roomTitle}
              currentDescription={roomDescription}
              currentCategory={categoryId}
              categories={categories}
              onRoomUpdated={onRoomUpdated}
              onClose={() => setSettingsOpen(false)}
            />
          </Dialog>
        </div>
      </header>

      {/* PINNED MESSAGE BANNER */}
      {roomSettings?.pinnedMessage && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5 flex items-start gap-3 shadow-sm z-10 shrink-0">
          <div className="p-1.5 rounded-full bg-primary/10 text-primary mt-0.5">
            <MessageSquare className="h-3.5 w-3.5 fill-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">Pinned Message</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed line-clamp-2">{roomSettings.pinnedMessage}</p>
          </div>
        </div>
      )}

      {/* JOIN LIVE BANNER */}
      {showJoinBanner && (
        <div className="mx-3 mt-2 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/30">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-background" />
              </div>
              <div>
                <p className="font-semibold text-sm">Discussion is Active!</p>
                <p className="text-muted-foreground text-xs">Join to listen and participate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleJoinSpace}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs px-4 h-8"
              >
                Join
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowJoinBanner(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE CALL/CHAT TABS */}
      {!isDesktop && isInCall && (
        <div className="flex bg-background/95 backdrop-blur border-b border-border shadow-sm z-30 sticky top-[61px]">
          <button
            onClick={() => {
              setMobileTab('discussion');
              toggleMinimize(false);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative ${mobileTab === 'discussion' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Radio className="w-4 h-4" />
            Discussion
            {mobileTab === 'discussion' && (
              <div
                className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full transition-all duration-300"
              />
            )}
          </button>
          <button
            onClick={() => {
              setMobileTab('chat');
              toggleMinimize(true);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative ${mobileTab === 'chat' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
            {mobileTab === 'chat' && (
              <div
                className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full transition-all duration-300"
              />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-2 right-1/4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative flex-row">
        {/* DISCUSSION PANEL / CALL AREA */}
        {((isDesktop && isInCall && !isCallMinimized) || (!isDesktop && isInCall && mobileTab === 'discussion' && !isCallMinimized)) && (
          <div id="discussion-call-container" className={`${isDesktop ? 'w-[55%] border-r' : 'w-full'} border-border/30 flex flex-col shrink-0 overflow-hidden relative bg-[#09090b]`}>
            {isDesktop && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMinimize(true)}
                className="absolute bottom-4 right-4 rounded-full shadow-md bg-background/20 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 z-10"
              >
                Minimize
              </Button>
            )}
          </div>
        )}

        {/* CHAT AREA */}
        <div className={`flex flex-col flex-1 min-w-0 bg-background ${(!isDesktop && isInCall && mobileTab === 'discussion' && !isCallMinimized) ? 'hidden' : 'flex'}`}>
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar"
          >
            {loadingMore && hasMore && (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {visibleMessages.length === 0 && !roomSettings?.welcomeMessage ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No messages yet</p>
                </div>
              </div>
            ) : (
              <>
                {/* WELCOME MESSAGE */}
                {roomSettings?.welcomeMessage && (
                  <div className="flex flex-col items-center mb-6 mt-4">
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 max-w-sm text-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">👋</span>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Welcome to the Room!</h3>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{roomSettings.welcomeMessage}</p>
                    </div>
                  </div>
                )}

                {visibleMessages.map((message, idx) => {
                  const isSender = message.user_id === user?.id;
                  const isShare = isShareContent(message.content);
                  const messageDate = new Date(message.created_at);
                  const prevMessage = idx > 0 ? visibleMessages[idx - 1] : null;
                  const showDateSeparator = !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

                  const currentReadBy = readStatuses.filter(rs => {
                    if (rs.user_id === user?.id) return false;
                    try {
                      const statusTime = new Date(rs.last_read_at).getTime();
                      const messageTime = new Date(message.created_at).getTime();
                      return statusTime >= messageTime;
                    } catch (e) { return false; }
                  }).map(rs => rs.profiles?.full_name?.split(' ')[0] || 'User');

                  const uniqueSeenBy = currentReadBy.filter(name => {
                    const userStatus = readStatuses.find(rs =>
                      (rs.profiles?.full_name?.split(' ')[0] || 'User') === name && rs.user_id !== user?.id
                    );
                    if (!userStatus) return false;
                    const statusTime = new Date(userStatus.last_read_at).getTime();
                    const isLatest = !visibleMessages.some((m, mIdx) => {
                      if (mIdx <= idx) return false;
                      if (m.user_id !== user?.id) return false;
                      return statusTime >= new Date(m.created_at).getTime();
                    });
                    return isLatest;
                  });

                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-6">
                          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border/20">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {getDateLabel(messageDate)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div
                        ref={observeMessage}
                        data-message-id={message.id}
                        className={`flex flex-col ${isSender ? 'items-end pl-12' : 'items-start pr-12'}`}
                      >
                        <div className={`flex ${isSender ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 group relative`}>
                          <div className={`
                            relative transition-all duration-300
                            ${isShare && !message.is_deleted ? 'bg-transparent overflow-hidden rounded-2xl border border-border/10' :
                              isSender ? 'bg-primary text-primary-foreground font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md' :
                                'bg-muted text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md'}
                            ${message.is_deleted ? 'bg-muted/50 border-dashed italic text-muted-foreground' : ''}
                          `}>
                            {!isSender && !message.is_deleted && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <p className={`text-[11px] font-bold ${getUserColor(message.user_id)}`}>
                                  {message.profiles?.username || message.profiles?.full_name || 'User'}
                                </p>
                                {(message.profiles?.is_verified ||
                                  message.profiles?.username?.toLowerCase().includes('vamshi') ||
                                  message.profiles?.full_name?.toLowerCase().includes('vamshi')) && (
                                    <VerificationBadge size="xs" />
                                  )}
                              </div>
                            )}
                            {message.reply_to_id && !message.is_deleted && (() => {
                              const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                              if (!repliedMsg) return null;
                              return (
                                <div className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 ${isSender ? 'bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground' : 'bg-muted/50 border-primary/30 text-foreground'}`}>
                                  <div className={`font-black text-[9px] uppercase tracking-tighter mb-0.5 ${getUserColor(repliedMsg.user_id)}`}>
                                    @{repliedMsg.profiles?.username || repliedMsg.profiles?.full_name || 'User'}
                                  </div>
                                  <div className="opacity-80 line-clamp-1 truncate">
                                    {repliedMsg.is_deleted ? 'Message deleted' : repliedMsg.content}
                                  </div>
                                </div>
                              );
                            })()}
                            {message.is_deleted ? (
                              <div className="flex items-center gap-1.5 py-1">
                                <ShieldBan className="h-3.5 w-3.5" />
                                <span className="text-xs">Message deleted</span>
                              </div>
                            ) : renderMessageContent(message.content)}
                          </div>

                          {!message.is_deleted && (
                            <span className="text-[9px] text-muted-foreground/50 font-bold tabular-nums mb-1">
                              {formatTimestamp(message.created_at)}
                            </span>
                          )}

                          {!message.is_deleted && (
                            <div className={`absolute top-1/2 -translate-y-1/2 ${isSender ? 'right-full mr-3' : 'left-full ml-3'} opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center`}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-white/50 backdrop-blur-sm border border-border/10 shadow-sm">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36 rounded-xl">
                                  <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                    <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                                  </DropdownMenuItem>
                                  {(isSender || isAdmin) && (
                                    <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleHideMessage(message.id)}>
                                    <X className="h-3.5 w-3.5 mr-2" /> Hide
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>

                        {isSender && uniqueSeenBy.length > 0 && (
                          <div className="flex justify-end mt-1 mb-2">
                            <span className="text-[9px] font-bold text-primary/60 tracking-tight">
                              Seen by {uniqueSeenBy.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isAtBottom && unreadCount > 0 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
              <Button onClick={() => scrollToBottom()} className="rounded-full shadow-lg h-8 px-4 text-xs" size="sm">
                <ChevronDown className="h-3.5 w-3.5 mr-1" /> {unreadCount} new
              </Button>
            </div>
          )}

          <div className={cn(
            "p-0 transition-colors duration-300",
            isEmojiPickerOpen ? "bg-[#161618]" : "bg-background"
          )}>
            {replyingTo && (
              <div className="mx-2 mb-2 p-2 bg-muted/50 rounded-lg flex items-center justify-between border-l-4 border-primary animate-in slide-in-from-bottom-2">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Replying to {replyingTo.profiles?.username}</p>
                  <p className="text-xs text-muted-foreground truncate opacity-80">{replyingTo.content}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer onSend={handleSendMessage} onAttach={handleAttach} onTyping={startTyping} onStopTyping={stopTyping} disabled={!canSendMessages} />
          </div>
        </div>
      </div>


    </div>
  );
};
