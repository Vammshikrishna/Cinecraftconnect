import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Video, MoreVertical, Reply, Trash2, ShieldBan, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useGlobalCall } from '@/contexts/CallContext';
import { MessageComposer } from './MessageComposer';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';
import { ProjectShareCard } from '@/components/chat/ProjectShareCard';
import { DiscussionShareCard } from '@/components/chat/DiscussionShareCard';
import { useMessageSeen } from '@/hooks/useMessageSeen';


interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  deleted_for_users?: string[];
}

interface ProjectChatInterfaceProps {
  projectId: string;
}

const SENDER_COLORS = [
  'text-blue-700 dark:text-blue-300',
  'text-emerald-700 dark:text-emerald-300',
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

const getDateLabel = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return format(date, 'p');
};

export const ProjectChatInterface = ({ projectId }: ProjectChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { observeMessage } = useMessageSeen('project_messages');
  const [readStatuses, setReadStatuses] = useState<any[]>([]);
  // const [isKeyLoading, setIsKeyLoading] = useState(false); // Unused for now


  // Global Call state
  const { callState, startCall: startGlobalCall } = useGlobalCall();
  const isInCall = callState.isActive && callState.roomId === spaceId;
  const loading = false; // Simplified for now as context handles it

  useEffect(() => {
    const fetchSpaceId = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('project_spaces' as any)
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching project space:', error);
        return;
      }

      // Fetch project details (title) independently
      const { data: projectData } = await supabase
        .from('projects')
        .select('title, creator_id')
        .eq('id', projectId)
        .single();

      if (projectData) {
        setProjectName(projectData.title);
      }

      if (data) {
        setSpaceId((data as any).id);
      } else {

        // We already fetched projectData above

        if (projectData && user && projectData.creator_id === user.id) {

          const { data: newSpace, error: createError } = await supabase
            .from('project_spaces' as any)
            .insert({
              project_id: projectId,
              name: 'General'
            })
            .select()
            .single();

          if (!createError && newSpace) {
            setSpaceId((newSpace as any).id);
            toast({ title: "Fixed", description: "Project space created automatically." });
          } else {
            console.error('Failed to create space:', createError);
          }
        } else {
          console.error('No project space found and user is not creator.');
        }
      }
    };
    fetchSpaceId();
  }, [projectId, user]);

  // Auto-join project space membership
  useEffect(() => {
    if (!spaceId || !user) return;

    const ensureMembership = async () => {
      if (!user || !spaceId) return;
      
      // Check if already a member
      const { data: existing, error: fetchError } = await supabase
        .from('project_space_members' as any)
        .select('user_id')
        .eq('project_space_id', spaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error checking project membership:', fetchError);
        return;
      }

      if (!existing) {
        // If not a member, check if they are the owner or an applicant to grant access
        // (For now, keeping it simple: anyone who can access the space UI gets added as a member)
        const { error: insertError } = await supabase
          .from('project_space_members' as any)
          .insert({ 
            project_space_id: spaceId, 
            user_id: user.id 
          });

        if (insertError) {
          console.error('Error auto-joining project space:', insertError);
        }
      }
    };

    ensureMembership();
  }, [spaceId, user]);

  useEffect(() => {
    if (!spaceId) return;

    const fetchReadStatuses = async () => {
      if (!spaceId) return;
      const { data } = await supabase
        .from('project_message_read_status' as any)
        .select('user_id, last_read_at, profiles:user_id(full_name)')
        .eq('project_space_id', spaceId);
      if (data) setReadStatuses(data as any[]);
    };

    fetchMessages();
    fetchReadStatuses();

    const channel = supabase
      .channel(`project_messages:${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_space_messages',
        filter: `project_space_id=eq.${spaceId}`
      }, () => {
        fetchMessages();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_message_read_status',
        filter: `project_space_id=eq.${spaceId}`
      }, () => {
        fetchReadStatuses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const fetchMessages = async () => {
    if (!spaceId) return;

    const { data, error } = await supabase
      .from('project_space_messages' as any)
      .select(`
        id,
        content,
        user_id,
        created_at,
        is_deleted,
        reply_to_id,
        deleted_for_users,
        profiles:user_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('project_space_id', spaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages((data as any) || []);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || sending || !user) return;

    setSending(true);
    try {
      const contentToSend = content.trim();

      const { error } = await supabase
        .from('project_space_messages' as any)
        .insert([{
          project_space_id: spaceId,
          user_id: user?.id,
          content: contentToSend,
          reply_to_id: replyingTo?.id || null
        }]);

      if (error) throw error;
      setReplyingTo(null);
      fetchMessages(); // Refresh UI immediately after sending
    } catch (err: any) {
      console.error('Send message error:', err);
      toast({
        title: "Error",
        description: err.message || err.error_description || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('project_space_messages' as any)
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

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
      p_table: 'project_space_messages',
      p_message_id: messageId
    });

    if (error) {
      console.error('Error hiding message:', error);
      toast({ title: "Error", description: "Failed to hide message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const handleAttach = async (file: File) => {
    if (!user || !projectId) return;
    setSending(true);
    try {
      // Upload file reference
      const contentToInsert = `Shared a file: ${file.name}`;

      // Send message with file reference
      const { error: msgError } = await supabase
        .from('project_space_messages' as any)
        .insert({
          project_space_id: spaceId,
          user_id: user.id,
          content: contentToInsert
        });

      if (msgError) throw msgError;

      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };



  const handleStartCall = async () => {
    if (!spaceId) return;
    const success = await startGlobalCall('project', spaceId, projectName || 'Project Call');
    if (!success) {
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive"
      });
    }
  };


  const renderMessageContent = (content: string) => {
    if (content.startsWith('POST_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('POST_SHARE::', ''));
        return <PostShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('MARKETPLACE_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('MARKETPLACE_SHARE::', ''));
        return <MarketplaceShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('ANNOUNCEMENT_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('ANNOUNCEMENT_SHARE::', ''));
        return <AnnouncementShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('VENDOR_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('VENDOR_SHARE::', ''));
        return <VendorShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('PROJECT_SHARE::')) {
      try {
        const shareData = JSON.parse(content.replace('PROJECT_SHARE::', ''));
        return <ProjectShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    if (content.startsWith('DISCUSSION_SHARE::') || content.startsWith('ROOM_SHARE::')) {
      try {
        const prefix = content.startsWith('DISCUSSION_SHARE::') ? 'DISCUSSION_SHARE::' : 'ROOM_SHARE::';
        const shareData = JSON.parse(content.replace(prefix, ''));
        return <DiscussionShareCard {...shareData} />;
      } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
    }
    return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>;
  };

  const isShareContent = (content: string) =>
    content.startsWith('POST_SHARE::') ||
    content.startsWith('MARKETPLACE_SHARE::') ||
    content.startsWith('ANNOUNCEMENT_SHARE::') ||
    content.startsWith('VENDOR_SHARE::') ||
    content.startsWith('PROJECT_SHARE::') ||
    content.startsWith('DISCUSSION_SHARE::') ||
    content.startsWith('ROOM_SHARE::');

  // Otherwise show chat interface
  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden relative">

      {/* Global call handles everything now, no local LiveKitCallContainer needed here */}

      <div className="flex flex-wrap justify-between items-center p-4 border-b border-border gap-2 shrink-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h2 className="text-lg font-semibold">Project Chat</h2>
        <div className="flex gap-2 items-center">
          {isInCall ? (
            <Button size="sm" variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10 pointer-events-none">
              <Video className="h-4 w-4 mr-2" />In Call
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleStartCall} disabled={loading}>
                <Phone className="h-4 w-4 mr-2" />Call
              </Button>
              <Button size="sm" variant="outline" onClick={handleStartCall} disabled={loading}>
                <Video className="h-4 w-4 mr-2" />Video
              </Button>
            </>
          )}

          {/* Chat history deletion moved to Project Settings */}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          (() => {
            const visibleMessages = messages.filter(m => !m.deleted_for_users?.includes(user?.id || ''));
            return visibleMessages.map((message, idx) => {
              const isOwn = message.user_id === user?.id;
              const isShare = isShareContent(message.content);
              const messageDate = new Date(message.created_at);
              const prevMessage = idx > 0 ? visibleMessages[idx - 1] : null;
              const showDateSeparator = !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

            // Calculate who seen this message in project space
            const currentReadBy = readStatuses.filter(rs => {
              if (rs.user_id === user?.id) return false;
              try {
                const statusTime = new Date(rs.last_read_at).getTime();
                const messageTime = new Date(message.created_at).getTime();
                return statusTime >= messageTime;
              } catch (e) { return false; }
            }).map(rs => rs.profiles?.full_name?.split(' ')[0] || 'User');
            
            // Only show reading indicator for the latest message read by each user to avoid clutter
            const uniqueSeenBy = currentReadBy.filter(name => {
              const userStatus = readStatuses.find(rs => (rs.profiles?.full_name?.split(' ')[0] || 'User') === name);
              if (!userStatus) return false;
              const statusTime = new Date(userStatus.last_read_at).getTime();
              const messageTime = new Date(message.created_at).getTime();
              
              // Find if there's any newer message that this user has also read
              const isLatest = !visibleMessages.some((m, mIdx) => {
                if (mIdx <= idx) return false;
                return statusTime >= new Date(m.created_at).getTime();
              });
              return isLatest;
            });

            return (
              <React.Fragment key={message.id}>
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
                data-sender-id={message.user_id}
                className={`flex gap-3 mb-2 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-9 w-9 flex-shrink-0 shadow-sm border border-border/10">
                  <AvatarImage src={message.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-sm font-bold bg-secondary text-secondary-foreground">
                    {message.profiles?.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] relative`}>
                  <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 group relative`}>
                    <div className={`${(isShare && !message.is_deleted) ? 'p-0 bg-transparent' : `rounded-2xl p-3 shadow-sm ${message.is_deleted ? 'bg-muted/50 border border-border' : isOwn ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted'}`}`}>
                      {!isOwn && !message.is_deleted && (
                        <p className={`text-[11px] font-bold mb-1 ${getUserColor(message.user_id)}`}>
                          {message.profiles?.username || message.profiles?.full_name || 'User'}
                        </p>
                      )}

                      {message.reply_to_id && !message.is_deleted && (() => {
                        const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                        if (!repliedMsg) return null;
                        return (
                          <div className={`mb-2 p-2 rounded-lg text-xs border ${isOwn ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background/50 border-border'}`}>
                            <div className={`font-semibold text-[10px] mb-1 ${getUserColor(repliedMsg.user_id)}`}>
                              {repliedMsg.profiles?.username || repliedMsg.profiles?.full_name || 'User'}
                            </div>
                            <div className="opacity-90 line-clamp-1">
                              {repliedMsg.is_deleted ? <em>This message was deleted</em> : (
                                repliedMsg.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                                  repliedMsg.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                                    repliedMsg.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                                      repliedMsg.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                                        repliedMsg.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                                          repliedMsg.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
                                            repliedMsg.content.startsWith('ROOM_SHARE::') ? 'Shared a room' :
                                              repliedMsg.content
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {message.is_deleted ? (
                        <p className="text-sm italic text-muted-foreground flex items-center gap-1">
                          <ShieldBan className="h-3.5 w-3.5" /> This message was deleted
                        </p>
                      ) : (
                        renderMessageContent(message.content)
                      )}
                    </div>

                    {!message.is_deleted && (
                      <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap mb-1">
                        {formatTimestamp(message.created_at)}
                      </span>
                    )}

                    {!message.is_deleted && (
                      <div className={`opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 px-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-36">
                            <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                              <Reply className="h-4 w-4 mr-2" /> Reply
                            </DropdownMenuItem>
                            {isOwn && (
                              <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                <Trash2 className="h-4 w-4 mr-2" /> Undo
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleHideMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                              <X className="h-4 w-4 mr-2" /> Delete for Me
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isOwn && uniqueSeenBy.length > 0 && (
                <div className="flex justify-end pr-12 mb-4 -mt-1">
                  <span className="text-[10px] text-primary/60 font-medium tracking-tight">
                    Seen by {uniqueSeenBy.join(', ')}
                  </span>
                </div>
              )}
              </React.Fragment>
            );
          })
        })()
      )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border flex flex-col bg-background">
        {replyingTo && (
          <div className="bg-muted px-4 py-2 flex items-center justify-between border-b border-border text-xs">
            <div className="flex-1 overflow-hidden pr-2">
              <div className={`font-semibold mb-0.5 ${getUserColor(replyingTo.user_id)}`}>
                Replying to {replyingTo.profiles?.full_name || 'User'}
              </div>
              <div className="text-muted-foreground truncate">
                {replyingTo.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                  replyingTo.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                    replyingTo.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                      replyingTo.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
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
        <div className="pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-4">
          <MessageComposer
            onSend={handleSendMessage}
            onAttach={handleAttach}
            disabled={sending}
          />
        </div>
      </div>
    </div>
  );
};
