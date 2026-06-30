
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useE2EEChatKeys } from '@/hooks/useE2EEChatKeys';
import { decryptDirectMessage } from '@/lib/e2ee';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatList } from '@/components/chat/ChatList';
import { ChatListSkeleton } from '@/components/chat/ChatListSkeleton';
import { EmptyState } from '@/components/chat/EmptyState';
import { Conversation } from '@/types/chat';
import { usePresence } from '@/hooks/usePresence';
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
import { PageHeader } from '@/components/common/PageHeader';
import { generateDirectRoomId } from '@/lib/chat-utils';

const ChatsList = () => {
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { push } = useAppNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const { onlineUserIds } = usePresence();

  const { privateKey } = useE2EEChatKeys();
  const privateKeyRef = useRef(privateKey);
  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  const fetchConversations = useCallback(async (isInitial = true) => {
    if (!user) return;
    if (isInitial) setLoading(true);
    console.log('[ChatsList] Fetching conversations for user:', user.id);
    const { data, error } = await supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

    if (error) {
      console.error('[ChatsList] Error fetching conversations:', error);
      setConversations([]);
    } else if (data) {
      console.log('[ChatsList] Conversations fetched count:', data.length);
      const processedConversations: Conversation[] = await Promise.all((data as any[]).map(async (c: any) => {
        let decryptedContent = c.last_message_content;
        if (c.last_message_content?.includes('__e2ee')) {
          if (privateKeyRef.current) {
            try {
              decryptedContent = await decryptDirectMessage(c.last_message_content, privateKeyRef.current);
            } catch (decErr) {
              console.error('[ChatsList] Failed to decrypt preview in ChatsList:', decErr);
            }
          } else {
            decryptedContent = '🔒 Encrypted Message';
          }
        }
        return {
          partner: {
            id: c.other_user_id,
            full_name: c.other_user_full_name,
            avatar_url: c.other_user_avatar_url,
          },
          last_message: {
            content: decryptedContent,
            created_at: c.last_message_created_at,
          },
          unread_count: c.unread_count,
        };
      }));
      setConversations(processedConversations);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchConversations(true);
    }
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    if (privateKey) {
      console.log('[ChatsList] E2EE Private key loaded/changed. Re-fetching and decrypting previews.');
      fetchConversations(false);
    }
  }, [privateKey, fetchConversations]);

  useEffect(() => {
    if (!user?.id) return;

    console.log('[ChatsList] Setting up realtime subscription: public:direct_messages:all');
    
    const subscription = supabase
      .channel('public:direct_messages:all')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'direct_messages' }, 
        (payload) => {
          console.log('[ChatsList] Realtime postgres_changes event received:', payload);
          fetchConversations(false);
        }
      )
      .subscribe((status, err) => {
        console.log('[ChatsList] Realtime channel status:', status, err || '');
      });

    // Subscribe to global broadcast updates for client-to-client sync
    console.log('[ChatsList] Setting up global broadcast updates channel');
    const globalChannel = supabase
      .channel('global_chat_updates')
      .on('broadcast', { event: 'chat_list_update' }, (payload) => {
        const data = payload.payload;
        if (data.senderId === user.id || data.receiverId === user.id) {
          console.log('[ChatsList] Broadcast chat_list_update received:', data);
          fetchConversations(false);
        }
      })
      .subscribe((status, err) => {
        console.log('[ChatsList] Global broadcast channel status:', status, err || '');
      });

    return () => {
      console.log('[ChatsList] Cleaning up subscriptions');
      supabase.removeChannel(subscription);
      supabase.removeChannel(globalChannel);
    };
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    const handleLocalUpdate = (e: any) => {
      console.log('[ChatsList] Local chat_list_update event received, re-fetching conversations');
      fetchConversations(false);
    };

    window.addEventListener('chat_list_update', handleLocalUpdate);
    return () => {
      window.removeEventListener('chat_list_update', handleLocalUpdate);
    };
  }, [fetchConversations]);

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

      // Fans can only DM other fans
      if (isFan) {
        query = query.eq('account_type', 'fan');
      }

      const { data, error } = await query;

      if (!error && data) {
        setSearchedUsers(data);
      }
      setSearchingUsers(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchTerm, user?.id, isFan]);

  const handleStartChat = (userId: string) => {
    setIsNewChatOpen(false);
    push(`/messages/${userId}`);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, partnerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this specific conversation? This cannot be undone.");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);

    if (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } else {
      fetchConversations(false);

      window.dispatchEvent(new CustomEvent('chat_list_update', {
        detail: { senderId: user.id, receiverId: partnerId }
      }));

      const globalChannel = supabase.channel('global_chat_updates');
      globalChannel.send({
        type: 'broadcast',
        event: 'chat_list_update',
        payload: { senderId: user.id, receiverId: partnerId }
      }).catch(console.error);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.partner.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-24 selection:bg-primary/30">
        {/* Background Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
        <PageHeader 
          title="Messages" 
          subtitle={conversations.length > 0
            ? `You have ${conversations.length} active conversation${conversations.length !== 1 ? 's' : ''}`
            : 'Start connecting with other filmmakers and creatives!'} 
          Icon={MessageSquare}
          actions={
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-6 shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0">
                  <Plus size={20} strokeWidth={3} />
                  <span>New Chat</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-[2.5rem] border-border/50 bg-card/95 backdrop-blur-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">Search Network</DialogTitle>
                  <DialogDescription className="font-medium">
                    {isFan
                      ? 'Find other fans to start a conversation'
                      : 'Start a encrypted direct communication channel'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-12 h-14 bg-background/50 border-white/5 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 scrollbar-none">
                    {searchingUsers ? (
                      <div className="text-center py-12">
                        <LoadingSpinner size="sm" className="mx-auto mb-4 text-primary" />
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Grid...</p>
                      </div>
                    ) : searchedUsers.length > 0 ? (
                      searchedUsers.map((searchedUser) => (
                        <button
                          key={searchedUser.id}
                          onClick={() => handleStartChat(searchedUser.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 group"
                        >
                          <Avatar className="h-12 w-12 border-2 border-border/50 group-hover:scale-110 transition-transform">
                            <AvatarImage src={searchedUser.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-primary/20 text-primary font-black">
                              {searchedUser.full_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <p className="font-black text-foreground group-hover:text-primary transition-colors">{searchedUser.full_name}</p>
                            {searchedUser.username && (
                              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">@{searchedUser.username}</p>
                            )}
                          </div>
                        </button>
                      ))
                    ) : userSearchTerm ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                            <Users size={24} className="opacity-40" />
                        </div>
                        <p className="font-black text-xs uppercase tracking-widest">No signals found</p>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                            <Search size={24} className="opacity-40" />
                        </div>
                        <p className="font-black text-xs uppercase tracking-widest">Enter username or craft</p>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Search Bar */}
        {conversations.length > 0 && (
          <div className="relative mb-10 group">
             <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000" />
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                <Input
                    placeholder="Refine search by thread participant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-14 bg-card/60 backdrop-blur-xl border-border/50 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                />
             </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[2.5rem] border border-border/50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
          {loading ? (
            <div className="p-8">
              <ChatListSkeleton />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-16">
              {conversations.length === 0 ? (
                <EmptyState
                  Icon={MessageSquare}
                  title="Zero Transmissions"
                  message="Initialize your first direct communication channel with a filmmaker."
                  action={
                    <Button
                      onClick={() => setIsNewChatOpen(true)}
                      className="mt-6 gap-2.5 bg-primary hover:bg-primary/90 h-12 px-8 rounded-xl font-bold"
                    >
                      <Plus className="h-4 w-4" />
                      Open Comm Link
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  Icon={Search}
                  title="No Signal Found"
                  message={`We couldn't locate any active threads matching "${searchTerm}"`}
                />
              )}
            </div>
          ) : (
            <div className="p-2 sm:p-4">
                 <ChatList 
                     conversations={filteredConversations} 
                     onlineUserIds={onlineUserIds} 
                     onDelete={handleDeleteConversation}
                 />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LoadingSpinner = ({ className, size }: { className?: string, size?: string }) => (
    <svg 
        className={`animate-spin ${className} ${size === 'sm' ? 'w-5 h-5' : 'w-8 h-8'}`} 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
    >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default ChatsList;
