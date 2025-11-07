import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, Users, Video, Mic, MicOff, VideoOff, Phone } from 'lucide-react';
import { isUUID } from '@/utils/uuid';

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface EnhancedRealTimeChatProps {
  roomId: string;
  roomTitle: string;
}

const EnhancedRealTimeChat = ({ roomId, roomTitle }: EnhancedRealTimeChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch initial messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Send new message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to send messages",
          variant: "destructive",
        });
        return;
      }

      const messageContent = newMessage.trim();
      const { error: messageError } = await supabase
        .from('room_messages')
        .insert([
          {
            room_id: roomId,
            user_id: user.id,
            content: messageContent,
            message_type: 'text'
          }
        ]);

      if (messageError) throw messageError;
      setNewMessage('');

      let recipientId: string | undefined;
      const UUID_LENGTH = 36;

      // One-on-one chat room IDs are formed by concatenating two user UUIDs.
      const isPotentiallyOneOnOne = roomId.length === UUID_LENGTH * 2;

      if (isPotentiallyOneOnOne) {
        const id1 = roomId.substring(0, UUID_LENGTH);
        const id2 = roomId.substring(UUID_LENGTH);

        if (isUUID(id1) && isUUID(id2)) {
          if (user.id === id1) {
            recipientId = id2;
          } else if (user.id === id2) {
            recipientId = id1;
          }
        } else {
          console.warn('Invalid one-on-one chat roomId format:', roomId);
        }
      }

      if (recipientId) {
        const messagePreview = messageContent.length > 30
          ? `${messageContent.substring(0, 30)}...`
          : messageContent;
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: recipientId,
            type: 'new_message',
            message: `New message from ${user?.user_metadata?.full_name || 'a user'}: ${messagePreview}`,
            link: `/chat`,
          });

        if (notificationError) {
          console.error("Error creating notification:", notificationError);
        }
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Start video/audio call
  const startCall = () => {
    setIsInCall(true);
    setIsVideoOn(true);
    setIsAudioOn(true);
    toast({
      title: "Call Started",
      description: "Video call initiated for all room members",
    });
  };

  // End call
  const endCall = () => {
    setIsInCall(false);
    setIsVideoOn(false);
    setIsAudioOn(true);
    toast({
      title: "Call Ended",
      description: "Video call has been terminated",
    });
  };

  // Toggle video
  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };

  // Toggle audio
  const toggleAudio = () => {
    setIsAudioOn(!isAudioOn);
  };

  // Helper functions
  const getUserName = (message: Message) => {
    return message.profiles?.full_name || message.profiles?.username || 'Anonymous User';
  };

  const getUserInitials = (message: Message) => {
    const name = getUserName(message);
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  useEffect(() => {
    fetchMessages();

    // Set up real-time subscription for messages
    const messagesChannel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          // Fetch the new message with profile data
          const { data } = await supabase
            .from('room_messages')
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages(prev => [...prev, data as any]);
          }
        }
      )
      .subscribe();

    // Set up presence tracking for online users
    const presenceChannel = supabase
      .channel(`room-presence-${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat();
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe();

    // Track current user presence
    const trackPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await presenceChannel.track({
          user_id: user.id,
          room_id: roomId,
          online_at: new Date().toISOString(),
        });
      }
    };

    trackPresence();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-foreground">{roomTitle}</h3>
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {onlineUsers.length}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          {!isInCall ? (
            <Button
              onClick={startCall}
              size="sm"
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Video className="w-4 h-4 mr-1" />
              Start Call
            </Button>
          ) : (
            <div className="flex items-center space-x-1">
              <Button
                onClick={toggleAudio}
                size="sm"
                variant={isAudioOn ? "outline" : "destructive"}
              >
                {isAudioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
              <Button
                onClick={toggleVideo}
                size="sm"
                variant={isVideoOn ? "outline" : "destructive"}
              >
                {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>
              <Button
                onClick={endCall}
                size="sm"
                variant="destructive"
              >
                <Phone className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Video Call Area */}
      {isInCall && (
        <div className="p-4 bg-muted/20 border-b border-border">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Video className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isVideoOn ? 'Video call active' : 'Video is off'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex items-start space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={message.profiles?.avatar_url || ''} />
                  <AvatarFallback className="text-xs">
                    {getUserInitials(message)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {getUserName(message)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1"
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRealTimeChat;
