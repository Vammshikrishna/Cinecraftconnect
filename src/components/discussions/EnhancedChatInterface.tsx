import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { OnlinePresence } from './OnlinePresence';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, AlertTriangle, Lock } from 'lucide-react';

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: string;
  priority: string;
  visibility_role: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface EnhancedChatInterfaceProps {
  roomId: string;
  userRole: 'creator' | 'admin' | 'moderator' | 'member';
}

export const EnhancedChatInterface = ({ roomId, userRole }: EnhancedChatInterfaceProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);

  useEffect(() => {
    fetchMessages();
    fetchProfiles();

    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          
          // Fetch profile if we don't have it
          if (!profiles[newMessage.user_id]) {
            fetchProfile(newMessage.user_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    const userIds = [...new Set(messages.map(m => m.user_id))];
    if (userIds.length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (data) {
      const profileMap = data.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, Profile>);
      setProfiles(profileMap);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (data) {
      setProfiles(prev => ({ ...prev, [data.id]: data }));
    }
  };

  const handleSendMessage = async (content: string, priority: string, visibilityRole: string) => {
    if (!user) return;

    // Stop typing indicator when sending
    stopTyping();

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      room_id: roomId,
      user_id: user.id,
      content,
      message_type: 'text',
      priority,
      visibility_role: visibilityRole,
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);

    const { error } = await supabase.from('room_messages').insert({
      room_id: roomId,
      user_id: user.id,
      content,
      message_type: 'text',
      priority,
      visibility_role: visibilityRole,
    });

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      console.error('Error sending message:', error);
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5';
      case 'critical':
        return 'border-l-4 border-l-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/5 font-semibold';
      default:
        return '';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--accent))]" />;
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-[hsl(var(--destructive))]" />;
      default:
        return null;
    }
  };

  const getVisibilityBadge = (visibilityRole: string) => {
    if (visibilityRole === 'all') return null;
    
    return (
      <Badge variant="outline" className="ml-2 text-xs gap-1">
        <Lock className="h-3 w-3" />
        {visibilityRole}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Discussion</h3>
        <OnlinePresence roomId={roomId} />
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const profile = profiles[message.user_id];
            const isOwnMessage = message.user_id === user?.id;
            const isSystemMessage = message.message_type === 'system';

            if (isSystemMessage) {
              return (
                <div key={message.id} className="text-center">
                  <Badge variant="secondary" className="text-xs">
                    {message.content}
                  </Badge>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {profile?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {getVisibilityBadge(message.visibility_role)}
                  </div>

                  <Card className={`p-3 ${getPriorityStyles(message.priority)}`}>
                    <div className="flex items-start gap-2">
                      {getPriorityIcon(message.priority)}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <TypingIndicator typingUsers={typingUsers} />

      <div className="p-4">
        <MessageComposer
          onSend={handleSendMessage}
          userRole={userRole}
          onTyping={startTyping}
          onStopTyping={stopTyping}
        />
      </div>
    </div>
  );
};
