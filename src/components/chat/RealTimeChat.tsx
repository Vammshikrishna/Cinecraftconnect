
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Send, Sparkles, ArrowLeft } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_profile: {
    full_name: string;
    avatar_url: string;
  } | null;
}

interface RealTimeChatProps {
  roomId: string;
  partnerName: string;
  partnerAvatarUrl: string;
  onBackClick: () => void;
}

const RealTimeChat = ({ roomId, partnerName, partnerAvatarUrl, onBackClick }: RealTimeChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await supabase.rpc('get_messages_for_channel', { p_channel_id: roomId });
    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      setMessages(data as Message[]);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`realtime-chat:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `channel_id=eq.${roomId}` },
        (payload) => { fetchMessages(); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !roomId) return;
    const { error } = await supabase.from('direct_messages').insert({ content: newMessage.trim(), sender_id: user.id, channel_id: roomId, recipient_id: partnerName }); // Note: recipientId logic might need adjustment
    if (error) console.error('Error sending message:', error); else setNewMessage('');
  };

  const getSuggestedReply = async (lastMessage: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return `That's interesting! Can you tell me more about "${lastMessage.substring(0, 20)}..."?`;
  };

  const handleSuggestReply = async () => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    const suggestion = await getSuggestedReply(lastMessage.content);
    setNewMessage(suggestion);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <header className="flex items-center gap-4 p-3 border-b border-gray-700 bg-gray-800 z-10">
        <button onClick={onBackClick} className="p-2 rounded-full hover:bg-gray-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-gray-600">
            <AvatarImage src={partnerAvatarUrl} />
            <AvatarFallback>{partnerName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-bold text-lg">{partnerName}</h2>
          </div>
        </div>
      </header>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 pr-4">
              {messages.map((message) => {
                const isSender = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.sender_profile?.avatar_url} />
                      <AvatarFallback>{message.sender_profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className={`p-3 rounded-2xl max-w-xs lg:max-w-md ${isSender ? 'bg-primary text-primary-foreground' : 'bg-gray-700'}`}>
                      <p className="text-sm break-words">{message.content}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatTimestamp(message.created_at)}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-4 border-t border-gray-700">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-gray-800 border-gray-600 rounded-full"
              autoComplete="off"
            />
            <Button type="button" size="icon" className="rounded-full bg-purple-600 hover:bg-purple-700" onClick={handleSuggestReply} disabled={messages.length === 0}>
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button type="submit" size="icon" className="rounded-full" disabled={!newMessage.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

export default RealTimeChat;
