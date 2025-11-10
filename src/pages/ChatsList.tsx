
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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

    const subscription = supabase
      .channel('public:direct_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, fetchConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const filteredConversations = conversations.filter(c =>
    c.partner.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Chats</h1>
      <Input
        placeholder="Search chats..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center text-muted-foreground mt-8">
          <p>No conversations yet.</p>
          <p className="text-sm">Start a new chat from a user's profile.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(convo => (
            <Link to={`/chats/${convo.partner.id}`} key={convo.partner.id} className="block">
              <div className="flex items-center p-3 bg-card rounded-lg hover:bg-muted transition-colors">
                <Avatar className="h-12 w-12 mr-4">
                  <AvatarImage src={convo.partner.avatar_url} alt={convo.partner.full_name} />
                  <AvatarFallback>{convo.partner.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-semibold">{convo.partner.full_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(convo.last_message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-muted-foreground truncate">{convo.last_message.content}</p>
                    {convo.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{convo.unread_count}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatsList;
