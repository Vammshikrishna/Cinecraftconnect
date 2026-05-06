import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMessageSeen } from '@/hooks/useMessageSeen';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Video, Phone, Settings, Trash2, Send, ArrowLeft, Smile, X, Reply, ShieldBan, MoreVertical, User, BellOff, ShieldAlert, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/hooks/useCall';
import { useGlobalCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { PostShareCard } from './PostShareCard';
import { MarketplaceShareCard } from './MarketplaceShareCard';
import { AnnouncementShareCard } from './AnnouncementShareCard';
import { VendorShareCard } from './VendorShareCard';
import { JobShareCard } from './JobShareCard';
import { ProjectShareCard } from './ProjectShareCard';
import { DiscussionShareCard } from './DiscussionShareCard';
import { usePresence } from '@/hooks/usePresence';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import VerificationBadge from '../common/VerificationBadge';


interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  replied_to_message?: {
    id: string;
    content: string;
    is_deleted?: boolean;
    sender_profile?: {
      full_name: string;
      avatar_url: string;
      is_verified?: boolean;
    } | null;
  } | null;
  sender_profile: {
    full_name: string;
    avatar_url: string;
    is_verified?: boolean;
  } | null;
  deleted_for_users?: string[];
  is_read?: boolean;
  read_at?: string | null;
}

interface EnhancedRealTimeChatProps {
  roomId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarUrl: string;
  partnerIsVerified?: boolean;
  onBackClick: () => void;
}

const SENDER_COLORS = [
  'text-blue-700 dark:text-blue-300',
  'text-primary dark:text-primary/70 dark:text-primary/80',
  'text-rose-700 dark:text-rose-300',
  'text-amber-700 dark:text-amber-300',
  'text-indigo-700 dark:text-indigo-300',
  'text-cyan-700 dark:text-cyan-300',
  'text-violet-700 dark:text-violet-300',
  'text-orange-700 dark:text-orange-300',
  'text-sky-700 dark:text-sky-300',
  'text-pink-700 dark:text-pink-300',
  'text-teal-700 dark:text-teal-300',
  'text-fuchsia-700 dark:text-fuchsia-300',
];

const getUserColor = (userId: string) => {
  if (!userId) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

const EnhancedRealTimeChat = ({ roomId, partnerId, partnerName, partnerAvatarUrl, partnerIsVerified, onBackClick }: EnhancedRealTimeChatProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { onlineUserIds } = usePresence();
  const { observeMessage } = useMessageSeen();
  const isKeyboardVisible = useKeyboardVisible();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { markAsRead } = useChatReadStatus();
  const { toast } = useToast();
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall } = useGlobalCall();
  const { activeCall } = useCall('direct', roomId || '');
  const isInCall = callState.isActive && callState.roomId === roomId;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isPartnerOnline = onlineUserIds.includes(partnerId);
  
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = useCallback(async (isNewRoom = true) => {
    if (!roomId) return;
    
    if (isNewRoom) {
      setLoading(true);
      isInitialLoad.current = true;
    }

    const { data, error } = await (supabase.rpc as any)('get_messages_for_channel_paginated', { 
      p_channel_id: roomId,
      p_limit: 30,
      p_offset: 0
    });

    if (error) {
      // Fallback to non-paginated if RPC doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await (supabase.rpc as any)('get_messages_for_channel', { p_channel_id: roomId });
      if (fallbackError) {
        console.error('Error fetching messages:', fallbackError);
        setMessages([]);
      } else {
        setMessages(fallbackData as Message[]);
        setHasMore(false);
      }
    } else {
      const fetchedMessages = (data as Message[]) || [];
      // Data from paginated RPC is expected latest-first, but get_messages_for_channel was oldest-first
      // Let's ensure consistency: sorted oldest to newest for UI
      const sortedMessages = [...fetchedMessages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sortedMessages);
      setHasMore(fetchedMessages.length === 30);
    }
    setLoading(false);
  }, [roomId]);

  const loadMoreMessages = async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    lastScrollHeight.current = scrollContainerRef.current?.scrollHeight || 0;

    const { data, error } = await (supabase.rpc as any)('get_messages_for_channel_paginated', {
      p_channel_id: roomId,
      p_limit: 30,
      p_offset: messages.length
    });

    if (error) {
      console.error('Error loading more messages:', error);
    } else {
      const fetchedMessages = (data as Message[]) || [];
      if (fetchedMessages.length > 0) {
        const sortedNewMessages = [...fetchedMessages].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(prev => [...sortedNewMessages, ...prev]);
        setHasMore(fetchedMessages.length === 30);
      } else {
        setHasMore(false);
      }
    }
    setLoadingMore(false);
  };

  // Use a ref for fetchMessages to avoid subscription churn
  const fetchMessagesRef = useRef(fetchMessages);
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Separate "Mark as Read" to avoid refetch loops
  useEffect(() => {
    if (partnerId && messages.length > 0) {
      markAsRead('dm', partnerId);
    }
  }, [partnerId, messages.length, markAsRead]);


  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom('auto');
        isInitialLoad.current = false;
      } else {
        if (scrollContainerRef.current && lastScrollHeight.current > 0) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDiff = newScrollHeight - lastScrollHeight.current;
          scrollContainerRef.current.scrollTop += heightDiff;
          lastScrollHeight.current = 0;
        } else {
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || !hasMore) return;
    const { scrollTop } = scrollContainerRef.current;
    if (scrollTop < 100) {
      loadMoreMessages();
    }
  }, [loadingMore, hasMore, roomId, messages.length]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`chat-v4-${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const newPayload = payload.new as any;
          const oldPayload = payload.old as any;
          if (newPayload.channel_id === roomId || oldPayload?.channel_id === roomId) {
            setTimeout(() => fetchMessagesRef.current(), 100);
            setTimeout(() => fetchMessagesRef.current(), 500);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const newPayload = payload.new as any;
          const oldPayload = payload.old as any;
          if (newPayload.channel_id === roomId || oldPayload?.channel_id === roomId) {
            setTimeout(() => fetchMessagesRef.current(), 100);
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !roomId) return;

    const contentToSend = newMessage.trim();

    const { error: sendError } = await supabase.from('direct_messages' as any).insert({
      content: contentToSend,
      sender_id: user.id,
      channel_id: roomId,
      receiver_id: partnerId,
      reply_to_id: replyingTo?.id || null
    });

    if (sendError && (sendError as any).message?.includes('receiver_id')) {
      await supabase.from('direct_messages' as any).insert({
        content: contentToSend,
        sender_id: user.id,
        channel_id: roomId,
        recipient_id: partnerId,
        reply_to_id: replyingTo?.id || null
      });
    } else if (sendError) {
      console.error('Error sending message:', sendError);
      return;
    }

    setNewMessage('');
    setShowEmojiPicker(false);
    setReplyingTo(null);
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('direct_messages' as any)
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);
    
    if (error) {
      console.error('Error undoing message:', error);
      toast({ title: "Error", description: "Failed to undo message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const handleHideMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await (supabase.rpc as any)('hide_message_for_user', {
      p_table: 'direct_messages',
      p_message_id: messageId
    });
    
    if (error) {
      console.error('Error hiding message:', error);
      toast({ title: "Error", description: "Failed to hide message", variant: "destructive" });
    } else {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const onEmojiClick = (emojiObject: EmojiClickData) => {
    setNewMessage(prevMessage => prevMessage + emojiObject.emoji);
  };

  const handleDeleteChat = async () => {
    if (!user || !roomId) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this specific conversation? This cannot be undone.");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('direct_messages' as any)
      .delete()
      .eq('channel_id', roomId);
    
    if (error) {
      console.error('Error deleting chat history:', error);
      alert('Failed to delete history. Please try again.');
    } else {
      setMessages([]);
    }
  };

  const handleStartCall = async () => {
    if (!roomId) return;
    const success = await startGlobalCall('direct', roomId, partnerName || 'Direct Call');
    if (!success) {
      toast({ title: "Failed to start call", variant: "destructive" });
    }
  };

  const handleJoinCall = async () => {
    if (!roomId) return;
    const success = await joinGlobalCall('direct', roomId, partnerName || 'Direct Call');
    if (!success) {
      toast({ title: "Failed to join call", variant: "destructive" });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'p');
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const visibleMessages = messages.filter(m => !m.deleted_for_users?.includes(user?.id || ''));
  // Watermark logic: Find the index of the VERY LAST read message sent by me
  const lastReadIndexSentByMe = visibleMessages.reduce((lastIdx, msg, idx) => 
    (msg.sender_id === user?.id && (msg.is_read || msg.read_at)) ? idx : lastIdx, -1);


  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBackClick} className="p-2 rounded-full hover:bg-muted lg:hidden">
            <ArrowLeft className="h-6 w-6" />
          </button>
          {partnerName && (
            <div 
              className="flex items-center gap-3 cursor-pointer group/partner"
              onClick={() => navigate(`/profile/${partnerId}`)}
            >
              <Avatar className="transition-transform group-hover/partner:scale-110">
                <AvatarImage src={partnerAvatarUrl} />
                <AvatarFallback>{partnerName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-lg leading-tight group-hover/partner:text-primary transition-colors">{partnerName}</h2>
                  {(partnerIsVerified || partnerName?.toLowerCase().includes('vamshi')) && <VerificationBadge size="sm" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${isPartnerOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-70">
                    {isPartnerOnline ? "Active Now" : "Away"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {activeCall && !isInCall ? (
            <Button 
                onClick={handleJoinCall} 
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 gap-2 animate-bounce-subtle"
            >
                <Video className="h-4 w-4" /> Join Active Call
            </Button>
          ) : isInCall ? (
            <Button 
              variant="outline"
              size="sm"
              className="text-primary border-primary/20 bg-primary/10 rounded-full pointer-events-none"
            >
              <Video className="h-4 w-4 mr-2" /> In Call
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleStartCall}
                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted"
                title="Voice Call"
              >
                <Phone className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleStartCall}
                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted"
                title="Video Call"
              >
                <Video className="h-5 w-5" />
              </Button>
            </div>
          )}
          
          <div className="h-4 w-[1px] bg-border mx-1" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 p-0 hover:bg-muted/50 transition-colors">
                    <Settings className="h-5 w-5 opacity-70" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-modal border-border shadow-2xl p-1">
                <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat Settings</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                
                <DropdownMenuItem onClick={() => navigate(`/profile/${partnerId}`)} className="cursor-pointer gap-2 py-2 px-3 focus:bg-primary/10 transition-colors">
                    <User className="h-4 w-4 text-primary" />
                    <span>View Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="cursor-pointer gap-2 py-2 px-3 transition-colors">
                    <Search className="h-4 w-4" />
                    <span>Search in Chat</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="cursor-pointer gap-2 py-2 px-3 transition-colors">
                    <BellOff className="h-4 w-4" />
                    <span>Mute Notifications</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-border/50" />
                
                <DropdownMenuItem onClick={handleDeleteChat} className="text-destructive focus:bg-destructive/10 cursor-pointer gap-2 py-2 px-3 transition-colors">
                    <Trash2 className="h-4 w-4" />
                    <span>Clear Chat History</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="text-destructive focus:bg-red-500/10 cursor-pointer gap-2 py-2 px-3 transition-colors">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Report User</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 scrollbar-hide"
          >
            {loadingMore && hasMore && (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {visibleMessages.map((message, idx) => {
                const isSender = message.sender_id === user?.id;
                const isLatestRead = idx === lastReadIndexSentByMe;
                const messageDate = new Date(message.created_at);
                const prevMessage = idx > 0 ? visibleMessages[idx - 1] : null;
                const showDateSeparator = !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

                return (
                  <Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-8">
                      <div className="px-3 py-1 rounded-full bg-muted/50 border border-border/50 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {getDateLabel(messageDate)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div 
                  ref={observeMessage}
                  data-message-id={message.id}
                  data-unread={!message.is_read && !message.read_at}
                  data-sender-id={message.sender_id}
                  className={`flex items-start gap-2 my-2 ${isSender ? 'flex-row-reverse pl-12' : 'pr-12'}`}
                >
                  <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                    <AvatarImage src={message.sender_profile?.avatar_url} />
                    <AvatarFallback>{message.sender_profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`flex ${isSender ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 group relative`}>
                      <div className={`relative transition-all duration-300 ${message.is_deleted ? 'bg-muted/50 border border-dashed border-border/50 p-3 rounded-2xl italic text-muted-foreground' : (message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::') || message.content.startsWith('VENDOR_SHARE::') || message.content.startsWith('JOB_SHARE::') || message.content.startsWith('PROJECT_SHARE::') || message.content.startsWith('DISCUSSION_SHARE::') ? 'p-0 bg-transparent rounded-2xl border border-border/10 overflow-hidden' : `${isSender ? 'bg-primary text-primary-foreground font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md' : 'bg-muted text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md'}`)}`}>
                        {!message.is_deleted && (
                          <div className={`absolute top-1/2 -translate-y-1/2 ${isSender ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 px-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36">
                                <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                  <Reply className="h-4 w-4 mr-2" /> Reply
                                </DropdownMenuItem>
                                {isSender && (
                                  <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" /> Undo
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleHideMessage(message.id)} className="text-destructive">
                                  <ShieldAlert className="h-4 w-4 mr-2" /> Delete for Me
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                        {message.replied_to_message && !message.is_deleted && (
                          <div className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 ${isSender ? 'bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground' : 'bg-muted/50 border-primary/30 text-foreground'}`}>
                            <div className={`font-semibold text-[10px] mb-1 ${getUserColor(message.replied_to_message.sender_profile?.full_name || 'User')}`}>
                              {message.replied_to_message.sender_profile?.full_name || 'User'}
                            </div>
                            <div className="opacity-90 line-clamp-1">
                              {message.replied_to_message.is_deleted ? <em>This message was deleted</em> : (
                                message.replied_to_message.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                                message.replied_to_message.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                                message.replied_to_message.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                                message.replied_to_message.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                                message.replied_to_message.content.startsWith('JOB_SHARE::') ? 'Shared a job' :
                                message.replied_to_message.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                                message.replied_to_message.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                                message.replied_to_message.content
                              )}
                            </div>
                          </div>
                        )}
                        {message.is_deleted ? (
                          <p className="text-sm italic text-muted-foreground flex items-center gap-1">
                            <ShieldBan className="h-3.5 w-3.5" /> This message was deleted
                          </p>
                        ) : (
                          <>
                            {message.content.startsWith('POST_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                                  return <PostShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.startsWith('MARKETPLACE_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('MARKETPLACE_SHARE::', ''));
                                  return <MarketplaceShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.startsWith('ANNOUNCEMENT_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('ANNOUNCEMENT_SHARE::', ''));
                                  return <AnnouncementShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.startsWith('VENDOR_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('VENDOR_SHARE::', ''));
                                  return <VendorShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.startsWith('PROJECT_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('PROJECT_SHARE::', ''));
                                  return <ProjectShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.startsWith('DISCUSSION_SHARE::') ? (
                              (() => {
                                try {
                                  const shareData = JSON.parse(message.content.replace('DISCUSSION_SHARE::', ''));
                                  return <DiscussionShareCard {...shareData} />;
                                } catch (e) {
                                  return <p className="text-sm break-words">{message.content}</p>;
                                }
                              })()
                            ) : message.content.includes('JOB_SHARE::') ? (
                              (() => {
                                try {
                                  const parts = message.content.split('JOB_SHARE::');
                                  const caption = parts[0].trim();
                                  const jsonStr = parts[parts.length - 1].trim();
                                  const shareData = JSON.parse(jsonStr);
                                  return (
                                    <div className="space-y-2">
                                      {caption && <p className="text-sm px-3 pt-2">{caption}</p>}
                                      <JobShareCard {...shareData} />
                                    </div>
                                  );
                                } catch (e) {
                                  return <p className="text-sm break-words px-3 pt-2">{message.content}</p>;
                                }
                              })()
                            ) : (
                              <p className="text-sm break-words">{message.content}</p>
                            )}
                          </>
                        )}
                      </div>

                      {!message.is_deleted && (
                        <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap mb-1">
                          {formatTimestamp(message.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isSender && isLatestRead && (
                  <div className="flex justify-end pr-10 mb-4 -mt-1.5">
                    <span className="text-[10px] text-primary/60 font-medium tracking-tight animate-in fade-in slide-in-from-top-1 duration-500">
                      {partnerId ? 'Seen' : `Seen by ${partnerName}`}
                    </span>
                  </div>
                )}
                </Fragment>
                );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className={cn(
            "border-t border-border flex flex-col relative bg-background transition-all duration-300",
            isKeyboardVisible ? "pb-0" : "pb-[calc(env(safe-area-inset-bottom)+5px)] lg:pb-0"
          )}>
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 z-10 left-2">
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>
            )}
            
            {replyingTo && (
              <div className="bg-muted px-4 py-2 flex items-center justify-between border-b border-border text-xs">
                <div className="flex-1 overflow-hidden pr-2">
                  <div className={`font-semibold mb-0.5 ${getUserColor(replyingTo.sender_id)}`}>
                    Replying to {replyingTo.sender_profile?.full_name || 'User'}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {replyingTo.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                     replyingTo.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                     replyingTo.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                     replyingTo.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                     replyingTo.content.startsWith('JOB_SHARE::') ? 'Shared a job' :
                     replyingTo.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                     replyingTo.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                     replyingTo.content}
                  </div>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 rounded-full hover:bg-background text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-3 pb-safe-offset-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="rounded-full"
              >
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 rounded-full"
                autoComplete="off"
              />
              <Button type="submit" size="icon" className="rounded-full" disabled={!newMessage.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default EnhancedRealTimeChat;

