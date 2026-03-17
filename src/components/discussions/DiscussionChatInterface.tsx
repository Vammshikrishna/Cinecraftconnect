
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
import {
  ArrowLeft, Settings, Users, Loader2, ChevronDown,
  MessageSquare, Radio, Headphones, X
} from 'lucide-react';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { RoomMembers } from './RoomMembers';
import { RoomSettings } from './RoomSettings';
import { EmbeddedCallPanel } from './EmbeddedCallPanel';
import { useCall } from '@/hooks/useCall';
import { useToast } from '@/hooks/use-toast';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';

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

  // Call state
  const { activeCall, loading: callLoading, startCall, joinCall, endCall } = useCall('discussion', roomId);
  const [isInCall, setIsInCall] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [showJoinBanner, setShowJoinBanner] = useState(false);

  // Mobile swipeable tab state
  const [mobileTab, setMobileTab] = useState<'discussion' | 'chat'>('discussion');
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // JS-based screen size detection (prevents mounting two EmbeddedCallPanels)
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

  // Show join banner when there's an active call and user hasn't joined
  useEffect(() => {
    if (activeCall && !isInCall) {
      setShowJoinBanner(true);
    } else {
      setShowJoinBanner(false);
    }
  }, [activeCall, isInCall]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setIsAtBottom(true);
    setUnreadCount(0);
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
    const timer = setTimeout(() => scrollToBottom('auto'), 500);
    return () => clearTimeout(timer);
  }, [fetchMessages]);

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
        room_id: roomId
      });
      if (error) throw error;
      fetchMessages();
      setTimeout(() => scrollToBottom(), 100);
      stopTyping();
    } catch (err) {
      console.error("Error sending message:", err);
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
    const call = await startCall();
    if (call) {
      setIsInCall(true);
      setIsCallMinimized(false);
      toast({ title: "🎙️ Discussion Started!", description: "Your discussion room is now active!" });
    } else {
      toast({ title: "Error", description: "Failed to start discussion.", variant: "destructive" });
    }
  };

  const handleJoinSpace = async () => {
    const success = await joinCall();
    if (success) {
      setIsInCall(true);
      setIsCallMinimized(false);
      setShowJoinBanner(false);
      toast({ title: "🎧 Joined Discussion", description: "You're now in the discussion." });
    } else {
      toast({ title: "Error", description: "Failed to join discussion.", variant: "destructive" });
    }
  };

  const handleLeaveSpace = async () => {
    await endCall();
    setIsInCall(false);
    setIsCallMinimized(false);
    toast({ title: "Left Discussion", description: "You've left the discussion." });
  };

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
    return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>;
  };

  const isShareContent = (content: string) =>
    content.startsWith('POST_SHARE::') ||
    content.startsWith('MARKETPLACE_SHARE::') ||
    content.startsWith('ANNOUNCEMENT_SHARE::') ||
    content.startsWith('VENDOR_SHARE::');

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
              {activeCall && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{roomDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Go Live button (no active call & not in call) */}
          {!activeCall && !isInCall && (
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
          <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="w-4 h-4" /></Button>
            </DialogTrigger>
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
        {/* Left: Call Panel */}
        {isInCall && activeCall && (
          <div className="w-[55%] flex flex-col border-r border-border/30 shrink-0 overflow-hidden">
            <EmbeddedCallPanel
              roomId={roomId}
              roomName={roomTitle}
              onLeave={handleLeaveSpace}
              isMinimized={isCallMinimized}
              onToggleMinimize={() => setIsCallMinimized(!isCallMinimized)}
            />
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
              messages.map((message) => {
                const isSender = message.profiles.id === user?.id;
                const isShare = isShareContent(message.content);
                return (
                  <div key={message.id} className={`flex items-end gap-2 my-3 ${isSender ? 'flex-row-reverse' : ''}`}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to={`/profile/${message.profiles.id}`}>
                            <Avatar className="h-7 w-7 cursor-pointer hover:opacity-80 transition-opacity shrink-0">
                              <AvatarImage src={message.profiles.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                            </Avatar>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side={isSender ? 'right' : 'left'}>
                          <p>{message.profiles.username}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className={`${isShare ? 'p-0 bg-transparent' : `p-2.5 rounded-2xl text-sm ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} max-w-[85%] relative group`}>
                      {renderMessageContent(message.content)}
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

          <div className="p-3 border-t border-border/50 bg-background">
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer onSend={handleSendMessage} onAttach={handleAttach} onTyping={startTyping} onStopTyping={stopTyping} userRole={userRole} />
          </div>
        </div>

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div> : <div className="flex flex-col flex-1 overflow-hidden relative">

        {/* Mobile Tab Bar (only when in call) */}
        {isInCall && activeCall && (
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
            if (touchStartX.current === null || touchStartY.current === null || !isInCall || !activeCall) return;
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
          {/* Discussion View (when in call and tab=discussion) */}
          {isInCall && activeCall && mobileTab === 'discussion' && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <EmbeddedCallPanel
                roomId={roomId}
                roomName={roomTitle}
                onLeave={handleLeaveSpace}
                isMinimized={isCallMinimized}
                onToggleMinimize={() => setIsCallMinimized(!isCallMinimized)}
              />
            </div>
          )}

          {/* Chat View (always shown when no call, or when tab=chat during call) */}
          {(!isInCall || !activeCall || mobileTab === 'chat') && (
            <div className="absolute inset-0 flex flex-col">
              <div
                ref={!isInCall || mobileTab === 'chat' ? scrollContainerRef : undefined}
                onScroll={handleScroll}
                className="flex-1 flex flex-col overflow-y-auto p-3 custom-scrollbar"
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
                      <div key={message.id} className={`flex items-end gap-2 my-2 ${isSender ? 'flex-row-reverse' : ''}`}>
                        <Link to={`/profile/${message.profiles.id}`}>
                          <Avatar className="h-6 w-6 cursor-pointer hover:opacity-80 transition-opacity shrink-0">
                            <AvatarImage src={message.profiles.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className={`${isShare ? 'p-0 bg-transparent' : `p-2 rounded-2xl text-sm ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} max-w-[80%] relative group`}>
                          {renderMessageContent(message.content)}
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">{formatTimestamp(message.created_at)}</span>
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

              <div className="p-2 border-t border-border/50 bg-background pb-14">
                <TypingIndicator typingUsers={typingUsers} />
                <MessageComposer onSend={handleSendMessage} onAttach={handleAttach} onTyping={startTyping} onStopTyping={stopTyping} userRole={userRole} />
              </div>
            </div>
          )}
        </div>

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div>}
    </div>
  );
};
