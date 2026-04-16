
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EnhancedRealTimeChat from '@/components/chat/EnhancedRealTimeChat';
import { ChatListSkeleton } from '@/components/chat/ChatListSkeleton';
import { getDisplayMessage } from '@/lib/chat-utils';
import { Conversation } from '@/types/chat';

const Messages = () => {
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { conversationId, userId } = useParams<{ conversationId: string; userId: string }>();
  const activePartnerId = conversationId || userId;
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const { onlineUserIds } = usePresence();

  // Partner data for the active chat
  const [activePartnerData, setActivePartnerData] = useState<{ id: string; name: string; avatar: string } | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

      if (error) {
        console.error('Error fetching conversations:', error);
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

    fetchConversations();

    const subscription = supabase
      .channel('public:direct_messages:messages_view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, fetchConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activePartnerId) {
      setActivePartnerData(null);
      return;
    }

    const fetchPartnerProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', activePartnerId)
        .single();

      if (!error && data) {
        setActivePartnerData({
          id: data.id,
          name: data.full_name || 'User',
          avatar: data.avatar_url || '',
        });
      }
    };

    fetchPartnerProfile();
  }, [activePartnerId]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!userSearchTerm.trim() || !user) {
        setSearchedUsers([]);
        return;
      }

      setSearchingUsers(true);
      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username, account_type')
        .neq('id', user.id)
        .or(`full_name.ilike.%${userSearchTerm}%,username.ilike.%${userSearchTerm}%`)
        .limit(10);

      if (isFan) query = query.eq('account_type', 'fan');

      const { data, error } = await query;
      if (!error && data) setSearchedUsers(data);
      setSearchingUsers(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchTerm, user?.id, isFan]);

  const channelId = useMemo(() => {
    if (!user || !activePartnerId) return null;
    return [user.id, activePartnerId].sort().join('-');
  }, [user, activePartnerId]);

  const filteredConversations = conversations.filter(c =>
    c.partner.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartChat = (id: string) => {
    setIsNewChatOpen(false);
    navigate(`/messages/${id}`);
  };

  return (
    <div className="h-screen w-full flex flex-col pt-16 bg-background overflow-hidden relative">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px]" />
      </div>
      
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar - Chat List (Hidden on mobile when chat is active) */}
        <div className={cn(
          "w-full lg:w-[350px] xl:w-[400px] border-r border-border flex flex-col bg-card/40 backdrop-blur-xl shrink-0 transition-all duration-300",
          activePartnerId ? "hidden lg:flex" : "flex"
        )}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black tracking-tight">Messages</h1>
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                    <Plus size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-border/50 bg-card/95 backdrop-blur-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">New Message</DialogTitle>
                    <DialogDescription className="font-medium">Search for creators or fans in the network.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                      <Input
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-12 h-14 bg-background/50 border-white/5 rounded-2xl"
                      />
                    </div>
                    <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 scrollbar-none">
                      {searchingUsers ? (
                         <div className="text-center py-12">Loading...</div>
                      ) : searchedUsers.map((u) => (
                        <button key={u.id} onClick={() => handleStartChat(u.id)} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/10 transition-all group">
                          <Avatar className="h-12 w-12 border-2 border-border/50 group-hover:scale-110 transition-transform">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback>{u.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="text-left flex-1">
                            <p className="font-black text-foreground group-hover:text-primary transition-colors">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-muted/50 border-none pl-10 h-11 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {loading ? (
              <ChatListSkeleton />
            ) : filteredConversations.map((convo) => (
              <button
                key={convo.partner.id}
                onClick={() => handleStartChat(convo.partner.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-[2rem] transition-all duration-300 relative border border-transparent mb-1",
                  activePartnerId === convo.partner.id 
                    ? "bg-primary/10 border-primary/10 shadow-sm" 
                    : "hover:bg-muted/40 hover:border-border/30"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-14 w-14 border border-border/50">
                    <AvatarImage src={convo.partner.avatar_url} />
                    <AvatarFallback>{convo.partner.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  {onlineUserIds.includes(convo.partner.id) && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 border-4 border-background rounded-full shadow-lg animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={cn(
                      "font-bold text-base truncate pr-2",
                      activePartnerId === convo.partner.id ? "text-primary" : "text-foreground"
                    )}>
                      {convo.partner.full_name}
                    </p>
                    {convo.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 min-w-5 px-1 flex items-center justify-center font-black text-[10px] rounded-full">
                        {convo.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 opacity-70">
                    {getDisplayMessage(convo.last_message.content)}
                  </p>
                </div>
                {activePartnerId === convo.partner.id && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-primary rounded-r-full" />
                )}
              </button>
            ))}
            {!loading && filteredConversations.length === 0 && (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={24} className="opacity-30" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">No chats found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Chat Window */}
        <div className={cn(
          "flex-1 bg-background flex flex-col overflow-hidden relative",
          !activePartnerId && "hidden lg:flex"
        )}>
          {activePartnerId && channelId && activePartnerData ? (
            <EnhancedRealTimeChat
              roomId={channelId}
              partnerId={activePartnerData.id}
              partnerName={activePartnerData.name}
              partnerAvatarUrl={activePartnerData.avatar}
              onBackClick={() => navigate('/messages')}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
               <div className="w-32 h-32 bg-primary/5 rounded-[3rem] flex items-center justify-center mb-8 border border-primary/10 rotate-6 shadow-2xl shadow-primary/5">
                  <MessageSquare size={56} className="text-primary opacity-40" />
               </div>
               <h2 className="text-3xl font-black tracking-tight mb-3">Your Inbox</h2>
               <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed font-medium">
                  Send private photos and messages to a friend or filmmaker. Select a conversation to start.
               </p>
               <Button 
                onClick={() => setIsNewChatOpen(true)}
                className="mt-8 bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-12 rounded-2xl shadow-xl shadow-primary/20"
               >
                  Send Message
               </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
