import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MoreVertical, Reply, Trash2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageComposer } from './MessageComposer';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';
import { VendorShareCard } from '@/components/chat/VendorShareCard';
import { ProjectShareCard } from '@/components/chat/ProjectShareCard';
import { DiscussionShareCard } from '@/components/chat/DiscussionShareCard';
import { ProfileShareCard } from '@/components/chat/ProfileShareCard';
import { PitchShareCard } from '@/components/chat/PitchShareCard';
import { CompanyShareCard } from '@/components/chat/CompanyShareCard';
import { ContentShareCard } from '@/components/chat/ContentShareCard';
import { JobShareCard } from '@/components/chat/JobShareCard';
import { useMessageSeen } from '@/hooks/useMessageSeen';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { useAppRole } from '@/hooks/useAppRole';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_deleted: boolean | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  profiles: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  deleted_for_users: string[] | null;
}

interface ProjectChatInterfaceProps {
  projectId: string;
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
  const { isInternal } = useAppRole();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { observeMessage } = useMessageSeen('project_messages');
  const [readStatuses, setReadStatuses] = useState<any[]>([]);
  const { markAsRead } = useChatReadStatus();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // const [isKeyLoading, setIsKeyLoading] = useState(false); // Unused for now

  useEffect(() => {
    const fetchSpaceId = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('project_spaces')
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


      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      if (data) {
        setSpaceId(data.id);
      } else {

        // We already fetched projectData above

        if (projectData && user && projectData.creator_id === user.id) {

          const { data: newSpace, error: createError } = await supabase
            .from('project_spaces')
            .insert({
              project_id: projectId,
              name: 'General'
            })
            .select()
            .single();

          if (!createError && newSpace) {
            setSpaceId(newSpace.id);
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
      if (!user || !spaceId || isInternal) return;
      
      // Check if already a member
      const { data: existing, error: fetchError } = await supabase
        .from('project_space_members')
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
          .from('project_space_members')
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
      const { data, error } = await (supabase.from('project_space_message_read_status') as any)
        .select('user_id, last_read_at')
        .eq('project_space_id', spaceId);
      
      if (error) {
        console.error('Error fetching read statuses:', error);
        return;
      }

      if (data && data.length > 0) {
        const userIds = data.map((rs: any) => rs.user_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
          
        const enrichedData = data.map((rs: any) => ({
          ...rs,
          profiles: profileData?.find((p: any) => p.id === rs.user_id) || { full_name: 'Unknown User' }
        }));
        setReadStatuses(enrichedData);
      } else {
        setReadStatuses([]);
      }
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
        fetchMessages(false);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_space_message_read_status',
        filter: `project_space_id=eq.${spaceId}`
      }, () => {
        fetchReadStatuses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  // Handle scroll to top for pagination
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMessages || !hasMore) return;
    
    const { scrollTop } = scrollContainerRef.current;
    if (scrollTop < 100) {
      loadMoreMessages();
    }
  }, [loadingMessages, hasMore, spaceId]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      if (behavior === 'smooth') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom('auto');
        isInitialLoad.current = false;
      } else {
        // If we just loaded more messages at the top, preserve scroll position
        if (scrollContainerRef.current && lastScrollHeight.current > 0) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          const heightDiff = newScrollHeight - lastScrollHeight.current;
          scrollContainerRef.current.scrollTop += heightDiff;
          lastScrollHeight.current = 0;
        } else {
          // If a new message arrived at the bottom
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (user && spaceId && messages.length > 0) {
      markAsRead('project', spaceId);
    }
  }, [spaceId, messages.length, markAsRead, user]);

  const fetchMessages = async (isNewRoom = true) => {
    if (!spaceId) return;

    if (isNewRoom) {
      setLoadingMessages(true);
      isInitialLoad.current = true;
    }

    const { data, error } = await supabase
      .from('project_space_messages')
      .select(`
        id,
        content,
        user_id,
        created_at,
        is_deleted,
        reply_to_id,
        deleted_for_users,
        profiles!user_id (
          username,
          full_name,
          avatar_url
        ),
        attachment_url,
        attachment_type
      `)
      .eq('project_space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      const fetchedMessages = data || [];
      const sortedMessages = [...fetchedMessages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sortedMessages);
      setHasMore(fetchedMessages.length === 30);
    }
    setLoadingMessages(false);
  };

  const loadMoreMessages = async () => {
    if (!spaceId || loadingMessages || !hasMore || messages.length === 0) return;

    setLoadingMessages(true);
    lastScrollHeight.current = scrollContainerRef.current?.scrollHeight || 0;

    const oldestMessageTimestamp = messages[0].created_at;

    const { data, error } = await supabase
      .from('project_space_messages')
      .select(`
        id,
        content,
        user_id,
        created_at,
        is_deleted,
        reply_to_id,
        deleted_for_users,
        profiles!user_id (
          username,
          full_name,
          avatar_url
        ),
        attachment_url,
        attachment_type
      `)
      .eq('project_space_id', spaceId)
      .lt('created_at', oldestMessageTimestamp)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error loading more messages:', error);
    } else {
      const fetchedMessages = data || [];
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
    setLoadingMessages(false);
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleSendMessage = async (content: string, file?: File | null) => {
    if ((!content.trim() && !file) || sending || !user || !spaceId) return;

    setSending(true);
    setIsUploading(true);
    try {
      let attachmentUrl = null;
      let attachmentType = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'other';
      }

      const { error } = await supabase
        .from('project_space_messages')
        .insert([{
          project_space_id: spaceId,
          user_id: user?.id,
          content: content.trim() || `Shared ${attachmentType === 'image' ? 'an image' : attachmentType === 'video' ? 'a video' : 'a file'}`,
          reply_to_id: replyingTo?.id || null,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType
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
      setIsUploading(false);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('project_space_messages')
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






  const renderMessageContent = (message: Message) => {
    const { content, attachment_url, attachment_type } = message;
    return (
      <div className="space-y-2">
        {attachment_url && (
          <div className={cn(
            "mb-1 rounded-lg overflow-hidden",
            (attachment_type === 'image' || attachment_type === 'video') ? "" : "bg-black/5 dark:bg-white/5 border border-white/10"
          )}>
            {attachment_type === 'image' ? (
              <img 
                src={attachment_url} 
                alt="Attachment" 
                className="max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                onClick={() => setSelectedImage(attachment_url)}
              />
            ) : attachment_type === 'video' ? (
              <div className="relative group cursor-pointer" onClick={() => setSelectedImage(attachment_url)}>
                <video 
                  src={attachment_url} 
                  className="max-w-full h-auto max-h-[300px]"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center text-black">
                    <Reply className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ) : (
              <a 
                href={attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 text-primary hover:bg-primary/5 transition-colors"
              >
                <MoreVertical className="h-8 w-8" />
                <span className="text-xs font-bold uppercase tracking-wider">View Attachment</span>
              </a>
            )}
          </div>
        )}
        {content.startsWith('POST_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('POST_SHARE::', ''));
              return <PostShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('MARKETPLACE_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('MARKETPLACE_SHARE::', ''));
              return <MarketplaceShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('ANNOUNCEMENT_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('ANNOUNCEMENT_SHARE::', ''));
              return <AnnouncementShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('VENDOR_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('VENDOR_SHARE::', ''));
              return <VendorShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('PROJECT_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('PROJECT_SHARE::', ''));
              return <ProjectShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('PROFILE_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('PROFILE_SHARE::', ''));
              return <ProfileShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('PITCH_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('PITCH_SHARE::', ''));
              return <PitchShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('COMPANY_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('COMPANY_SHARE::', ''));
              return <CompanyShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : (content.startsWith('DISCUSSION_SHARE::') || content.startsWith('ROOM_SHARE::')) ? (
          (() => {
            try {
              const prefix = content.startsWith('DISCUSSION_SHARE::') ? 'DISCUSSION_SHARE::' : 'ROOM_SHARE::';
              const shareData = JSON.parse(content.replace(prefix, ''));
              return <DiscussionShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.startsWith('CONTENT_SHARE::') ? (
          (() => {
            try {
              const shareData = JSON.parse(content.replace('CONTENT_SHARE::', ''));
              return <ContentShareCard {...shareData} />;
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : content.includes('JOB_SHARE::') ? (
          (() => {
            try {
              const parts = content.split('JOB_SHARE::');
              const caption = parts[0].trim();
              const jsonStr = parts[parts.length - 1].trim();
              const shareData = JSON.parse(jsonStr);
              return (
                <div className="space-y-2">
                  {caption && <p className="text-sm px-3 pt-2">{caption}</p>}
                  <JobShareCard {...shareData} />
                </div>
              );
            } catch { return <p className="text-sm break-words whitespace-pre-wrap">{content}</p>; }
          })()
        ) : (content && content !== 'Shared an image' && content !== 'Shared a video' && content !== 'Shared a file') ? (
          <p className="text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">{content}</p>
        ) : null}
      </div>
    );
  };

  const isShareContent = (content: string) =>
    content.startsWith('POST_SHARE::') ||
    content.startsWith('MARKETPLACE_SHARE::') ||
    content.startsWith('ANNOUNCEMENT_SHARE::') ||
    content.startsWith('VENDOR_SHARE::') ||
    content.startsWith('PROJECT_SHARE::') ||
    content.startsWith('DISCUSSION_SHARE::') ||
    content.startsWith('ROOM_SHARE::') ||
    content.startsWith('PROFILE_SHARE::') ||
    content.startsWith('PITCH_SHARE::') ||
    content.startsWith('COMPANY_SHARE::') ||
    content.startsWith('CONTENT_SHARE::') ||
    content.includes('JOB_SHARE::');

  const { isEmojiPickerOpen } = useKeyboard();

  // Otherwise show chat interface
  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Global call handles everything now, no local LiveKitCallContainer needed here */}


      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {loadingMessages && hasMore && (
          <div className="flex justify-center py-2">
            <LoadingSpinner size="sm" />
          </div>
        )}
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
                    <div className={cn(
                      "relative transition-all duration-300",
                      message.is_deleted ? "bg-muted/50 border border-dashed border-border/50 p-3 rounded-[22px] italic text-muted-foreground" :
                      isShare ? "p-0 bg-transparent overflow-hidden rounded-2xl border border-border/10" :
                      (message.attachment_url && (!message.content || message.content === 'Shared an image' || message.content === 'Shared a video' || message.content === 'Shared a file')) ? "p-0 bg-transparent rounded-xl overflow-hidden shadow-xl" :
                      isOwn ? "bg-primary text-primary-foreground font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md" :
                      "bg-muted text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md"
                    )}>
                      {!isOwn && !message.is_deleted && (
                        <p className={`text-[11px] font-bold mb-1 ${getUserColor(message.user_id)}`}>
                          {message.profiles?.username || message.profiles?.full_name || 'User'}
                        </p>
                      )}

                      {message.reply_to_id && !message.is_deleted && (() => {
                        const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                        if (!repliedMsg) return null;
                        return (
                          <div className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 ${isOwn ? 'bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground' : 'bg-muted/50 border-primary/30 text-foreground'}`}>
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
                        <p className="text-sm italic opacity-70 flex items-center gap-1.5 py-0.5">
                          This message was deleted
                        </p>
                      ) : (
                        renderMessageContent(message)
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

      <div className={cn(
        "border-t border-border flex flex-col transition-colors duration-300",
        isEmojiPickerOpen ? "bg-[#161618]" : "bg-background"
      )}>
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
      <div className="p-0 border-t border-border">{isInternal ? (
            <div className="p-4 bg-muted/30 text-center text-xs text-muted-foreground italic border-t border-border/50">
              Internal staff cannot send messages in project spaces.
            </div>
          ) : (
            <MessageComposer
              onSend={handleSendMessage}
              disabled={sending}
              isUploading={isUploading}
            />
          )}
        </div>
      </div>
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent hideClose className="!p-0 !border-none !bg-transparent !shadow-none !max-w-none !w-screen !h-screen !left-0 !top-0 !translate-x-0 !translate-y-0 outline-none !z-[1001]">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Full size view of the shared image</DialogDescription>
          </DialogHeader>
          <div 
            className="w-full h-full flex items-center justify-center bg-transparent cursor-zoom-out"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh] cursor-default" onClick={(e) => e.stopPropagation()}>
              {selectedImage && (
                <img 
                  src={selectedImage} 
                  alt="Full preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                />
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-3 -right-3 bg-black/50 hover:bg-black/80 text-white rounded-full h-8 w-8 z-[1100] transition-all shadow-lg border border-white/20"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectChatInterface;

