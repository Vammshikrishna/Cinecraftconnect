import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MoreVertical, Reply, Trash2, X, Smile, Flag, Info, CheckCheck, ChevronDown, Copy, Share2, Check, Star } from 'lucide-react';
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
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { StarredMessagesDialog } from '@/components/chat/StarredMessagesDialog';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
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

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user_profile?: {
    full_name: string;
    avatar_url: string;
  };
}

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
  status?: 'pending' | 'sent' | 'error';
  reactions?: MessageReaction[];
}

interface ProjectChatInterfaceProps {
  projectId: string;
  spaceId?: string;
  isActive?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

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

const getMessagePreviewText = (content: string): string => {
  if (!content) return '';
  if (content.startsWith('POST_SHARE::')) return 'Shared a post';
  if (content.startsWith('MARKETPLACE_SHARE::')) return 'Shared a listing';
  if (content.startsWith('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
  if (content.startsWith('VENDOR_SHARE::')) return 'Shared a vendor';
  if (content.startsWith('PROJECT_SHARE::')) return 'Shared a project';
  if (content.startsWith('DISCUSSION_SHARE::')) return 'Shared a discussion';
  if (content.startsWith('ROOM_SHARE::')) return 'Shared a room';
  if (content.startsWith('COMPANY_SHARE::')) return 'Shared a company profile';
  if (content.startsWith('PROFILE_SHARE::')) return 'Shared a user profile';
  if (content.startsWith('PITCH_SHARE::')) return 'Shared a pitch deck';
  if (content.startsWith('CONTENT_SHARE::')) return 'Shared a video/content';
  if (content.includes('JOB_SHARE::')) return 'Shared a job post';
  return content;
};

const scrollToMessage = (messageId: string) => {
  const element = document.querySelector(`[data-message-id="${messageId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const bubble = element.querySelector('.relative.transition-all.duration-300') || element.querySelector('.rounded-xl') || element.querySelector('[class*="bg-primary"]');
    if (bubble) {
      bubble.classList.add('ring-4', 'ring-primary/40', 'scale-105', 'transition-all');
      setTimeout(() => {
        bubble.classList.remove('ring-4', 'ring-primary/40', 'scale-105');
      }, 1200);
    }
  }
};

export const ProjectChatInterface = ({ projectId, isActive = true }: ProjectChatInterfaceProps) => {
  const { user, profile } = useAuth();
  const { isInternal } = useAppRole();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  const reactionLocksRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(spaceId || '');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const handleBroadcastRead = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'read_update',
        payload: { userId: user?.id }
      }).catch(console.error);
    }
  }, [user?.id]);

  const { observeMessage } = useMessageSeen('project_messages', handleBroadcastRead);
  const [readStatuses, setReadStatuses] = useState<any[]>([]);
  const { markAsRead } = useChatReadStatus();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);

  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`starred_msgs_project_${projectId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showStarredDialog, setShowStarredDialog] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<{ id: string, content: string } | null>(null);

  const handleToggleStarMessages = (targetIds?: string[]) => {
    const idsToToggle = targetIds || selectedMessageIds;
    if (idsToToggle.length === 0) return;

    const allStarred = idsToToggle.every(id => starredMessageIds.has(id));
    setStarredMessageIds(prev => {
      const newSet = new Set(prev);
      if (allStarred) {
        idsToToggle.forEach(id => newSet.delete(id));
      } else {
        idsToToggle.forEach(id => newSet.add(id));
      }

      try {
        localStorage.setItem(`starred_msgs_project_${projectId}`, JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.error('Failed to save starred messages', e);
      }
      return newSet;
    });

    if (targetIds) return; // If called from single message, don't clear selection
    setSelectedMessageIds([]);
    toast({
      title: allStarred ? "Messages Unstarred" : "Messages Starred",
      description: `${idsToToggle.length} message(s) have been ${allStarred ? 'removed from' : 'added to'} your starred messages.`
    });
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const [activeMobileReactionMessageId, setActiveMobileReactionMessageId] = useState<string | null>(null);
  const [swipeMessageId, setSwipeMessageId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSwipingRef = useRef<boolean>(false);

  const handleTouchStart = (messageId: string, isDeleted: boolean) => (e: React.TouchEvent) => {
    if (isDeleted) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isSwipingRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (!isSwipingRef.current) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        setActiveMobileReactionMessageId(messageId);
      }
    }, 500);
  };

  const handleTouchMove = (messageId: string) => (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    if (!isSwipingRef.current && diffX > 10 && Math.abs(diffY) < 15) {
      isSwipingRef.current = true;
      setSwipeMessageId(messageId);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    }

    if (isSwipingRef.current && swipeMessageId === messageId) {
      const offset = Math.max(0, Math.min(diffX, 80));
      setSwipeOffset(offset);
      if (offset >= 55 && swipeOffset < 55) {
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
      }
    }

    if (Math.abs(diffY) > 10 && !isSwipingRef.current) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    }
  };

  const handleTouchEnd = (message: Message) => () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (isSwipingRef.current && swipeMessageId === message.id) {
      if (swipeOffset >= 55) {
        setReplyingTo(message);
      }
    }

    setSwipeOffset(0);
    setSwipeMessageId(null);
    isSwipingRef.current = false;
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMobileReactionMessageId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);
  // const [isKeyLoading, setIsKeyLoading] = useState(false); // Unused for now

  const fetchReactions = async (msgs: Message[]) => {
    const msgIds = msgs.map(m => m.id);
    if (msgIds.length === 0) return msgs;

    const { data, error } = await supabase
      .from('project_space_message_reactions')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .in('message_id', msgIds);

    if (error) {
      console.error('Error fetching reactions:', error);
      return msgs;
    }

    const reactionsMap: Record<string, MessageReaction[]> = {};
    (data || []).forEach(r => {
      if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
      reactionsMap[r.message_id].push({
        id: r.id,
        message_id: r.message_id,
        user_id: r.user_id,
        emoji: r.emoji,
        created_at: r.created_at,
        user_profile: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      });
    });

    return msgs.map(m => ({
      ...m,
      reactions: reactionsMap[m.id] || []
    }));
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    if (reactionLocksRef.current.has(messageId)) return;
    reactionLocksRef.current.add(messageId);

    try {
      let currentReactions: MessageReaction[] = [];
      setMessages(prev => {
        const msg = prev.find(m => m.id === messageId);
        if (msg) currentReactions = msg.reactions || [];
        return prev;
      });

      const existingReaction = currentReactions.find(r => r.emoji === emoji && r.user_id === user.id);
      const isTogglingOff = !!existingReaction;

      const optimisticId = `temp-react-${Date.now()}`;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === messageId);
        if (idx === -1) return prev;
        const updated = [...prev];
        let newReactions = [...(updated[idx].reactions || [])].filter(r => r.user_id !== user.id);

        if (!isTogglingOff) {
          newReactions.push({
            id: optimisticId,
            message_id: messageId,
            user_id: user.id,
            emoji: emoji,
            created_at: new Date().toISOString(),
            user_profile: profile ? { full_name: profile.full_name || '', avatar_url: profile.avatar_url || '' } : undefined
          });
        }
        updated[idx] = { ...updated[idx], reactions: newReactions };
        return updated;
      });

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'reaction_update',
          payload: {
            eventType: isTogglingOff ? 'DELETE' : 'INSERT',
            [isTogglingOff ? 'old' : 'new']: isTogglingOff ? existingReaction : { id: optimisticId, message_id: messageId, user_id: user.id, emoji }
          }
        }).catch(console.error);
      }

      await supabase.from('project_space_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      if (!isTogglingOff) {
        const { data, error } = await supabase.from('project_space_message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        }).select().single();

        if (error) {
          console.error('Error adding reaction', error);
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], reactions: currentReactions };
            return updated;
          });
        } else if (data) {
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).map(r => r.id === optimisticId ? { ...r, id: data.id } : r) };
            return updated;
          });
        }
      }
    } finally {
      reactionLocksRef.current.delete(messageId);
    }
  };

  const fetchMessages = useCallback(async (isNewRoom = true) => {
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
      const withReactions = await fetchReactions(sortedMessages);
      setMessages(prev => {
        const baseMessages = isNewRoom ? [] : prev;
        const pending = baseMessages.filter(m => m.status === 'pending');

        const messagesMap = new Map();
        baseMessages.forEach(m => {
          if (m.status !== 'pending') {
            messagesMap.set(m.id, m);
          }
        });

        withReactions.forEach(m => {
          messagesMap.set(m.id, m);
        });

        const mergedMessages = Array.from(messagesMap.values()).sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const uniquePending = pending.filter(pm =>
          !mergedMessages.some(sm => sm.user_id === pm.user_id && sm.content === pm.content)
        );
        return [...mergedMessages, ...uniquePending];
      });
      setHasMore(fetchedMessages.length === 30);
    }
    setLoadingMessages(false);
  }, [spaceId]);

  const fetchReadStatuses = useCallback(async () => {
    if (!spaceId) return;
    const { data, error } = await (supabase.from('project_message_read_status') as any)
      .select('user_id, last_read_at, profiles(full_name, avatar_url)')
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
  }, [spaceId]);

  const fetchMessagesRef = useRef(fetchMessages);
  const fetchReadStatusesRef = useRef(fetchReadStatuses);

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  useEffect(() => {
    fetchReadStatusesRef.current = fetchReadStatuses;
  }, [fetchReadStatuses]);

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

    fetchMessagesRef.current();
    fetchReadStatusesRef.current();

    const handleProjectMessageChange = async (payload: any) => {
      console.log('🔥 [ProjectChatInterface] Realtime payload received:', payload);

      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;
        console.log('🔥 [ProjectChatInterface] INSERT received:', newMsg);

        // If it's my message, find the pending one and update it
        setMessages(prev => {
          const hasAlready = prev.some(m => m.id === newMsg.id);
          if (hasAlready) {
            console.log('🔥 [ProjectChatInterface] Message already exists, skipping.');
            return prev;
          }

          // Ignore delayed broadcasts of our own optimistic messages to prevent duplicates
          if (String(newMsg.id).startsWith('temp-') && newMsg.user_id === user?.id) {
            return prev;
          }

          // Deduplicate incoming broadcasts against existing real messages (if Postgres event arrived before broadcast)
          if (String(newMsg.id).startsWith('temp-') && newMsg.user_id !== user?.id) {
            const hasRealMessage = prev.some(m => m.user_id === newMsg.user_id && m.content === newMsg.content && !String(m.id).startsWith('temp-') && Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000);
            if (hasRealMessage) {
              return prev;
            }
          }

          // Find if we have a pending optimistic message with matching content
          const pendingIdx = prev.findIndex(m => (m.status === 'pending' || String(m.id).startsWith('temp-')) && m.user_id === newMsg.user_id && m.content === newMsg.content);

          if (pendingIdx !== -1) {
            // Update the pending message
            const updated = [...prev];
            updated[pendingIdx] = {
              ...updated[pendingIdx],
              id: newMsg.id,
              created_at: newMsg.created_at,
              status: undefined // clear pending status
            };
            return updated;
          }

          // Construct and append immediately for instant UI update
          const hasProfileIncluded = !!newMsg.profiles;
          let finalProfile = null;

          if (hasProfileIncluded) {
            finalProfile = newMsg.profiles;
          } else if (newMsg.user_id === user?.id) {
            finalProfile = {
              username: profile?.username || user?.email?.split('@')[0] || 'me',
              full_name: profile?.full_name || user?.user_metadata?.full_name || 'Me',
              avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || null
            };
          } else {
            const existingMsgWithProfile = prev.find(m => m.user_id === newMsg.user_id && m.profiles);
            if (existingMsgWithProfile) {
              finalProfile = existingMsgWithProfile.profiles;
            } else {
              // Fallback generic profile until fetched
              finalProfile = {
                full_name: 'Unknown User',
                avatar_url: null
              };
            }
          }

          return [...prev, {
            id: newMsg.id,
            content: newMsg.content,
            created_at: newMsg.created_at,
            user_id: newMsg.user_id,
            is_deleted: newMsg.is_deleted,
            reply_to_id: newMsg.reply_to_id,
            attachment_url: newMsg.attachment_url,
            attachment_type: newMsg.attachment_type,
            profiles: finalProfile,
            deleted_for_users: newMsg.deleted_for_users || [],
            status: newMsg.status
          }];
        });

        setTimeout(() => scrollToBottom(), 100);

        // Fetch profile if it wasn't included and we didn't have it cached
        if (!newMsg.profiles && newMsg.user_id !== user?.id) {
          const hasProfile = messagesRef.current.some(m => m.user_id === newMsg.user_id && m.profiles && m.profiles.full_name !== 'Unknown User');

          if (!hasProfile) {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url')
                .eq('id', newMsg.user_id)
                .single();

              if (profileData) {
                setMessages(prev => prev.map(m => m.user_id === newMsg.user_id ? { ...m, profiles: profileData } : m));
              }
            } catch (err) {
              console.error('Error fetching profile for real-time project message:', err);
            }
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedMsg = payload.new;
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? {
          ...m,
          content: updatedMsg.content,
          is_deleted: updatedMsg.is_deleted,
          attachment_url: updatedMsg.attachment_url,
          attachment_type: updatedMsg.attachment_type,
          deleted_for_users: updatedMsg.deleted_for_users || []
        } : m));
      } else if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      }
    };

    const handleReactionChange = async (payload: any) => {
      const reaction = payload.new || payload.old;
      if (!reaction) return;

      if (payload.eventType === 'INSERT') {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', reaction.user_id).maybeSingle();
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === reaction.message_id);
          if (idx === -1) return prev;
          const updated = [...prev];
          let newReactions = [...(updated[idx].reactions || [])];
          newReactions = newReactions.filter(r => r.user_id !== reaction.user_id);
          newReactions.push({ ...reaction, user_profile: profile || undefined });
          updated[idx] = { ...updated[idx], reactions: newReactions };
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        setMessages(prev => {
          const updated = [...prev];
          if (reaction.message_id && reaction.user_id) {
            const idx = updated.findIndex(m => m.id === reaction.message_id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).filter(r => r.user_id !== reaction.user_id) };
            }
          } else {
            const idx = updated.findIndex(m => m.reactions?.some(r => r.id === reaction.id));
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).filter(r => r.id !== reaction.id) };
            }
          }
          return updated;
        });
      }
    };

    const channel = supabase
      .channel(`project_messages-v2:${spaceId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMsg = payload.payload;
        handleProjectMessageChange({ eventType: 'INSERT', new: newMsg });
      })
      .on('broadcast', { event: 'reaction_update' }, (payload) => {
        handleReactionChange(payload.payload);
      })
      .on('broadcast', { event: 'read_update' }, () => {
        fetchReadStatusesRef.current();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_space_messages',
        filter: `project_space_id=eq.${spaceId}`
      }, handleProjectMessageChange)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'project_space_messages',
        filter: `project_space_id=eq.${spaceId}`
      }, handleProjectMessageChange)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'project_space_messages',
        filter: `project_space_id=eq.${spaceId}`
      }, handleProjectMessageChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_space_message_reactions'
      }, handleReactionChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_message_read_status',
        filter: `project_space_id=eq.${spaceId}`
      }, () => {
        fetchReadStatusesRef.current();
      });

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to project space chat:', spaceId);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Error subscribing to project space chat:', spaceId);
        fetchMessagesRef.current(false); // Fallback
      }
    });

    const handleWindowMessage = (e: any) => {
      const newMsg = e.detail;
      if (newMsg.project_space_id === spaceId) {
        handleProjectMessageChange({ eventType: 'INSERT', new: newMsg });
      }
    };
    window.addEventListener('project_message_received', handleWindowMessage);

    return () => {
      window.removeEventListener('project_message_received', handleWindowMessage);
      supabase.removeChannel(channel);
    };
  }, [spaceId, isActive]);

  // Re-sync when tab becomes active
  useEffect(() => {
    if (isActive && spaceId) {
      fetchMessages(false);
      scrollToBottom('auto');
    }
  }, [isActive, spaceId]);

  // Handle scroll to top for pagination
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMessages || !hasMore) return;

    const { scrollTop } = scrollContainerRef.current;
    if (scrollTop < 100) {
      loadMoreMessages();
    }
  }, [loadingMessages, hasMore, spaceId]);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    // Small timeout to ensure the DOM has calculated the new height after un-hiding
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        if (behavior === 'smooth') {
          el.scrollTo({ top: el.scrollHeight + 1000, behavior: 'smooth' });
        } else {
          el.scrollTop = el.scrollHeight + 1000;
        }
      }
    }, 50);
  }, []);

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
        const withReactions = await fetchReactions(sortedNewMessages);
        setMessages(prev => [...withReactions, ...prev]);
        setHasMore(fetchedMessages.length === 30);
      } else {
        setHasMore(false);
      }
    }
    setLoadingMessages(false);
  };

  const [isUploading, setIsUploading] = useState(false);
  const sendingRef = useRef(false);

  const handleSendMessage = async (content: string, file?: File | null) => {
    if ((!content.trim() && !file) || sending || sendingRef.current || !user || !spaceId) return;

    sendingRef.current = true;
    setSending(true);
    setIsUploading(true);
    try {
      let attachmentUrl = null;
      let attachmentType = null;

      if (file) {
        const isImage = file.type.startsWith('image/');
        let fileToUpload = file;

        if (isImage) {
          const { compressImage } = await import('@/utils/imageCompression');
          fileToUpload = await compressImage(file);
        }

        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, fileToUpload, {
            cacheControl: '31536000',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentType = fileToUpload.type.startsWith('image/') ? 'image' : fileToUpload.type.startsWith('video/') ? 'video' : 'other';
      }

      // Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        content: content.trim() || `Shared ${attachmentType === 'image' ? 'an image' : attachmentType === 'video' ? 'a video' : 'a file'}`,
        created_at: new Date().toISOString(),
        user_id: user.id,
        reply_to_id: replyingTo?.id || null,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        profiles: {
          username: profile?.username || user.email?.split('@')[0] || 'me',
          full_name: profile?.full_name || user.user_metadata?.full_name || 'Me',
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null
        },
        is_deleted: false,
        deleted_for_users: [],
        status: 'pending'
      };

      // Add to messages local state immediately!
      setMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom(), 50);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            id: optimisticMessage.id,
            content: optimisticMessage.content,
            created_at: optimisticMessage.created_at,
            user_id: optimisticMessage.user_id,
            reply_to_id: optimisticMessage.reply_to_id,
            attachment_url: optimisticMessage.attachment_url,
            attachment_type: optimisticMessage.attachment_type,
            is_deleted: false,
            deleted_for_users: [],
            profiles: optimisticMessage.profiles,
            status: 'pending'
          }
        });
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
      sendingRef.current = false;
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
      <>
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
          <span className="text-[13px] sm:text-sm font-medium leading-relaxed break-words whitespace-pre-wrap">{content}</span>
        ) : null}
      </>
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
    <div className={cn(
      "flex-col h-full bg-background relative overflow-hidden",
      isActive ? "flex" : "hidden"
    )}>
      {/* Global call handles everything now, no local LiveKitCallContainer needed here */}

      {/* Selection Toolbar */}
      {selectedMessageIds.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-2 sm:p-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top-full duration-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedMessageIds([])} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full">
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <span className="font-semibold text-sm sm:text-base">{selectedMessageIds.length}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleToggleStarMessages()} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full" title="Star Messages">
              <Star className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowForwardDialog(true)} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full" title="Forward">
              <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
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
              const nextMessage = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;
              const isNextDateSeparator = nextMessage ? !isSameDay(new Date(nextMessage.created_at), messageDate) : false;
              const isSameSenderAsNext = !!(nextMessage && !isNextDateSeparator && nextMessage.user_id === message.user_id);
              const isSameSenderAsPrev = !!(prevMessage && !showDateSeparator && prevMessage.user_id === message.user_id);

              const showAvatar = !isSameSenderAsNext;
              const showSenderName = !isOwn && !isSameSenderAsPrev && !message.is_deleted;

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
                    className={cn(
                      "flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                      isOwn ? 'flex-row-reverse' : '',
                      isSameSenderAsNext ? 'mb-1' : 'mb-3',
                      message.status === 'pending' && isOwn && 'opacity-60 saturate-50'
                    )}
                  >
                    {showAvatar ? (
                      <Avatar className="h-9 w-9 flex-shrink-0 shadow-sm border border-border/10">
                        <AvatarImage src={message.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-sm font-bold bg-secondary text-secondary-foreground">
                          {message.profiles?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-9 h-9 flex-shrink-0" />
                    )}
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%] relative`}>
                      <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-center gap-1 group relative ${message.reactions && message.reactions.length > 0 ? 'mb-4' : ''}`}>
                        {/* Swipe to reply indicator icon behind message */}
                        {swipeMessageId === message.id && swipeOffset > 0 && (
                          <div
                            className="absolute left-[-35px] top-1/2 -translate-y-1/2 transition-all flex items-center justify-center bg-muted dark:bg-zinc-800 text-muted-foreground rounded-full p-1.5 shadow-sm border border-border/30 animate-in fade-in zoom-in duration-100"
                            style={{
                              opacity: Math.min(swipeOffset / 55, 1),
                              transform: `translateY(-50%) scale(${Math.min(0.5 + (swipeOffset / 110), 1)})`
                            }}
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div
                          className="relative select-none transition-transform duration-200"
                          style={{
                            transform: swipeMessageId === message.id ? `translateX(${swipeOffset}px)` : undefined
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!message.is_deleted) {
                              handleToggleReaction(message.id, '❤️');
                            }
                          }}
                          onClick={() => {
                            if (selectedMessageIds.length > 0 && !message.is_deleted) {
                              toggleMessageSelection(message.id);
                            }
                          }}
                          onTouchStart={handleTouchStart(message.id, !!message.is_deleted)}
                          onTouchMove={handleTouchMove(message.id)}
                          onTouchEnd={handleTouchEnd(message)}
                        >
                          <div className={cn(
                            "relative transition-all duration-300",
                            selectedMessageIds.includes(message.id) && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[0.98]",
                            message.is_deleted ? "bg-muted/50 border border-dashed border-border/50 p-3 rounded-[22px] italic text-muted-foreground" :
                              isShare ? "p-0 bg-transparent overflow-hidden rounded-2xl border border-border/10" :
                                (message.attachment_url && (!message.content || message.content === 'Shared an image' || message.content === 'Shared a video' || message.content === 'Shared a file')) ? "p-0 bg-transparent rounded-xl overflow-hidden shadow-xl" :
                                  isOwn ? "bg-gradient-to-br from-chat-outgoing-bg-start to-chat-outgoing-bg-end text-chat-outgoing-text font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md" :
                                    "bg-chat-incoming-bg border border-chat-incoming-border text-chat-incoming-text dark:bg-muted dark:border-transparent dark:text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md"
                          )}>
                            {!isOwn && !message.is_deleted && (
                              showSenderName ? (
                                <div className="flex items-center justify-between gap-4 mb-1">
                                  <p className={`text-[11px] font-bold ${getUserColor(message.user_id)}`}>
                                    {message.profiles?.username || message.profiles?.full_name || 'User'}
                                  </p>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="p-0 text-current opacity-70 hover:opacity-100 rounded focus:outline-none inline-flex items-center justify-center shrink-0 min-w-[14px] min-h-[14px] pointer-events-none sm:pointer-events-auto"
                                        title="Options"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="hidden sm:group-hover:inline-flex sm:data-[state=open]:inline-flex items-center justify-center">
                                          <ChevronDown className="h-4 w-4" />
                                        </span>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 z-50">
                                      <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                        <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        navigator.clipboard.writeText(message.content || '');
                                        toast({ title: "Copied to clipboard" });
                                      }}>
                                        <Copy className="h-3.5 w-3.5 mr-2" /> Copy
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        toggleMessageSelection(message.id);
                                        setShowForwardDialog(true);
                                      }}>
                                        <Share2 className="h-3.5 w-3.5 mr-2" /> Forward
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => toggleMessageSelection(message.id)}>
                                        <Check className="h-3.5 w-3.5 mr-2" /> Select
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              ) : null
                            )}

                            {message.reply_to_id && !message.is_deleted && (() => {
                              const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                              if (!repliedMsg) return null;
                              return (
                                <div
                                  onClick={() => scrollToMessage(message.reply_to_id!)}
                                  className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-85 active:scale-[0.98] transition-all ${isOwn ? 'bg-black/15 border-l-white text-white/90' : 'bg-black/5 dark:bg-white/5 border-l-primary text-foreground/90'}`}
                                >
                                  <div className={`font-semibold text-[10px] mb-0.5 ${isOwn ? 'text-white font-bold' : getUserColor(repliedMsg.user_id)}`}>
                                    {repliedMsg.profiles?.username || repliedMsg.profiles?.full_name || 'User'}
                                  </div>
                                  <div className={`opacity-80 line-clamp-1 ${isOwn ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    {repliedMsg.is_deleted ? <em>This message was deleted</em> : (
                                      getMessagePreviewText(repliedMsg.content)
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
                            {/* WhatsApp style inline timestamp & status ticks / dropdown chevron overlay */}
                            {!message.is_deleted && (
                              <span className="inline-flex items-center gap-1 float-right text-[10px] ml-2.5 mt-1.5 align-baseline select-none shrink-0 leading-none text-chat-text-muted/80 dark:text-muted-foreground/80">
                                {starredMessageIds.has(message.id) && (
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline shrink-0 mr-0.5" />
                                )}
                                <span>{formatTimestamp(message.created_at)}</span>

                                {(isOwn || !showSenderName) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="p-0 text-current opacity-70 hover:opacity-100 rounded focus:outline-none inline-flex items-center justify-center shrink-0 min-w-[14px] min-h-[14px] pointer-events-none sm:pointer-events-auto ml-0.5"
                                        title="Options"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-36 z-[60]">
                                      {isOwn && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setInfoMessage(message);
                                            setShowInfoDialog(true);
                                          }}
                                          className="flex items-center justify-between cursor-pointer"
                                        >
                                          <div className="flex items-center">
                                            <Info className="h-3.5 w-3.5 mr-2 text-primary" />
                                            <span>Info</span>
                                          </div>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                        <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        navigator.clipboard.writeText(message.content || '');
                                        toast({ title: "Copied to clipboard" });
                                      }}>
                                        <Copy className="h-3.5 w-3.5 mr-2" /> Copy
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        toggleMessageSelection(message.id);
                                        setShowForwardDialog(true);
                                      }}>
                                        <Share2 className="h-3.5 w-3.5 mr-2" /> Forward
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => toggleMessageSelection(message.id)}>
                                        <Check className="h-3.5 w-3.5 mr-2" /> Select
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </span>
                            )}
                            {/* Reactions Pill */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className={cn(
                                "absolute -bottom-3.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/95 backdrop-blur-md border border-border/80 shadow-md",
                                isOwn ? "right-2" : "left-2"
                              )}>
                                {Array.from(new Set(message.reactions.map(r => r.emoji))).map(emoji => {
                                  const count = message.reactions!.filter(r => r.emoji === emoji).length;
                                  const hasReacted = message.reactions!.some(r => r.emoji === emoji && r.user_id === user?.id);
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggleReaction(message.id, emoji)}
                                      className={cn(
                                        "flex items-center gap-0.5 p-0.5 rounded-full leading-none transition-transform active:scale-95",
                                        hasReacted && "text-primary font-bold"
                                      )}
                                    >
                                      <span className="text-sm leading-none">{emoji}</span>
                                      {count > 1 && <span className="text-[10px] font-extrabold pr-0.5">{count}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Hover Reaction Button (like DM Chat) */}
                          {!message.is_deleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMobileReactionMessageId(prev => prev === message.id ? null : message.id);
                              }}
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all opacity-0 group-hover:opacity-100 shrink-0",
                                isOwn ? "-left-8" : "-right-8",
                                activeMobileReactionMessageId === message.id && "opacity-100"
                              )}
                              title="React"
                            >
                              <Smile className="h-4 w-4" />
                            </button>
                          )}

                          {/* Mobile floating reactions picker */}
                          {activeMobileReactionMessageId === message.id && (
                            <div
                              className={cn(
                                "absolute -top-12 z-50 flex items-center gap-1 p-1.5 rounded-full border border-border/50 shadow-xl bg-background/95 backdrop-blur-xl animate-in zoom-in-95 duration-100",
                                isOwn ? "right-0" : "left-0"
                              )}
                              onTouchStart={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {QUICK_REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReaction(message.id, emoji);
                                    setActiveMobileReactionMessageId(null);
                                  }}
                                  className="hover:scale-125 transition-transform text-lg p-1.5 leading-none"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMobileReactionMessageId(null);
                                }}
                                className="p-1 text-muted-foreground hover:text-foreground rounded-full"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          {isOwn && (!isSameSenderAsNext || uniqueSeenBy.length > 0) && (
                            <div className="flex justify-end mt-0.5 mb-1 px-1">
                              {uniqueSeenBy.length > 0 ? (
                                <span
                                  className="text-[9px] font-bold text-primary/60 tracking-tight cursor-pointer hover:underline"
                                  onClick={() => {
                                    setInfoMessage(message);
                                    setShowInfoDialog(true);
                                  }}
                                >
                                  Seen by {uniqueSeenBy.join(', ')}
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-muted-foreground/60 tracking-tight">
                                  {message.status === 'pending' ? 'Sending...' : 'Sent'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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
                {getMessagePreviewText(replyingTo.content)}
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
        <div className="p-0 border-t border-border relative">{isInternal ? (
          <div className="p-4 bg-muted/30 text-center text-xs text-muted-foreground italic border-t border-border/50">
            Internal staff cannot send messages in project spaces.
          </div>
        ) : (
          <>
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer
              onSend={handleSendMessage}
              disabled={sending}
              isUploading={isUploading}
              onTyping={startTyping}
              onStopTyping={stopTyping}
            />
          </>
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

      {/* Message Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Message Info</DialogTitle>
            <DialogDescription>
              Details of who has seen this message.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto py-2 divide-y divide-border/30">
            {infoMessage && (() => {
              const messageTime = new Date(infoMessage.created_at).getTime();
              const viewers = readStatuses.filter(rs => {
                if (rs.user_id === user?.id) return false;
                try {
                  const statusTime = new Date(rs.last_read_at).getTime();
                  return statusTime >= messageTime;
                } catch (e) { return false; }
              });

              if (viewers.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No one else has seen this message yet.
                  </p>
                );
              }

              return viewers.map(rs => (
                <div key={rs.user_id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={rs.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground font-bold">
                        {rs.profiles?.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-none mb-1">
                        {rs.profiles?.full_name || 'User'}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-none">
                        Read
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {format(new Date(rs.last_read_at), 'p')}
                  </span>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <ForwardMessageDialog
        isOpen={showForwardDialog}
        onOpenChange={setShowForwardDialog}
        messagesToForward={messages.filter(m => selectedMessageIds.includes(m.id))}
        currentUserId={user?.id}
        onForwardSuccess={() => {
          setSelectedMessageIds([]);
          setShowForwardDialog(false);
          toast({ title: "Messages forwarded successfully" });
        }}
      />
      <StarredMessagesDialog
        isOpen={showStarredDialog}
        onOpenChange={setShowStarredDialog}
        starredMessages={messages.filter(m => starredMessageIds.has(m.id))}
        onUnstarMessage={(id) => handleToggleStarMessages([id])}
        onJumpToMessage={scrollToMessage}
      />
    </div>
  );
};

export default ProjectChatInterface;

