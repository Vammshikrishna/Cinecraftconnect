import { orTerm } from '@/lib/postgrest';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { usePresence } from '@/hooks/usePresence';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Search, Plus, Trash2, ArrowLeft, Pin, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConversationPrefs } from '@/hooks/useConversationPrefs';
import { pinnedFirst } from '@/lib/conversationPrefs';
import { getDmAccess, filterByPartnerName } from '@/components/chat/dmAccess';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EnhancedRealTimeChat from '@/components/chat/EnhancedRealTimeChat';
import { ChatListSkeleton } from '@/components/chat/ChatListSkeleton';
import { getDisplayMessage, generateDirectRoomId } from '@/lib/chat-utils';
import { Conversation } from '@/types/chat';
import { useE2EEChatKeys } from '@/hooks/useE2EEChatKeys';
import { decryptDirectMessage } from '@/lib/e2ee';
import { confirmDialog } from '@/lib/confirmDialog';
import { useE2EEPrompt } from '@/hooks/useE2EEPrompt';
import { E2EEOfferCard } from '@/components/chat/E2EEOfferCard';
import { getChatClearedAt, isAfterChatClear } from '@/lib/chatClearMarker';
import { useMessageRequests } from '@/hooks/useMessageRequests';
import { MessageRequestView } from '@/components/chat/MessageRequestView';
import { MessageRequestsEntry, MessageRequestsPanel } from '@/components/chat/MessageRequestsPanel';

const Messages = () => {
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isKeyboardVisible, isEmojiPickerOpen } = useKeyboard();
  const { conversationId, userId } = useParams<{ conversationId: string; userId: string }>();
  const activePartnerId = conversationId || userId;
  const { push } = useAppNavigation();
  const { toast } = useToast();

  // Global blur on mount/route change to kill any background focus triggers
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [activePartnerId]);

  const { privateKey, keysLoaded } = useE2EEChatKeys();
  useE2EEPrompt();
  const privateKeyRef = useRef(privateKey);
  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const { onlineUserIds } = usePresence();

  // Partner data for the active chat
  const [activePartnerData, setActivePartnerData] = useState<{ id: string; name: string; avatar: string; accountType: string | null } | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<'idle' | 'loading' | 'ready' | 'notfound' | 'error'>('idle');

  const fetchConversations = useCallback(async (isInitial = true) => {
    if (!user) return;
    if (isInitial) setLoading(true);
    console.log('[Messages Sidebar] Fetching conversations for user:', user.id);
    const { data, error } = await supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

    if (error) {
      console.error('[Messages Sidebar] Error fetching conversations:', error);
      setListError(true);
    } else if (data) {
      setListError(false);
      console.log('[Messages Sidebar] Conversations fetched count:', data.length);
      const processedConversations: Conversation[] = await Promise.all((data as any[]).map(async (c: any) => {
        let decryptedContent = c.last_message_content;
        if (c.last_message_content && (c.last_message_content.includes('__e2ee') || c.last_message_content.startsWith('{'))) {
          if (privateKeyRef.current) {
              try {
                decryptedContent = await decryptDirectMessage(c.last_message_content, privateKeyRef.current);
              } catch (decErr) {
                console.error('[Messages Sidebar] Failed to decrypt preview in sidebar:', decErr);
              }
          } else {
              decryptedContent = '🔒 Encrypted Message';
          }
        }
        // this person cleared the chat on this device: a preview older than that moment is hidden (the rows are not deleted)
        const hiddenByClear = !isAfterChatClear(c.last_message_created_at, getChatClearedAt(user.id, c.other_user_id));
        return {
          partner: {
            id: c.other_user_id,
            full_name: c.other_user_full_name,
            avatar_url: c.other_user_avatar_url,
          },
          last_message: {
            content: hiddenByClear ? 'Chat cleared' : decryptedContent,
            created_at: c.last_message_created_at,
          },
          unread_count: hiddenByClear ? 0 : c.unread_count,
        };
      }));
      setConversations(processedConversations);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  useEffect(() => {
    if (privateKey) {
      console.log('[Messages Sidebar] E2EE Private key loaded/changed. Re-fetching and decrypting previews.');
      fetchConversations(false);
    }
  }, [privateKey, fetchConversations]);

  useEffect(() => {
    if (!user?.id) return;

    console.log('[Messages Sidebar] Setting up realtime subscription: messages_sidebar_updates');
    
    const subscription = supabase
      .channel('messages_sidebar_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'direct_messages' }, 
        (payload) => {
          console.log('[Messages Sidebar] Realtime postgres_changes event received:', payload);
          fetchConversations(false);
        }
      )
      .subscribe((status, err) => {
        console.log('[Messages Sidebar] Realtime channel status:', status, err || '');
      });

    // Subscribe to global broadcast updates for client-to-client sync
    console.log('[Messages Sidebar] Setting up global broadcast updates channel');
    const globalChannel = supabase
      .channel('global_chat_updates')
      .on('broadcast', { event: 'chat_list_update' }, (payload) => {
        const data = payload.payload;
        if (data.senderId === user.id || data.receiverId === user.id) {
          console.log('[Messages Sidebar] Broadcast chat_list_update received:', data);
          fetchConversations(false);
        }
      })
      .subscribe((status, err) => {
        console.log('[Messages Sidebar] Global broadcast channel status:', status, err || '');
      });

    return () => {
      console.log('[Messages Sidebar] Cleaning up subscriptions');
      supabase.removeChannel(subscription);
      supabase.removeChannel(globalChannel);
    };
  }, [user?.id, fetchConversations]);

  useEffect(() => {
    const handleLocalUpdate = (e: any) => {
      console.log('[Messages Sidebar] Local chat_list_update event received, re-fetching conversations');
      fetchConversations(false);
    };

    window.addEventListener('chat_list_update', handleLocalUpdate);
    return () => {
      window.removeEventListener('chat_list_update', handleLocalUpdate);
    };
  }, [fetchConversations]);

  useEffect(() => {
    setActivePartnerData(null);
    if (!activePartnerId) {
      setPartnerStatus('idle');
      return;
    }
    // Do not even query for ids that cannot be a user (typos, random strings) or for yourself.
    const early = getDmAccess({ selfId: user?.id, partnerId: activePartnerId, isFan: false });
    if (early === 'invalid') { setPartnerStatus('notfound'); return; }
    if (early === 'self') { setPartnerStatus('idle'); return; }

    let cancelled = false;
    setPartnerStatus('loading');
    const fetchPartnerProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, account_type')
        .eq('id', activePartnerId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPartnerStatus('error');
      } else if (!data) {
        setPartnerStatus('notfound');
      } else {
        setActivePartnerData({
          id: data.id,
          name: data.full_name || 'User',
          avatar: data.avatar_url || '',
          accountType: (data as any).account_type ?? null,
        });
        setPartnerStatus('ready');
      }
    };

    fetchPartnerProfile();
    return () => { cancelled = true; };
  }, [activePartnerId, user?.id]);

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      if (activePartnerId) {
        sessionStorage.setItem('active_conversation_id', activePartnerId);
      } else {
        sessionStorage.removeItem('active_conversation_id');
      }
    }
    return () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('active_conversation_id');
      }
    };
  }, [activePartnerId]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!userSearchTerm.trim() || !user) {
        setSearchedUsers([]);
        setSearchDone(false);
        setSearchError(false);
        return;
      }

      setSearchingUsers(true);
      setSearchError(false);
      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username, account_type')
        .neq('id', user.id)
        .or(`full_name.ilike.%${orTerm(userSearchTerm)}%,username.ilike.%${orTerm(userSearchTerm)}%`)
        .limit(10);

      if (isFan) query = query.eq('account_type', 'fan');

      const { data, error } = await query;
      if (error) setSearchError(true);
      if (!error && data) {
        if (isFan && data.length > 0) {
          const userIds = data.map(u => u.id);
          const { data: myFollows } = await supabase
            .from('user_follows' as any)
            .select('following_id')
            .eq('follower_id', user.id)
            .in('following_id', userIds);
            
          const { data: myFollowers } = await supabase
            .from('user_follows' as any)
            .select('follower_id')
            .eq('following_id', user.id)
            .in('follower_id', userIds);
            
          const followingIds = myFollows?.map((f: any) => f.following_id) || [];
          const followerIds = myFollowers?.map((f: any) => f.follower_id) || [];
          
          const mutualUserIds = userIds.filter(id => followingIds.includes(id) && followerIds.includes(id));
          setSearchedUsers(data.filter(u => mutualUserIds.includes(u.id)));
        } else {
          setSearchedUsers(data);
        }
      }
      setSearchingUsers(false);
      setSearchDone(true);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [userSearchTerm, user?.id, isFan]);

  const channelId = useMemo(() => {
    if (!user || !activePartnerId) return null;
    return generateDirectRoomId(user.id, activePartnerId);
  }, [user, activePartnerId]);

  const { prefs: chatPrefs } = useConversationPrefs();
  // message requests (part GF): people who are not connections and wrote first live in their own section until accepted
  // part GM adds Hidden requests and Recently deleted; before it is run only the main list exists
  const { requests, hiddenRequests, deletedRequests, requestPartnerIds, hasV2 } = useMessageRequests();
  const [showRequests, setShowRequests] = useState(false);
  const activeRequest = activePartnerId
    ? [...requests, ...hiddenRequests, ...deletedRequests].find((r) => r.partner_id === activePartnerId)
    : undefined;
  const requestsTotal = requests.length + hiddenRequests.length + deletedRequests.length;
  useEffect(() => { if (showRequests && requestsTotal === 0) setShowRequests(false); }, [showRequests, requestsTotal]);
  const filteredConversations = pinnedFirst(
    filterByPartnerName(conversations.filter((c) => !requestPartnerIds.has(c.partner.id)), searchTerm),
    chatPrefs,
  );

  const access = activePartnerId
    ? getDmAccess({
        selfId: user?.id,
        partnerId: activePartnerId,
        isFan,
        partnerAccountType: activePartnerData?.accountType ?? null,
        hasConversation: loading || conversations.some((c) => c.partner.id === activePartnerId),
      })
    : 'ok';

  const handleStartChat = (id: string) => {
    setIsNewChatOpen(false);
    push(`/messages/${id}`);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, partnerId: string) => {
    e.stopPropagation();
    
    if (!user) return;
    const partnerName = conversations.find((c) => c.partner.id === partnerId)?.partner.full_name || 'this person';
    // RLS ("Users Clear Own Direct Messages") lets either side delete, and this removes the rows themselves,
    // so the messages disappear for both people. Say so.
    const confirmDelete = await confirmDialog(
      `Delete this conversation with ${partnerName}? Every message in it will be removed for both you and ${partnerName}. This cannot be undone.`,
      { title: 'Delete conversation for both of you?', confirmLabel: 'Delete for both', destructive: true },
    );
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast({ title: 'Could not delete the conversation', description: 'Please try again.', variant: 'destructive' });
    } else {
      toast({ title: 'Conversation deleted', description: `Removed for you and ${partnerName}.` });
      fetchConversations(false);
      
      if (activePartnerId === partnerId) {
        push('/messages');
      }

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

  return (
    <div className={cn(
      "fixed inset-x-0 lg:left-[72px] top-0 h-[100dvh] bg-background overflow-hidden flex flex-col z-30",
      activePartnerId 
        ? "pt-[env(safe-area-inset-top)] lg:pt-0" 
        : "pt-[calc(env(safe-area-inset-top)+49px)] lg:pt-0",
      (!isKeyboardVisible && !isEmojiPickerOpen) && (
        activePartnerId 
          ? "pb-[env(safe-area-inset-bottom)]" 
          : "pb-[calc(env(safe-area-inset-bottom)+52px)] lg:pb-[env(safe-area-inset-bottom)]"
      )
    )}>
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* static gradients: no blur filter, which is costly on low-end phones */}
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.06), transparent)' }} />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full" style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.06), transparent)' }} />
      </div>
      
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar - Chat List (Hidden on mobile when chat is active) */}
        <div className={cn(
          "w-full lg:w-[350px] xl:w-[400px] border-r border-border flex flex-col bg-card/40 shrink-0",
          activePartnerId ? "hidden lg:flex" : "flex"
        )}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black tracking-tight">Messages</h1>
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button aria-label="New message" size="icon" variant="ghost" className="h-11 w-11 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                    <Plus size={20} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] border-border/50 bg-card">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">New Message</DialogTitle>
                    <DialogDescription className="font-medium">Search for creators or fans in the network.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        aria-label="Search users"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-12 h-14 bg-background/50 border-foreground/5 rounded-2xl"
                      />
                    </div>
                    <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 scrollbar-none">
                      {searchingUsers ? (
                         <div role="status" aria-label="Searching" className="space-y-2">
                           {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)}
                         </div>
                      ) : searchError ? (
                         <p role="alert" className="text-center py-8 text-sm text-destructive">Search failed. Please try again.</p>
                      ) : searchDone && userSearchTerm.trim() && searchedUsers.length === 0 ? (
                         <p className="text-center py-8 text-sm text-muted-foreground">No users found{isFan ? ' (fans can message people they follow and who follow them back)' : ''}.</p>
                      ) : searchedUsers.map((u) => (
                        <button key={u.id} onClick={() => handleStartChat(u.id)} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/10 active:bg-primary/15 transition-colors group">
                          <Avatar className="h-12 w-12 border-2 border-border/50">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback>{Array.from((u.full_name || '').trim())[0]}</AvatarFallback>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search messages..."
                aria-label="Search messages"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-muted/50 border-none pl-10 h-11 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <E2EEOfferCard />

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {!loading && showRequests && requestsTotal > 0 ? (
              <MessageRequestsPanel
                main={requests}
                hidden={hiddenRequests}
                deleted={deletedRequests}
                hasV2={hasV2}
                privateKey={privateKey as any}
                activePartnerId={activePartnerId}
                onOpen={handleStartChat}
                onBack={() => setShowRequests(false)}
              />
            ) : loading ? (
              <ChatListSkeleton />
            ) : (<>
            <MessageRequestsEntry main={requests} hiddenCount={hasV2 ? hiddenRequests.length : 0} onOpen={() => setShowRequests(true)} />
            {filteredConversations.map((convo) => (
              <div
                key={convo.partner.id}
                onClick={() => handleStartChat(convo.partner.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleStartChat(convo.partner.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-[2rem] transition-colors duration-150 relative border border-transparent mb-1 cursor-pointer group",
                  activePartnerId === convo.partner.id 
                    ? "bg-chat-active-conv-bg border-transparent shadow-sm dark:bg-muted" 
                    : "hover:bg-chat-hover-conv-bg hover:border-transparent dark:hover:bg-muted/40 active:bg-muted/60"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-14 w-14 border border-chat-border">
                    <AvatarImage src={convo.partner.avatar_url} />
                    <AvatarFallback className="bg-chat-search-bg text-chat-text-primary">{Array.from((convo.partner.full_name || '').trim())[0]}</AvatarFallback>
                  </Avatar>
                  {onlineUserIds.includes(convo.partner.id) && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-chat-status-online border-4 border-chat-surface rounded-full shadow-lg dark:border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <p title={convo.partner.full_name} className={cn(
                      "font-bold text-base truncate pr-2",
                      activePartnerId === convo.partner.id ? "text-chat-brand-action dark:text-primary" : "text-chat-text-primary dark:text-foreground"
                    )}>
                      {convo.partner.full_name}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {chatPrefs[convo.partner.id]?.pinned && <Pin size={14} className="text-chat-icon-secondary" aria-label="Pinned" />}
                      {chatPrefs[convo.partner.id]?.muted && <BellOff size={14} className="text-chat-icon-secondary" aria-label="Muted" />}
                      {convo.partner.id !== activePartnerId && convo.unread_count > 0 && (
                        <Badge className={cn("text-white h-5 min-w-5 px-1 flex items-center justify-center font-black text-[12px] rounded-full", chatPrefs[convo.partner.id]?.muted ? "bg-muted-foreground" : "bg-chat-brand-action")}>
                          {convo.unread_count > 99 ? '99+' : convo.unread_count}
                        </Badge>
                      )}
                      <button
                        onClick={(e) => handleDeleteConversation(e, convo.partner.id)}
                        className="h-10 w-10 grid place-items-center rounded-full text-chat-icon-secondary hover:text-chat-status-busy hover:bg-chat-hover-button transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
                        title="Delete conversation"
                        aria-label={`Delete conversation with ${convo.partner.full_name || 'this person'}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-chat-text-muted dark:text-muted-foreground line-clamp-1 opacity-70">
                    {getDisplayMessage(convo.last_message.content)}
                  </p>
                </div>
                {activePartnerId === convo.partner.id && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-chat-active-conv-accent rounded-r-full" />
                )}
              </div>
            ))}
            </>)}
            {!loading && listError && conversations.length === 0 && (
              <div role="alert" className="text-center py-12 px-6 space-y-3">
                <p className="text-sm font-bold text-destructive">Could not load your chats.</p>
                <Button size="sm" variant="outline" onClick={() => fetchConversations(true)}>Try again</Button>
              </div>
            )}
            {!loading && !listError && filteredConversations.length === 0 && (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={24} className="opacity-30" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No chats found</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsNewChatOpen(true)}>Start a chat</Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Chat Window */}
        <div className={cn(
          "flex-1 bg-background flex flex-col overflow-hidden relative",
          !activePartnerId && "hidden lg:flex"
        )}>
          {activeRequest ? (
            <MessageRequestView
              request={activeRequest}
              privateKey={privateKey as any}
              onBack={() => push('/messages', { noScroll: true })}
              onAnswered={(accepted) => { if (!accepted) push('/messages', { noScroll: true }); }}
            />
          ) : activePartnerId && channelId && activePartnerData && access === 'ok' ? (
            <EnhancedRealTimeChat
              roomId={channelId}
              partnerId={activePartnerData.id}
              partnerName={activePartnerData.name}
              partnerAvatarUrl={activePartnerData.avatar}
              onBackClick={() => push('/messages', { noScroll: true })}
            />
          ) : activePartnerId && access === 'ok' && partnerStatus === 'loading' ? (
            <div className="h-full flex items-center justify-center" role="status" aria-label="Loading chat">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : activePartnerId && (access !== 'ok' || partnerStatus === 'notfound' || partnerStatus === 'error') ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center relative" role="alert">
              <Button variant="ghost" size="sm" className="absolute left-3 top-3 gap-1" onClick={() => push('/messages', { noScroll: true })}>
                <ArrowLeft size={16} aria-hidden="true" /> Back to messages
              </Button>
              <MessageSquare size={40} className="text-muted-foreground mb-4" aria-hidden="true" />
              <h2 className="text-xl font-black tracking-tight mb-2">
                {access === 'self' ? 'You cannot message yourself'
                  : access === 'fan_restricted' ? 'You cannot message this person'
                  : partnerStatus === 'error' ? 'Could not open this chat'
                  : 'This person was not found'}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {access === 'self' ? 'Pick someone else from your inbox or start a new message.'
                  : access === 'fan_restricted' ? 'Fan accounts can message fans they follow and who follow them back.'
                  : partnerStatus === 'error' ? 'Check your connection and try again.'
                  : 'The link may be wrong, or the account may no longer exist.'}
              </p>
              <Button onClick={() => push('/messages', { noScroll: true })}>Go to my messages</Button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
               <div className="w-32 h-32 bg-primary/5 rounded-[3rem] flex items-center justify-center mb-8 border border-primary/10 rotate-6 shadow-2xl shadow-primary/5">
                  <MessageSquare size={56} className="text-primary opacity-40" />
               </div>
               <h2 className="text-2xl font-black tracking-tight mb-3">Your Inbox</h2>
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

