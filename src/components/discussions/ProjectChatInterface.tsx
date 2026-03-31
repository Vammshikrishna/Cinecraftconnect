import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Video, MoreVertical, Reply, Trash2, ShieldBan, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCall } from '@/hooks/useCall';
import { LiveKitCallContainer } from '@/components/calls/LiveKitCallContainer';
import { MessageComposer } from './MessageComposer';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';
import { ProjectShareCard } from '@/components/chat/ProjectShareCard';
import { DiscussionShareCard } from '@/components/chat/DiscussionShareCard';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';


interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  deleted_for_users?: string[];
}

interface ProjectChatInterfaceProps {
  projectId: string;
}

export const ProjectChatInterface = ({ projectId }: ProjectChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inCall, setInCall] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { markAsRead } = useChatReadStatus();
  // const [isKeyLoading, setIsKeyLoading] = useState(false); // Unused for now


  // Use spaceId for the call room, as RLS policies expect project_space_id
  const { activeCall, loading, startCall, joinCall } = useCall('project', spaceId || '');

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
        console.log('No project space found. checking ownership to auto-create...');
        // We already fetched projectData above

        if (projectData && user && projectData.creator_id === user.id) {
          console.log('User is creator. Creating default space...');
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

  useEffect(() => {
    if (!spaceId) return;

    fetchMessages();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  useEffect(() => {
    scrollToBottom();
    // Also mark as read when messages are loaded/updated
    if (spaceId && messages.length > 0) {
      markAsRead('project', spaceId);
    }
  }, [messages, spaceId, markAsRead]);


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

  const handleLeaveCall = () => {
    setInCall(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If in call, show call interface
  if (inCall && activeCall) {
    return (
      <LiveKitCallContainer
        roomId={spaceId || projectId}
        onLeave={handleLeaveCall}
        roomName={projectName || 'Project Call'}
        projectId={projectId}
      />
    );
  }

  // Otherwise show chat interface
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap justify-between items-center p-4 border-b border-border gap-2">
        <h2 className="text-lg font-semibold">Project Chat</h2>
        <div className="flex gap-2 items-center">
          {activeCall ? (
            <Button size="sm" variant="default" onClick={handleJoinCall} disabled={loading}>
              <Video className="h-4 w-4 mr-2" />Join Call
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
          messages.filter(m => !m.deleted_for_users?.includes(user?.id || '')).map((message) => {
            const isOwn = message.user_id === user?.id;
            return (
              <div key={message.id} className={`flex gap-3 mb-4 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={message.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {message.profiles?.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%] relative`}>
                  <div className={`${(message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::') || message.content.startsWith('VENDOR_SHARE::') || message.content.startsWith('PROJECT_SHARE::') || message.content.startsWith('DISCUSSION_SHARE::')) ? 'p-0 bg-transparent' : `rounded-lg p-3 ${message.is_deleted ? 'bg-muted/50 border border-border' : isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}`}>
                    {!isOwn && (
                      <p className="text-xs font-semibold mb-1 opacity-80">
                        {message.profiles?.full_name || 'Unknown User'}
                      </p>
                    )}
                    
                    {message.reply_to_id && !message.is_deleted && (() => {
                      const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                      if (!repliedMsg) return null;
                      return (
                        <div className={`mb-2 p-2 rounded-lg text-xs border ${isOwn ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background/50 border-border'}`}>
                          <div className="font-semibold text-[10px] mb-1 opacity-75">
                            {repliedMsg.profiles?.full_name || 'User'}
                          </div>
                          <div className="opacity-90 line-clamp-1">
                            {repliedMsg.is_deleted ? <em>This message was deleted</em> : (
                              repliedMsg.content.startsWith('POST_SHARE::') ? 'Shared a post' :
                              repliedMsg.content.startsWith('MARKETPLACE_SHARE::') ? 'Shared a listing' :
                              repliedMsg.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'Shared an announcement' :
                              repliedMsg.content.startsWith('VENDOR_SHARE::') ? 'Shared a vendor' :
                              repliedMsg.content.startsWith('PROJECT_SHARE::') ? 'Shared a project' :
                              repliedMsg.content.startsWith('DISCUSSION_SHARE::') ? 'Shared a discussion' :
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
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                  </div>
                  
                  {!message.is_deleted && (
                    <div className={`absolute ${isOwn ? 'right-full mr-2' : 'left-full ml-2'} top-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 text-muted-foreground hover:bg-muted rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-40">
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

                  <span className="text-xs text-muted-foreground mt-1">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border flex flex-col bg-background">
        {replyingTo && (
          <div className="bg-muted px-4 py-2 flex items-center justify-between border-b border-border text-xs">
            <div className="flex-1 overflow-hidden pr-2">
              <div className="font-semibold text-primary mb-0.5">
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
        <div className="p-4">
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
