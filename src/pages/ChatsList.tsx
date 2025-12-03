import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatList } from '@/components/chat/ChatList';
import { ChatListSkeleton } from '@/components/chat/ChatListSkeleton';
import { EmptyState } from '@/components/chat/EmptyState';
import { Conversation } from '@/types/chat';
import { MessageSquare, Search, Plus, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ChatsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

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

  useEffect(() => {
    const searchUsers = async () => {
      if (!userSearchTerm.trim() || !user) {
        setSearchedUsers([]);
        return;
      }

      setSearchingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .neq('id', user.id)
        .or(`full_name.ilike.%${userSearchTerm}%,username.ilike.%${userSearchTerm}%`)
        .limit(10);

      if (!error && data) {
        setSearchedUsers(data);
      }
      setSearchingUsers(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchTerm, user]);

  const handleStartChat = (userId: string) => {
    setIsNewChatOpen(false);
    navigate(`/messages/${userId}`);
  };

  const filteredConversations = conversations.filter(c =>
    c.partner.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pt-20 pb-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent mb-2">
                Messages
              </h1>
              <p className="text-muted-foreground">
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
                  : 'No conversations yet'}
              </p>
            </div>

            {/* New Chat Button */}
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Chat</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Start a New Chat</DialogTitle>
                  <DialogDescription>
                    Search for a user to start a conversation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {searchingUsers ? (
                      <div className="text-center py-8 text-muted-foreground">Searching...</div>
                    ) : searchedUsers.length > 0 ? (
                      searchedUsers.map((searchedUser) => (
                        <button
                          key={searchedUser.id}
                          onClick={() => handleStartChat(searchedUser.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={searchedUser.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {searchedUser.full_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{searchedUser.full_name}</p>
                            {searchedUser.username && (
                              <p className="text-sm text-muted-foreground">@{searchedUser.username}</p>
                            )}
                          </div>
                        </button>
                      ))
                    ) : userSearchTerm ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No users found</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Start typing to search for users</p>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Bar */}
          {conversations.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-card border-border rounded-xl shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-6">
              <ChatListSkeleton />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-12">
              {conversations.length === 0 ? (
                <EmptyState
                  Icon={MessageSquare}
                  title="No Conversations Yet"
                  message="Start connecting with other filmmakers and creatives!"
                  action={
                    <Button
                      onClick={() => setIsNewChatOpen(true)}
                      className="mt-4 gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Start Your First Chat
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  Icon={Search}
                  title="No Results Found"
                  message={`No conversations match "${searchTerm}"`}
                />
              )}
            </div>
          ) : (
            <ChatList conversations={filteredConversations} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatsList;
