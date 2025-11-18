
import { useState, useEffect, useRef, useCallback } from 'react';
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
import { ArrowLeft, Video, Settings, Users, Phone, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RoomMembers } from './RoomMembers';
import { RoomSettings } from './RoomSettings';
import { VideoCallManager } from './VideoCallManager';
import { useToast } from '@/hooks/use-toast';

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

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
          fetchMessages();
          setTimeout(() => scrollToBottom(), 300);
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages]);

  const handleSendMessage = async (content: string) => {
    if (!user || !roomId) return;

    try {
      const { error } = await supabase.from('room_messages').insert({ 
        content, 
        user_id: user.id, 
        room_id: roomId, 
        priority: 'normal',
        visibility_role: 'everyone' 
      });
      if (error) throw error;
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
      const { data, error } = await supabase.rpc('start_call', { 
        room_id: roomId, 
        created_by: user.id, 
        call_type: type 
      });

      if (error) throw error;
      const newCall = await fetchCall(data.id);
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
        return data as Call;
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
        <header className="flex items-center justify-between gap-4 p-3 border-b border-gray-700 bg-gray-800 z-10">
            <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h2 className="font-bold text-lg">{roomTitle}</h2>
                    <p className="text-sm text-gray-400">{roomDescription}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={() => setCallTypeDialogOpen(true)} disabled={isJoiningCall}>
                    {isJoiningCall ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="w-5 h-5"/>}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setMembersSidebarOpen(true)}><Users className="w-5 h-5"/></Button>
                 <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Settings className="w-5 h-5"/></Button>
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

        <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto p-4 pr-4 custom-scrollbar">
                {messages.map((message) => {
                  const isSender = message.profiles.id === user?.id;
                  return (
                    <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-8 w-8 cursor-pointer">
                              <AvatarImage src={message.profiles.avatar_url} />
                              <AvatarFallback>{message.profiles.username?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side={isSender ? 'right' : 'left'}>
                            <p>{message.profiles.username}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className={`p-3 rounded-2xl max-w-sm md:max-w-md lg:max-w-lg relative group ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(message.created_at)}</span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
            </div>
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
    </div>
  );
};
