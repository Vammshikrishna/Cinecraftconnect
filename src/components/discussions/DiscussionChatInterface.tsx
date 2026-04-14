
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isYesterday } from 'date-fns';
import { Message, UserRole, Category } from './types';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Settings, Users, Loader2, ChevronDown,
  MessageSquare, Radio, Headphones, X, MoreVertical, Reply, Trash2, ShieldBan, Maximize2
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { RoomMembers } from './RoomMembers';
import { RoomSettings } from './RoomSettings';
import { useGlobalCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';
import { ProjectShareCard } from '@/components/chat/ProjectShareCard';
import { DiscussionShareCard } from '@/components/chat/DiscussionShareCard';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';


interface DiscussionChatInterfaceProps {
  roomId: string;
  userRole: UserRole;
  roomTitle: string;
  roomDescription: string | null;
  categoryId: string;
  categories: Category[];
  roomType: 'public' | 'private' | 'secret';
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
}

export const DiscussionChatInterface = ({ roomId, userRole, roomTitle, roomDescription, categoryId, categories, onClose, onRoomUpdated }: DiscussionChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);
  const [isMembersSidebarOpen, setMembersSidebarOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Global Call state
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall, toggleMinimize } = useGlobalCall();
  const isInCall = callState.isActive && callState.roomId === roomId;
  const isCallMinimized = callState.isMinimized;
  const [showJoinBanner, setShowJoinBanner] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  // Mobile swipeable tab state
  const [mobileTab, setMobileTab] = useState<'discussion' | 'chat'>('discussion');

  // Auto-switch mobile tab to chat when call is minimized
  useEffect(() => {
    if (isCallMinimized && mobileTab === 'discussion') {
      setMobileTab('chat');
    }
  }, [isCallMinimized, mobileTab]);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { markAsRead } = useChatReadStatus();

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  // JS-based screen size detection
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Show join banner when there's an active call and user hasn't joined (mocking activeCall check via a separate mechanism if needed, but for now using the fact that we can see active calls in the room list)
  // Instead of a local activeCall, we can rely on the parent room data or a separate subscription if really needed, 
  // but let's keep it simple: if the global call is for THIS room, we are in it.
  useEffect(() => {
    // If there is a global call for this room but user isn't 'joined' in their local UI state, 
    // we should show banner. But since we just moved to global, 'isInCall' means they ARE joined.
    // We'll trust the room isActive badge for "There is a call here".
  }, [callState, roomId]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setIsAtBottom(true);
    setUnreadCount(0);
    // Mark as read when explicitly scrolling to bottom
    if (roomId) markAsRead('discussion', roomId);
  };


  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setIsAtBottom(isBottom);
    if (isBottom) {
      setUnreadCount(0);
    }
  };

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
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
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as any) || []);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Auto-join room membership
  useEffect(() => {
    if (!roomId || !user) return;

    const ensureMembership = async () => {
      try {
        const { data: existing } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from('room_members')
            .insert({ room_id: roomId, user_id: user.id });

          if (error && !error.message?.includes('duplicate')) {
            console.error('Failed to auto-join room:', error);
          }
        }
      } catch (err) {
        console.error('Error ensuring room membership:', err);
      }
    };

    ensureMembership();
  }, [roomId, user]);

  useEffect(() => {
    fetchMessages();
    const timer = setTimeout(() => {
      scrollToBottom('auto');
      if (roomId) markAsRead('discussion', roomId);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchMessages, markAsRead, roomId]);


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
    const { error } = await supabase
      .from('room_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error undoing message:', error);
      toast({ title: "Error", description: "Failed to undo message", variant: "destructive" });
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
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    }
  };

  // --- Call Handlers ---
  const handleStartSpace = async () => {
    setCallLoading(true);
    const success = await startGlobalCall('discussion', roomId, roomTitle, userRole);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎙️ Discussion Started!", description: "Your discussion room is now active!" });
    } else {
      toast({ title: "Error", description: "Failed to start discussion.", variant: "destructive" });
    }
  };

  const handleJoinSpace = async () => {
    setCallLoading(true);
    const success = await joinGlobalCall('discussion', roomId, roomTitle, userRole);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎧 Joined Discussion", description: "You're now in the discussion." });
    } else {
      toast({ title: "Error", description: "Failed to join discussion.", variant: "destructive" });
    }
  };

  // Navigation logic to ensure the call PERSISTS instead of dying
  useEffect(() => {
    // We specifically REMOVED the "leave on unmount" logic here.
    // The call will continue in the GlobalCallOverlay even if we navigate away.
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'P');
  };

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  // --- Render Share Card ---
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
    if (content.startsWith('DISCUSSION_SHARE::') || content.startsWith('ROOM_SHARE::')) {
      try {
        const prefix = content.startsWith('DISCUSSION_SHARE::') ? 'DISCUSSION_SHARE::' : 'ROOM_SHARE::';
        const shareData = JSON.parse(content.replace(prefix, ''));
        return <DiscussionShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>;
  };

  const isShareContent = (content: string) =>
    content.startsWith('POST_SHARE::') ||
    content.startsWith('MARKETPLACE_SHARE::') ||
    content.startsWith('ANNOUNCEMENT_SHARE::') ||
    content.startsWith('VENDOR_SHARE::') ||
    content.startsWith('PROJECT_SHARE::') ||
    content.startsWith('DISCUSSION_SHARE::') ||
    content.startsWith('ROOM_SHARE::');

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden relative">

      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between gap-4 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="min-w-0 flex-1 overflow-hidden pr-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg truncate text-foreground">{roomTitle}</h2>
              {isInCall && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  YOU ARE LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{roomDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Go Live button (not in call) */}
          {!isInCall && (
            <Button
              size="sm"
              onClick={handleStartSpace}
              disabled={callLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs shadow-lg shadow-purple-600/20 border-none flex items-center justify-center h-8 w-8 sm:w-auto sm:px-4 shrink-0"
              title="Join Discussion"
            >
              {callLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Radio className="h-4 w-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Join Discussion</span>
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={() => setMembersSidebarOpen(true)} className="h-8 w-8">
            <Users className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-sm">
              <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" /> Discussion Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      {/* ===== JOIN LIVE BANNER (when call is active but user not joined) ===== */}
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
                <p className="text-foreground font-semibold text-sm">Discussion is Active!</p>
                <p className="text-muted-foreground text-xs">Join to listen and participate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleJoinSpace}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs px-4 h-8 shadow-lg shadow-purple-600/20 border-none"
              >
                <Headphones className="w-3.5 h-3.5 mr-1.5" />
                Join Discussion
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowJoinBanner(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT AREA ===== */}

      {/* ====== DESKTOP (md+): Side by Side ====== */}
      {isDesktop ? <div className="flex flex-1 overflow-hidden relative flex-row">
        {/* Left: Call Panel Placeholder when using Global Overlay */}
        {isInCall && !isCallMinimized && (
          <div id="discussion-call-container" className="w-full md:w-[55%] flex flex-col border-r border-border/30 shrink-0 overflow-hidden items-center justify-center relative bg-[#121214]">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Radio className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Discussion Active</h3>
              <p className="text-gray-400 text-sm mb-6">You are connected to the live session.</p>
              <Button
                variant="outline"
                onClick={() => toggleMinimize(true)}
                className="rounded-full border-white/20 hover:bg-white/10"
              >
                Switch to Picture-in-Picture
              </Button>
            </div>
          </div>
        )}

        {/* Right: Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 flex flex-col overflow-y-auto p-4 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No messages yet</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Start the conversation!</p>
                </div>
              </div>
            ) : (
              messages.filter(m => !m.deleted_for_users?.includes(user?.id || '')).map((message) => {
                const isSender = message.profiles.id === user?.id;
                const isShare = isShareContent(message.content);
                return (
                  <div key={message.id} className={`flex items-end gap-2 my-3 group ${isSender ? 'flex-row-reverse' : ''}`}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to={`/profile/${message.profiles.id}`}>
                            <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity shrink-0 shadow-sm border border-border/10">
                              <AvatarImage src={message.profiles.avatar_url || undefined} />
                              <AvatarFallback className="text-sm font-bold bg-secondary text-secondary-foreground">{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                            </Avatar>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side={isSender ? 'right' : 'left'}>
                          <p>{message.profiles.username}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-end gap-2 relative max-w-[85%]">
                      <div className={`${isShare && !message.is_deleted ? 'p-0 bg-transparent' : `p-2.5 rounded-2xl text-sm ${message.is_deleted ? 'bg-muted/50 border border-border/50' : isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} relative`}>
                        {message.reply_to_id && !message.is_deleted && (() => {
                          const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                          if (!repliedMsg) return null;
                          return (
                            <div className={`mb-2 p-2 rounded-lg text-xs border ${isSender ? 'bg-white/10 border-white/20 text-white' : 'bg-background/50 border-border'}`}>
                              <div className="font-semibold text-[10px] mb-0.5 opacity-75">
                                {repliedMsg.profiles?.username || 'User'}
                              </div>
                              <div className="opacity-90 line-clamp-1 text-[11px]">
                                {repliedMsg.is_deleted ? <em>This message was deleted</em> : (
                                  repliedMsg.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                                    repliedMsg.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                                      repliedMsg.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                                        repliedMsg.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                                          repliedMsg.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                                            repliedMsg.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                                              repliedMsg.content.startsWith('ROOM_SHARE::') ? 'Shared a room' :
                                                repliedMsg.content
                                )}
                              </div>
                            </div>
                          )
                        })()}
                        {message.is_deleted ? (
                          <p className="text-xs italic flex items-center gap-1 opacity-70">
                            <ShieldBan className="h-3 w-3" /> This message was deleted
                          </p>
                        ) : (
                          renderMessageContent(message.content)
                        )}
                      </div>

                      {!message.is_deleted && (
                        <div className={`absolute ${isSender ? 'right-full mr-1' : 'left-full ml-1'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-full">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36">
                              <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                <Reply className="h-4 w-4 mr-2" /> Reply
                              </DropdownMenuItem>
                              {isSender && (
                                <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                  <Trash2 className="h-4 w-4 mr-2" /> Undo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleHideMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                <X className="h-4 w-4 mr-2" /> Delete for Me
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTimestamp(message.created_at)}</span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isAtBottom && unreadCount > 0 && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20">
              <Button onClick={() => scrollToBottom()} className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs" size="sm">
                <ChevronDown className="h-3.5 w-3.5" /> {unreadCount} new
              </Button>
            </div>
          )}

          <div className="lg:pb-4 pb-[calc(56px+env(safe-area-inset-bottom))] border-t border-border bg-background flex flex-col">
            {replyingTo && (
              <div className="bg-muted px-3 py-1.5 mb-2 rounded-md flex items-center justify-between border border-border text-xs">
                <div className="flex-1 overflow-hidden pr-2">
                  <div className="font-semibold text-primary mb-0.5 text-[10px] uppercase tracking-wider">
                    Replying to {replyingTo.profiles?.username || 'User'}
                  </div>
                  <div className="text-muted-foreground truncate opacity-80">
                    {replyingTo.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                      replyingTo.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                        replyingTo.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                          replyingTo.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                            replyingTo.content}
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded hover:bg-background text-muted-foreground transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer onSend={handleSendMessage} onAttach={handleAttach} onTyping={startTyping} onStopTyping={stopTyping} userRole={userRole} />
          </div>
        </div>

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div> : <div className="flex flex-col flex-1 overflow-hidden relative">

        {/* Mobile Tab Bar (only when in call) */}
        {isInCall && (
          <div className="flex items-center bg-background border-b border-border shrink-0">
            <button
              onClick={() => setMobileTab('discussion')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative ${mobileTab === 'discussion' ? 'text-foreground' : 'text-muted-foreground'
                }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Discussion
              {mobileTab === 'discussion' && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors relative ${mobileTab === 'chat' ? 'text-foreground' : 'text-muted-foreground'
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
              {unreadCount > 0 && mobileTab !== 'chat' && (
                <span className="w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
              {mobileTab === 'chat' && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>
        )}

        {/* Swipeable Content Container */}
        <div
          className="flex-1 overflow-hidden relative"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || touchStartY.current === null || !isInCall) return;
            const deltaX = e.changedTouches[0].clientX - touchStartX.current;
            const deltaY = e.changedTouches[0].clientY - touchStartY.current;
            // Only swipe horizontally if it's more horizontal than vertical
            if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX < 0 && mobileTab === 'discussion') setMobileTab('chat');
              if (deltaX > 0 && mobileTab === 'chat') setMobileTab('discussion');
            }
            touchStartX.current = null;
            touchStartY.current = null;
          }}
        >
          {/* Discussion View (when in call) */}
          {isInCall && (
            <div className={`absolute inset-x-0 top-0 bottom-0 flex flex-col overflow-hidden transition-all duration-300 ${mobileTab === 'discussion' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
              <div id="discussion-call-container" className="flex-1 flex flex-col items-center justify-center space-y-4 p-6 text-center relative bg-[#121214]">
                 {isCallMinimized ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121214] z-10 p-6 shadow-inner">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                        <Radio className="w-8 h-8 text-primary opacity-50" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Call is Minimized</h3>
                      <p className="text-muted-foreground text-sm max-w-[260px] mb-8">
                        Your video call is currently active in picture-in-picture mode.
                      </p>
                      <div className="flex flex-col gap-3 w-full max-w-[200px]">
                        <Button onClick={() => toggleMinimize(false)} className="rounded-full w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg">
                          <Maximize2 className="w-4 h-4 mr-2" /> Maximize
                        </Button>
                        <Button variant="outline" onClick={() => setMobileTab('chat')} className="rounded-full w-full border-white/10 hover:bg-white/5 text-white">
                          <MessageSquare className="w-4 h-4 mr-2" /> Open Chat
                        </Button>
                      </div>
                    </div>
                 ) : (
                    <>
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Radio className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Call is Active</h3>
                      <p className="text-muted-foreground text-sm max-w-[240px] mb-6">
                        You are connected to the live session in the persistent overlay.
                      </p>
                      <Button variant="outline" onClick={() => setMobileTab('chat')} className="rounded-full border-white/20 hover:bg-white/10 text-white shadow-lg">
                        <MessageSquare className="w-4 h-4 mr-2" /> Open Chat
                      </Button>
                    </>
                 )}
              </div>
            </div>
          )}

          {/* Chat View - Always shown when tab=chat during call or when no call */}
          <div className={`absolute inset-x-0 top-0 bottom-0 flex flex-col transition-all duration-300 ${(!isInCall || mobileTab === 'chat') ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
            <div
              ref={!isInCall || mobileTab === 'chat' ? scrollContainerRef : undefined}
              onScroll={handleScroll}
              className="flex-1 flex flex-col overflow-y-auto p-3 pt-2 custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No messages yet</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isSender = message.profiles.id === user?.id;
                  const isShare = isShareContent(message.content);
                  return (
                    <div key={message.id} className={`flex items-end gap-2 my-2 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSender ? 'flex-row-reverse' : ''}`}>
                      <Link to={`/profile/${message.profiles.id}`}>
                        <Avatar className="h-9 w-9 cursor-pointer hover:scale-110 active:scale-95 transition-all shrink-0 shadow-sm border border-border/10">
                          <AvatarImage src={message.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-sm font-bold bg-secondary text-secondary-foreground">{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex items-end gap-2 relative max-w-[85%]">
                        <div className={`${isShare && !message.is_deleted ? 'p-0 bg-transparent' : `p-2.5 rounded-2xl text-sm shadow-sm ${message.is_deleted ? 'bg-muted/50 border border-border/50 text-muted-foreground' : isSender ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`} relative cursor-default transition-all hover:shadow-md`}>
                          {message.reply_to_id && !message.is_deleted && (() => {
                            const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                            if (!repliedMsg) return null;
                            return (
                              <div className={`mb-2 p-2 rounded-lg text-xs border ${isSender ? 'bg-white/10 border-white/20 text-white' : 'bg-background/50 border-border'}`}>
                                <div className="font-semibold text-[10px] mb-0.5 opacity-75">
                                  {repliedMsg.profiles?.username || 'User'}
                                </div>
                                <div className="opacity-90 line-clamp-1 text-[11px]">
                                  {repliedMsg.is_deleted ? <em>This message was deleted</em> : (
                                    repliedMsg.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                                      repliedMsg.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                                        repliedMsg.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                                          repliedMsg.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                                            repliedMsg.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                                              repliedMsg.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                                                repliedMsg.content
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                          {message.is_deleted ? (
                            <p className="text-xs italic flex items-center gap-1 opacity-70">
                              <ShieldBan className="h-3 w-3" /> This message was deleted
                            </p>
                          ) : (
                            renderMessageContent(message.content)
                          )}
                        </div>

                        {!message.is_deleted && (
                          <div className={`absolute ${isSender ? 'right-full mr-1' : 'left-full ml-1'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-full">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36">
                                <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                  <Reply className="h-4 w-4 mr-2" /> Reply
                                </DropdownMenuItem>
                                {isSender && (
                                  <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                    <Trash2 className="h-4 w-4 mr-2" /> Undo
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground/50 shrink-0 font-medium">{formatTimestamp(message.created_at)}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isAtBottom && unreadCount > 0 && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-20">
                <Button onClick={() => scrollToBottom()} className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs" size="sm">
                  <ChevronDown className="h-3.5 w-3.5" /> {unreadCount} new
                </Button>
              </div>
            )}

            <div className="border-t border-border flex flex-col bg-background pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-2 sticky bottom-0 z-30">
              {replyingTo && (
                <div className="bg-muted px-3 py-1.5 mb-2 rounded-md flex items-center justify-between border border-border text-xs">
                  <div className="flex-1 overflow-hidden pr-2">
                    <div className="font-semibold text-primary mb-0.5 text-[10px] uppercase tracking-wider">
                      Replying to {replyingTo.profiles?.username || 'User'}
                    </div>
                    <div className="text-muted-foreground truncate opacity-80">
                      {replyingTo.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                        replyingTo.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                          replyingTo.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                            replyingTo.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                              replyingTo.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                                replyingTo.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                                  replyingTo.content}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded hover:bg-background text-muted-foreground transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <TypingIndicator typingUsers={typingUsers} />
              <MessageComposer onSend={handleSendMessage} onAttach={handleAttach} onTyping={startTyping} onStopTyping={stopTyping} userRole={userRole} />
            </div>
          </div>
        </div>

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div>}
    </div>
  );
};
