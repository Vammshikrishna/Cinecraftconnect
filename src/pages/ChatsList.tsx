import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare } from 'lucide-react';

// Define types for conversations and profiles
interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface Conversation {
  partner: Profile;
  last_message: {
    content: string;
    created_at: string;
  };
  unread_count: number;
}

const ChatsList = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      setLoading(true);
      // This RPC function gets all conversations, with the latest message and partner profile
      const { data, error } = await supabase.rpc('get_user_conversations_with_profiles', { p_user_id: user.id });

      if (error) {
        console.error('Error fetching conversations:', error);
        setConversations([]);
      } else if (data) {
        const processedConversations: Conversation[] = data.map(c => ({
          partner: {
            id: c.other_user_id,
            full_name: c.other_user_full_name,
            avatar_url: c.other_user_avatar_url,
          },
          last_message: {
            content: c.last_message_content,
            created_at: c.last_message_created_at,
          },
          unread_count: c.unread_count,
        }));
        setConversations(processedConversations);
      }
      setLoading(false);
    };

    if (user) {
      fetchConversations();
    }

    // Subscribe to all changes in the direct_messages table and refetch conversations
    const subscription = supabase
      .channel('public:direct_messages:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, fetchConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const filteredConversations = conversations.filter(c =>
    c.partner.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimestamp = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;

      const days = Math.floor(hours / 24);
      return `${days}d`;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-900 text-white pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inbox</h1>
          {/* Link to find new people to chat with could go here */}
        </div>
        <div className="mb-6">
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border-gray-700 placeholder-gray-500 rounded-full"
          />
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center text-gray-500 mt-16">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-600"/>
            <h2 className="text-xl font-semibold">No Conversations Yet</h2>
            <p className="mt-2">Start a new chat from a member's profile page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map(convo => (
              <Link to={`/messages/${convo.partner.id}`} key={convo.partner.id} className="block">
                <div className="flex items-center p-4 bg-gray-800 rounded-2xl hover:bg-gray-700/70 transition-colors duration-200">
                  <Avatar className="h-14 w-14 mr-4 border-2 border-transparent">
                    <AvatarImage src={convo.partner.avatar_url} alt={convo.partner.full_name} />
                    <AvatarFallback className="bg-gray-700">{convo.partner.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg truncate">{convo.partner.full_name}</h3>
                      <p className="text-sm text-gray-400 flex-shrink-0">
                        {formatTimestamp(convo.last_message.created_at)}
                      </p>
                    </div>
                    <div className="flex justify-between items-start">
                      <p className="text-md text-gray-400 truncate pr-4">{convo.last_message.content}</p>
                      {convo.unread_count > 0 && (
                        <Badge className="bg-indigo-600 text-white flex-shrink-0">{convo.unread_count}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsList;
