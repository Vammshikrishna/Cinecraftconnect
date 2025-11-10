
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client.ts';
import { useAuth } from '@/contexts/AuthContext.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface RealTimeChatProps {
  roomId: string;
}

const RealTimeChat = ({ roomId }: RealTimeChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id, content, created_at, user_id,
          profiles!user_id (full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) console.error('Error fetching messages:', error);
      else setMessages(data as unknown as Message[]);
    };

    fetchMessages();

    const channel = supabase.channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        async (payload: RealtimePostgresChangesPayload<{ [key: string]: string }>) => {
          const newMessage = payload.new as { id: string, content: string, created_at: string, user_id: string };
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMessage.user_id)
            .single();

          if (error) {
            console.error('Error fetching profile for new message:', error);
            return;
          }
          
          const messageWithProfile: Message = {
            ...newMessage,
            profiles: profile,
          };

          setMessages((currentMessages: Message[]) => [...currentMessages, messageWithProfile]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const { error } = await supabase.from('room_messages').insert([
      { room_id: roomId, user_id: user.id, content: newMessage.trim() },
    ]);

    if (error) console.error('Error sending message:', error);
    else setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg: Message) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.user_id === user?.id ? 'justify-end' : ''}`}>
               {msg.user_id !== user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={msg.profiles.avatar_url ?? undefined} />
                  <AvatarFallback>{msg.profiles.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-xs p-3 rounded-lg ${msg.user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm font-semibold">{msg.profiles.full_name}</p>
                <p>{msg.content}</p>
                <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString()}</p>
              </div>
              {msg.user_id === user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata.avatar_url} />
                  <AvatarFallback>{user.user_metadata.full_name?.charAt(0) || 'Y'}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
          />
          <Button type="submit">Send</Button>
        </form>
      </div>
    </div>
  );
};

export default RealTimeChat;
