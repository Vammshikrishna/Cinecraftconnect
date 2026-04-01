import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isToday, isYesterday } from 'date-fns';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Video, Phone, Settings, Trash2, Send, ArrowLeft, Smile, X, Reply, ShieldBan, MoreVertical, User, BellOff, ShieldAlert, Search } from 'lucide-react';
import { useCall } from '@/hooks/useCall';
import { useNavigate } from 'react-router-dom';
import { LiveKitCallContainer } from '@/components/calls/LiveKitCallContainer';
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
    } | null;
  } | null;
  sender_profile: {
    full_name: string;
    avatar_url: string;
  } | null;
  deleted_for_users?: string[];
  is_read?: boolean;
}

interface EnhancedRealTimeChatProps {
  roomId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarUrl: string;
  onBackClick: () => void;
}

const EnhancedRealTimeChat = ({ roomId, partnerId, partnerName, partnerAvatarUrl, onBackClick }: EnhancedRealTimeChatProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [inCall, setInCall] = useState(false);
  const { markAsRead } = useChatReadStatus();
  const { toast } = useToast();

  
  const { activeCall, startCall, joinCall, leaveCall, endCall } = useCall('direct', roomId || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { onlineUserIds } = usePresence(); // Uses global presence by default
  const isPartnerOnline = onlineUserIds.includes(partnerId);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await (supabase.rpc as any)('get_messages_for_channel', { p_channel_id: roomId });
    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      setMessages(data as Message[]);
    }
    setLoading(false);
  }, [roomId]);

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
    scrollToBottom();
  }, [messages]);

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
    const call = await startCall();
    if (call) {
      setInCall(true);
    } else {
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleJoinCall = async () => {
    const success = await joinCall();
    if (success) {
      setInCall(true);
    }
  };

  const handleLeaveCall = async () => {
    // For DMs, we generally want to end the call for everyone if we leave, 
    // or at least if we were the initiator.
    if (activeCall?.started_by === user?.id) {
      await endCall();
    } else {
      await leaveCall();
    }
    setInCall(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'p');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  if (inCall && activeCall) {
    return (
      <LiveKitCallContainer
        roomId={roomId}
        onLeave={handleLeaveCall}
        roomName={partnerName || 'Direct Call'}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center justify-between px-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBackClick} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="h-6 w-6" />
          </button>
          {partnerName && (
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={partnerAvatarUrl} />
                <AvatarFallback>{partnerName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h2 className="font-bold text-lg leading-tight">{partnerName}</h2>
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
          {activeCall ? (
            <Button 
                onClick={handleJoinCall} 
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 gap-2 animate-bounce-subtle"
            >
                <Video className="h-4 w-4" /> Join Active Call
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
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 scrollbar-hide">
            {messages.filter(m => !m.deleted_for_users?.includes(user?.id || '')).map((message) => {
              const isSender = message.sender_id === user?.id;
              return (
                <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender_profile?.avatar_url} />
                    <AvatarFallback>{message.sender_profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className={`relative group ${message.is_deleted ? 'bg-muted/50 border border-border' : (message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::') || message.content.startsWith('VENDOR_SHARE::') || message.content.startsWith('JOB_SHARE::') || message.content.startsWith('PROJECT_SHARE::') || message.content.startsWith('DISCUSSION_SHARE::') ? 'p-0 bg-transparent' : `p-3 rounded-2xl ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`)} max-w-[85%] rounded-2xl ${message.is_deleted ? 'p-3' : ''}`}>
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
                      <div className={`mb-2 p-2 rounded-lg text-xs border ${isSender ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background/50 border-border'}`}>
                        <div className="font-semibold text-[10px] mb-1 opacity-75">
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
                    ) : message.content.startsWith('POST_SHARE::') ? (
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
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-muted-foreground/60">{formatTimestamp(message.created_at)}</span>
                    {isSender && message.is_read && (
                      <span className="text-[9px] text-primary font-black uppercase tracking-tighter opacity-80">Seen</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border flex flex-col relative bg-background">
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 z-10 left-2">
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>
            )}
            
            {replyingTo && (
              <div className="bg-muted px-4 py-2 flex items-center justify-between border-b border-border text-xs">
                <div className="flex-1 overflow-hidden pr-2">
                  <div className="font-semibold text-primary mb-0.5">
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
