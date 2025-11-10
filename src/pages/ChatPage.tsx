import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft } from 'lucide-react';

// Define types for messages and profiles
interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_profile: {
    full_name: string;
    avatar_url: string;
  };
}

interface Profile {
    id: string;
    full_name: string;
    avatar_url: string;
}

const ChatPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const fetchChatData = async () => {
      setLoading(true);
      
      // Fetch partner's profile
      const { data: partnerData, error: partnerError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', conversationId)
        .single();

      if (partnerError || !partnerData) {
        console.error('Error fetching partner profile:', partnerError);
        setLoading(false);
        return;
      }
      setPartner(partnerData);

      // Fetch messages
      const { data: messageData, error: messageError } = await supabase
        .from('direct_messages')
        .select(`
          id, content, created_at, sender_id,
          sender_profile:profiles(full_name, avatar_url)
        `)
        .or(`(sender_id.eq.${user.id},recipient_id.eq.${conversationId}),(sender_id.eq.${conversationId},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (messageError) {
        console.error('Error fetching messages:', messageError);
      } else {
        setMessages(messageData as any as Message[]);
      }
      setLoading(false);
    };

    fetchChatData();

    const subscription = supabase
      .channel(`dm-${user.id}-${conversationId}`)
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'direct_messages' }, 
          async (payload) => {
            const newMessage = payload.new as { id: string, content: string, created_at: string, sender_id: string };
            if (newMessage.sender_id === user.id) return; // Ignore messages sent by self that are handled optimistically

            const { data: profile, error } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            if (error) {
              console.error('Error fetching profile for new message:', error);
              return;
            }

            const messageWithProfile: Message = {
              ...newMessage,
              sender_profile: profile,
            };
            setMessages(current => [...current, messageWithProfile]);
          }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !conversationId) return;

    const content = newMessage.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    
    const optimisticMessage: Message = {
      id: optimisticId,
      content: content,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      sender_profile: {
        full_name: user.user_metadata.full_name,
        avatar_url: user.user_metadata.avatar_url,
      },
    };

    setMessages(current => [...current, optimisticMessage]);
    setNewMessage('');

    const { data, error } = await supabase
      .from('direct_messages')
      .insert([{ sender_id: user.id, recipient_id: conversationId, content: content }])
      .select()
      .single();

    if (error || !data) {
      console.error('Error sending message:', error);
      // Revert the optimistic update
      setMessages(current => current.filter(m => m.id !== optimisticId));
      setNewMessage(content); // Restore input
    } else {
      // The optimistic message is already displayed.
      // We can update it with the real data from the server.
      setMessages(current =>
        current.map(m =>
          m.id === optimisticId ? { ...m, id: data.id, created_at: data.created_at } : m
        )
      );
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>;
  }

  if (!partner) {
    return <div className="text-center p-8">Could not load chat partner.</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 p-4 border-b bg-card">
        <Link to="/chats" className="lg:hidden">
          <Button variant="ghost" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <Avatar>
          <AvatarImage src={partner.avatar_url} alt={partner.full_name} />
          <AvatarFallback>{partner.full_name?.charAt(0) || 'U'}</AvatarFallback>
        </Avatar>
        <h2 className="font-bold text-lg">{partner.full_name}</h2>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender_id === user?.id ? 'justify-end' : ''}`}>
            {msg.sender_id !== user?.id && msg.sender_profile && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.sender_profile.avatar_url} />
                <AvatarFallback>{msg.sender_profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            )}
            <div className={`max-w-xs p-3 rounded-lg ${msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <p>{msg.content}</p>
              <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.created_at).toLocaleTimeString()}</p>
            </div>
            {msg.sender_id === user?.id && (
              <Avatar className="h-8 w-8">
                {/* Assuming user profile is available in useAuth context */}
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback>{user.user_metadata.full_name?.charAt(0) || 'Y'}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t bg-card">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
          />
          <Button type="submit">Send</Button>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;
