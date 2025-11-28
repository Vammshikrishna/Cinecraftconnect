import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { ChatList } from '@/components/chat/ChatList';
import { ChatListSkeleton } from '@/components/chat/ChatListSkeleton';
import { EmptyState } from '@/components/chat/EmptyState';
import { Conversation } from '@/types/chat';
import { MessageSquare } from 'lucide-react';

const ChatsList = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

      if (error) {
        console.error('Error fetching conversations:', error);
        setConversations([]);
      } else if (data) {
        const processedConversations: Conversation[] = (data as any[]).map((c: any) => ({
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

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-900 text-white pt-24 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inbox</h1>
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
          <ChatListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <EmptyState Icon={MessageSquare} title="No Conversations Yet" message="Start a new chat from a member's profile page." />
        ) : (
          <ChatList conversations={filteredConversations} />
        )}
      </div>
    </div>
  );
};

export default ChatsList;
