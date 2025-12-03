
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isYesterday } from 'date-fns';
import { Message, UserRole, Category, Call } from './types';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { ArrowLeft, Video, Settings, Users, Phone, Loader2, ChevronDown, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RoomMembers } from './RoomMembers';
import { RoomSettings } from './RoomSettings';
import { VideoCallManager } from './VideoCallManager';
import { useToast } from '@/hooks/use-toast';
import { PostShareCard } from '@/components/chat/PostShareCard';

interface DiscussionChatInterfaceProps {
  roomId: string;
  userRole: UserRole;
  roomTitle: string;
  roomDescription: string | null;
  categoryId: string;
  categories: Category[];
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
}

export const DiscussionChatInterface = ({ roomId, userRole, roomTitle, roomDescription, categoryId, categories, onClose, onRoomUpdated }: DiscussionChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);
  const [isMembersSidebarOpen, setMembersSidebarOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isJoiningCall, setIsJoiningCall] = useState(false);
  const [isCallTypeDialogOpen, setCallTypeDialogOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

      setMessages(data as any);
    } catch (err: any) {
      setError('Failed to fetch messages. Please try again later.');
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

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
          // Check if the new message is from the current user
          const isMyMessage = payload.new && (payload.new as any).user_id === user?.id;

          fetchMessages();

          if (isMyMessage) {
            // If it's my message, I've already handled the scroll in handleSendMessage, 
            // but doing it again here ensures sync.
            setTimeout(() => scrollToBottom(), 300);
          } else {
            // If it's someone else's message
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
        content,
        user_id: user.id,
        room_id: roomId
      });
      if (error) throw error;
      fetchMessages(); // Refresh messages immediately
      setTimeout(() => scrollToBottom(), 100); // Force scroll on send
      stopTyping(); // Stop typing indicator on send
    } catch (err) {
      console.error("Error sending message:", err);
      // Optionally, show an error to the user
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!user) return;
    setCallTypeDialogOpen(false);
    setIsJoiningCall(true);
    try {
      const { data, error } = await (supabase.rpc as any)('start_call', {
        room_id: roomId,
        created_by: user.id,
        call_type: type
      });

      if (error) throw error;
      const newCall = await fetchCall((data as any).id);
      if (newCall) setActiveCall(newCall);

    } catch (error: any) {
      toast({ title: "Error Starting Call", description: error.message, variant: "destructive" });
    } finally {
      setIsJoiningCall(false);
    }
  };

  const fetchCall = async (callId: string): Promise<Call | null> => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
      if (error) throw error;
      return data as unknown as Call;
    } catch (error) {
      console.error("Failed to fetch call details", error);
      toast({ title: "Error", description: "Could not fetch call details.", variant: "destructive" });
      return null;
    }
  }


  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'P');
  };

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>;
  }

  if (activeCall && user) {
    return <VideoCallManager roomId={roomId} userId={user.id} />
  }

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden relative">
      <header className="flex items-center justify-between gap-4 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg truncate text-foreground">{roomTitle}</h2>
            <p className="text-sm text-muted-foreground truncate">{roomDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCallTypeDialogOpen(true)} disabled={isJoiningCall}>
            {isJoiningCall ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMembersSidebarOpen(true)}><Users className="w-5 h-5" /></Button>
          <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
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

      <div className="flex flex-1 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 flex flex-col overflow-y-auto p-4 pr-4 custom-scrollbar"
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
              return (
                <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={`/profile/${message.profiles.id}`}>
                          <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                            <AvatarImage src={message.profiles.avatar_url || undefined} />
                            <AvatarFallback>{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side={isSender ? 'right' : 'left'}>
                        <p>{message.profiles.username}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className={`${message.content.startsWith('POST_SHARE::') ? 'p-0 bg-transparent' : `p-3 rounded-2xl ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} max-w-sm md:max-w-md lg:max-w-lg relative group`}>
                    {message.content.startsWith('POST_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                          return <PostShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
                        }
                      })()
                    ) : (
                      <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(message.created_at)}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Unread Messages Indicator */}
        {!isAtBottom && unreadCount > 0 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <Button
              onClick={() => scrollToBottom()}
              className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              size="sm"
            >
              <ChevronDown className="h-4 w-4" />
              {unreadCount} New Message{unreadCount > 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div>

      <div className="p-4 border-t border-border/50 bg-background">
        <TypingIndicator typingUsers={typingUsers} />
        <MessageComposer
          onSend={handleSendMessage}
          onTyping={startTyping}
          onStopTyping={stopTyping}
          userRole={userRole}
        />
      </div>

      <Dialog open={isCallTypeDialogOpen} onOpenChange={setCallTypeDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Start a Call</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex justify-around">
            <Button variant="outline" size="lg" onClick={() => startCall('audio')} className="flex flex-col h-24 w-24">
              <Phone className="h-8 w-8 mb-2" />
              Audio Call
            </Button>
            <Button variant="outline" size="lg" onClick={() => startCall('video')} className="flex flex-col h-24 w-24">
              <Video className="h-8 w-8 mb-2" />
              Video Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};
