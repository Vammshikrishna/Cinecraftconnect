import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Send } from 'lucide-react';
import { format } from 'date-fns';
import { usePresence } from '@/hooks/usePresence';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  } | null;
}

interface ChatWindowProps {
  threadId: string;
}

export const ChatWindow = ({ threadId }: ChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { onlineUserIds } = usePresence(`convo:${threadId}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(full_name, avatar_url)')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) console.error('Error fetching messages', error);
      else setMessages(data as any);
      setLoading(false);
    };

    fetchMessages();
  }, [threadId]);

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, payload => {
        const newMessage = payload.new as Message;
        // enrich with profile data locally to avoid another fetch
        supabase.from('profiles').select('full_name, avatar_url').eq('id', newMessage.user_id).single().then(({data}) => {
          newMessage.profiles = data;
          setMessages(currentMessages => [...currentMessages, newMessage]);
        })
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const { error } = await supabase.from('messages').insert({ 
      thread_id: threadId, 
      user_id: user.id, 
      content: newMessage.trim()
    });

    if (error) console.error('Error sending message', error);
    else setNewMessage('');
  };

  if (loading) return <div className="p-4"><EnhancedSkeleton className="h-full w-full" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.user_id === user?.id ? 'justify-end' : ''}`}>
            {msg.user_id !== user?.id && (
                <div className="relative">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={msg.profiles?.avatar_url} />
                        <AvatarFallback>{msg.profiles?.full_name[0]}</AvatarFallback>
                    </Avatar>
                    {onlineUserIds.includes(msg.user_id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />} 
                </div>
            )}
            <div className={`p-3 rounded-lg max-w-md ${msg.user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs text-right mt-1 opacity-70">{format(new Date(msg.created_at), 'p')}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center gap-3">
        <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." />
        <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
};
