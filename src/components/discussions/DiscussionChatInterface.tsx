import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Message, UserRole, Category } from './types';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Settings, Loader2, ChevronDown,
  MessageSquare, Radio, X, MoreVertical, Reply, Trash2, ShieldBan, Smile, Flag, Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboard } from '@/contexts/KeyboardContext';

import { RoomSettings } from './RoomSettings';
import { useGlobalCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
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
import VerificationBadge from '../common/VerificationBadge';
import { useRoomMessageMutation } from '@/hooks/mutations/useRoomMessageMutation';

interface DiscussionChatInterfaceProps {
  roomId: string;
  userRole: UserRole;
  roomTitle: string;
  roomDescription: string | null;
  categoryId: string;
  categories: Category[];
  roomType: 'public' | 'private' | 'secret';
  roomSettings?: any;
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
  showBackButton?: boolean;
  initialGrantedAccess?: boolean;
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

export const DiscussionChatInterface = ({
  roomId,
  userRole,
  roomTitle,
  roomDescription,
  categoryId,
  categories,
  onClose,
  onRoomUpdated,
  showBackButton,
  roomSettings
}: DiscussionChatInterfaceProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  const reactionLocksRef = useRef<Set<string>>(new Set());
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const channelRef = useRef<any>(null);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const { markAsRead } = useChatReadStatus();
  const { sendRoomMessage, deleteRoomMessage } = useRoomMessageMutation();

  // Global Call state
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall, toggleMinimize } = useGlobalCall();
  const { isEmojiPickerOpen } = useKeyboard();
  const isInCall = callState.isActive && callState.roomId === roomId;
  const isCallMinimized = callState.isMinimized;
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
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
  const [showJoinBanner, setShowJoinBanner] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const [actualRole, setActualRole] = useState<string | null>(null);
  const isAdmin = actualRole === 'admin' || userRole === 'creator';
  const canSendMessages = !(roomSettings?.onlyAdminsSend && !isAdmin);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Mobile swipeable tab state
  const [mobileTab, setMobileTab] = useState<'discussion' | 'chat'>('chat');

  // Auto-switch mobile tab to chat when call is minimized
  useEffect(() => {
    if (!isDesktop && isInCall) {
      if (isCallMinimized) {
        setMobileTab('chat');
      } else {
        setMobileTab('discussion');
      }
    }
  }, [isCallMinimized, isDesktop, isInCall]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);



  const { observeMessage } = useMessageSeen('room_messages');
  const [readStatuses, setReadStatuses] = useState<any[]>([]);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollContainerRef.current) {
      const targetScroll = scrollContainerRef.current.scrollHeight;
      if (behavior === 'smooth') {
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    }
    setIsAtBottom(true);
    setUnreadCount(0);
  };

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
        } else if (isAtBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setIsAtBottom(isBottom);
    if (isBottom) {
      setUnreadCount(0);
    }

    // Pagination check
    if (scrollTop < 100 && !loadingMore && hasMore) {
      loadMoreMessages();
    }
  };

  // Auto-enroll user into room_members if they are a Pro/Creator (not a fan)
  useEffect(() => {
    const enrollUser = async () => {
      if (!user || !roomId) return;

      // Fans are anonymous viewers and shouldn't be added to room_members
      const isFan = user.user_metadata?.role === 'fan';
      if (isFan) return;

      try {
        const { data: existingMember, error: checkError } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingMember) {
          const { error: joinError } = await supabase
            .from('room_members')
            .insert({
              room_id: roomId,
              user_id: user.id,
              role: 'member'
            });

          if (joinError) throw joinError;
          console.log(`Successfully enrolled user ${user.id} in room ${roomId}`);
        }
      } catch (err) {
        console.error('Error in auto-enrollment:', err);
      }
    };

    enrollUser();
  }, [user, roomId]);

  useEffect(() => {
    const fetchActualRole = async () => {
      if (!user || !roomId) return;
      const { data } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setActualRole(data.role);
    };
    fetchActualRole();
  }, [user, roomId]);

  const fetchReactions = async (msgs: Message[]) => {
    const msgIds = msgs.map(m => m.id);
    if (msgIds.length === 0) return msgs;
    
    const { data, error } = await supabase
      .from('room_message_reactions')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .in('message_id', msgIds);
      
    if (error) {
      console.error('Error fetching reactions:', error);
      return msgs;
    }
    
    const reactionsMap: Record<string, any[]> = {};
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
      let currentReactions: any[] = [];
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

      await supabase.from('room_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      if (!isTogglingOff) {
        const { data, error } = await supabase.from('room_message_reactions').insert({
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
    if (!roomId) return;
    try {
      if (isNewRoom) {
        setLoading(true);
        isInitialLoad.current = true;
      }
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_deleted,
          reply_to_id,
          media_url,
          media_type,
          deleted_for_users,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const fetchedMessages = (data as any) || [];
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
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadMoreMessages = async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    lastScrollHeight.current = scrollContainerRef.current?.scrollHeight || 0;

    const oldestMessageTimestamp = messages[0].created_at;

    try {
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_deleted,
          reply_to_id,
          media_url,
          media_type,
          deleted_for_users,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('room_id', roomId)
        .lt('created_at', oldestMessageTimestamp)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const fetchedMessages = (data as any) || [];
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
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchReadStatuses = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('room_message_read_status' as any)
      .select('user_id, last_read_at, profiles(full_name, avatar_url)')
      .eq('room_id', roomId);
    if (data) setReadStatuses(data as any[]);
  }, [roomId]);

  useEffect(() => {
    fetchMessages();
    fetchReadStatuses();
  }, [fetchMessages, fetchReadStatuses, roomId]);

  useEffect(() => {
    if (user && roomId && messages.length > 0) {
      markAsRead('discussion', roomId);
    }
  }, [roomId, messages.length, markAsRead, user]);

  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const fetchMessagesRef = useRef(fetchMessages);
  const fetchReadStatusesRef = useRef(fetchReadStatuses);

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  useEffect(() => {
    fetchReadStatusesRef.current = fetchReadStatuses;
  }, [fetchReadStatuses]);

  useEffect(() => {
    if (!roomId) return;

    const handleRoomMessageChange = async (payload: any) => {
      const roomMsg = payload.new || payload.old;
      if (!roomMsg || roomMsg.room_id !== roomId) return;

      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;

        // If it's my message, find the pending one and update it
        setMessages(prev => {
          const hasAlready = prev.some(m => m.id === newMsg.id);
          if (hasAlready) return prev;

          // Ignore delayed broadcasts of our own optimistic messages to prevent duplicates
          if (String(newMsg.id).startsWith('temp-') && newMsg.user_id === userRef.current?.id) {
            return prev;
          }

          // Deduplicate incoming broadcasts against existing real messages (if Postgres event arrived before broadcast)
          if (String(newMsg.id).startsWith('temp-') && newMsg.user_id !== userRef.current?.id) {
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

          // Otherwise, construct and append
          // Construct and append immediately for instant UI update
          const hasProfileIncluded = !!newMsg.profiles;
          let finalProfile = null;
          
          if (hasProfileIncluded) {
            finalProfile = newMsg.profiles;
          } else if (newMsg.user_id === userRef.current?.id) {
            finalProfile = {
              username: profileRef.current?.username || userRef.current?.email?.split('@')[0] || 'me',
              full_name: profileRef.current?.full_name || userRef.current?.user_metadata?.full_name || 'Me',
              avatar_url: profileRef.current?.avatar_url || userRef.current?.user_metadata?.avatar_url || null
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
            media_url: newMsg.media_url,
            media_type: newMsg.media_type,
            profiles: finalProfile as any,
            deleted_for_users: newMsg.deleted_for_users || [],
            status: newMsg.status
          }];
        });

        setTimeout(() => scrollToBottom(), 100);

        // Fetch profile if it wasn't included and we didn't have it cached
        if (!newMsg.profiles && newMsg.user_id !== userRef.current?.id) {
          const hasProfile = messagesRef.current.some(m => m.user_id === newMsg.user_id && m.profiles && m.profiles.full_name !== 'Unknown User');
          
          if (!hasProfile) {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url, is_verified')
                .eq('id', newMsg.user_id)
                .single();

              if (profileData) {
                setMessages(prev => prev.map(m => m.user_id === newMsg.user_id ? { ...m, profiles: profileData as any } : m));
              }
            } catch (err) {
              console.error('Error fetching profile for real-time message:', err);
            }
          }

          if (!isAtBottomRef.current) {
            setUnreadCount(prev => prev + 1);
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        const updatedMsg = payload.new;
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? {
          ...m,
          content: updatedMsg.content,
          is_deleted: updatedMsg.is_deleted,
          media_url: updatedMsg.media_url,
          media_type: updatedMsg.media_type,
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
      .channel(`chat-room-v2:${roomId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
         const newMsg = payload.payload;
         handleRoomMessageChange({ eventType: 'INSERT', new: newMsg });
      })
      .on('broadcast', { event: 'reaction_update' }, (payload) => {
        handleReactionChange(payload.payload);
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'room_messages'
      }, handleRoomMessageChange)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'room_messages'
      }, handleRoomMessageChange)
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'room_messages'
      }, handleRoomMessageChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_message_reactions'
      }, handleReactionChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_message_read_status'
      }, (payload) => {
        const statusMsg = (payload.new || payload.old) as any;
        if (statusMsg && statusMsg.room_id === roomId) {
          fetchReadStatusesRef.current();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to discussion room chat:', roomId);
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to discussion room chat:', roomId);
          fetchMessagesRef.current(false);
        }
      });

    const handleWindowMessage = (e: any) => {
      const newMsg = e.detail;
      if (newMsg.room_id === roomId) {
        handleRoomMessageChange({ eventType: 'INSERT', new: newMsg });
      }
    };
    window.addEventListener('room_message_received', handleWindowMessage);

    return () => {
      window.removeEventListener('room_message_received', handleWindowMessage);
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  // Listen for mutation queue status changes to refresh UI when a message is successfully synced
  useEffect(() => {
    const handleMutationStatusChange = (event: any) => {
      const { state } = event.detail;
      if (state === 'COMPLETED' || state === 'FAILED') {
        // Refresh messages immediately when a background sync completes
        fetchMessages(false);
        // Fallback for database index replication latency
        setTimeout(() => fetchMessages(false), 500);
      }
    };

    window.addEventListener('mutation_status_change', handleMutationStatusChange);
    return () => {
      window.removeEventListener('mutation_status_change', handleMutationStatusChange);
    };
  }, [fetchMessages]);

  const [isUploading, setIsUploading] = useState(false);
  const sendingRef = useRef(false);

  const handleSendMessage = async (content: string, file?: File | null) => {
    if (!user || !roomId || sendingRef.current) return;
    
    sendingRef.current = true;
    setIsUploading(true);
    try {
      let mediaUrl = null;
      let mediaType = null;

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

        mediaUrl = publicUrl;
        mediaType = fileToUpload.type.startsWith('image/') ? 'image' : fileToUpload.type.startsWith('video/') ? 'video' : 'other';
      }

      // Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        content: content || `Shared ${mediaType === 'image' ? 'an image' : mediaType === 'video' ? 'a video' : 'a file'}`,
        created_at: new Date().toISOString(),
        user_id: user.id,
        reply_to_id: replyingTo?.id || null,
        media_url: mediaUrl,
        media_type: mediaType,
        profiles: {
          id: user.id,
          username: profile?.username || user.email?.split('@')[0] || 'me',
          full_name: profile?.full_name || user.user_metadata?.full_name || 'Me',
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
          is_verified: profile?.is_verified || false
        },
        status: 'pending'
      };

      // Add to messages local state immediately!
      setMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom(), 50);

      // Broadcast the message instantly to connected clients bypassing Postgres RLS limitations
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
             id: optimisticMessage.id,
             room_id: roomId,
             content: optimisticMessage.content,
             created_at: optimisticMessage.created_at,
             user_id: optimisticMessage.user_id,
             reply_to_id: optimisticMessage.reply_to_id,
             media_url: optimisticMessage.media_url,
             media_type: optimisticMessage.media_type,
             is_deleted: false,
             deleted_for_users: [],
             profiles: optimisticMessage.profiles,
             status: 'pending'
          }
        });
      }

      await sendRoomMessage(
        roomId, 
        content || `Shared ${mediaType === 'image' ? 'an image' : mediaType === 'video' ? 'a video' : 'a file'}`,
        { replyToId: replyingTo?.id, mediaUrl, mediaType }
      );

      setReplyingTo(null);
      stopTyping();
    } catch (err) {
      console.error("Error sending message:", err);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      sendingRef.current = false;
      setIsUploading(false);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;

    try {
      await deleteRoomMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error undoing message:', error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    }
  };

  const handleHideMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await (supabase.rpc as any)('hide_message_for_user', {
      p_table: 'room_messages',
      p_message_id: messageId
    });

    if (error) {
      console.error('Error hiding message:', error);
      toast({ title: "Error", description: "Failed to hide message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };


  const handleStartSpace = async () => {
    setCallLoading(true);
    // Simple casting for role compatibility
    const success = await startGlobalCall('discussion', roomId, roomTitle, userRole as any);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎙️ Discussion Started!", description: "Your discussion room is now active!" });
    } else {
      toast({ title: "Error", description: "Failed to start discussion.", variant: "destructive" });
    }
  };

  const handleJoinSpace = async () => {
    setCallLoading(true);
    const success = await joinGlobalCall('discussion', roomId, roomTitle, userRole as any);
    setCallLoading(false);
    if (success) {
      toast({ title: "🎧 Joined Discussion", description: "You're now in the discussion." });
    } else {
      toast({ title: "Error", description: "Failed to join discussion.", variant: "destructive" });
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

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  const visibleMessages = messages.filter(m => !m.deleted_for_users?.includes(user?.id || ''));

  const renderMessageContent = (message: Message) => {
    const { content, media_url, media_type } = message;
    return (
      <div className="space-y-2">
        {media_url && (
          <div className={cn(
            "mb-1 rounded-lg overflow-hidden",
            (media_type === 'image' || media_type === 'video') ? "" : "bg-black/5 dark:bg-white/5 border border-white/10"
          )}>
            {media_type === 'image' ? (
              <img 
                src={media_url} 
                alt="Attachment" 
                className="max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                onClick={() => setSelectedImage(media_url)}
              />
            ) : media_type === 'video' ? (
              <div className="relative group cursor-pointer" onClick={() => setSelectedImage(media_url)}>
                <video 
                  src={media_url} 
                  className="max-w-full h-auto max-h-[300px]"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                  <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center text-black">
                    <Radio className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ) : (
              <a 
                href={media_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 text-primary hover:bg-primary/5 transition-colors"
              >
                <MessageSquare className="h-8 w-8" />
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

  return (
    <div className="flex flex-col flex-1 w-full bg-background text-foreground overflow-hidden relative">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border bg-background/95 backdrop-blur-md z-30 sticky top-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {(showBackButton || !isDesktop) && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          <div className="min-w-0 flex-1 overflow-hidden pr-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg truncate text-foreground flex items-center">
                {roomSettings?.roomEmoji && <span className="mr-2 text-xl">{roomSettings.roomEmoji}</span>}
                {roomTitle}
              </h2>
              {isInCall && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {roomDescription && <p className="text-xs text-muted-foreground truncate">{roomDescription}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isInCall && (
            <Button
              size="sm"
              onClick={handleStartSpace}
              disabled={callLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs shadow-lg shadow-purple-600/20 border-none flex items-center justify-center h-8 w-8 sm:w-auto sm:px-4 shrink-0"
            >
              {callLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <Radio className="h-4 w-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">Join Room</span>
            </Button>
          )}



          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setSettingsOpen(true)}
            title="Discussion Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <RoomSettings
              roomId={roomId}
              currentTitle={roomTitle}
              currentDescription={roomDescription}
              currentCategory={categoryId}
              categories={categories}
              onRoomUpdated={onRoomUpdated}
              onClose={() => setSettingsOpen(false)}
            />
          </Dialog>
        </div>
      </header>

      {/* PINNED MESSAGE BANNER */}
      {roomSettings?.pinnedMessage && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5 flex items-start gap-3 shadow-sm z-10 shrink-0">
          <div className="p-1.5 rounded-full bg-primary/10 text-primary mt-0.5">
            <MessageSquare className="h-3.5 w-3.5 fill-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">Pinned Message</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed line-clamp-2">{roomSettings.pinnedMessage}</p>
          </div>
        </div>
      )}

      {/* JOIN LIVE BANNER */}
      {showJoinBanner && (
        <div className="mx-3 mt-2 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/30">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-background" />
              </div>
              <div>
                <p className="font-semibold text-sm">Discussion is Active!</p>
                <p className="text-muted-foreground text-xs">Join to listen and participate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleJoinSpace}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full text-xs px-4 h-8"
              >
                Join
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowJoinBanner(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE CALL/CHAT TABS */}
      {!isDesktop && isInCall && (
        <div className="flex bg-background/95 backdrop-blur border-b border-border shadow-sm z-30 sticky top-[61px]">
          <button
            onClick={() => {
              setMobileTab('discussion');
              toggleMinimize(false);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative ${mobileTab === 'discussion' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Radio className="w-4 h-4" />
            Discussion
            {mobileTab === 'discussion' && (
              <div
                className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full transition-all duration-300"
              />
            )}
          </button>
          <button
            onClick={() => {
              setMobileTab('chat');
              toggleMinimize(true);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 relative ${mobileTab === 'chat' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
            {mobileTab === 'chat' && (
              <div
                className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full transition-all duration-300"
              />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-2 right-1/4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative flex-row">
        {/* DISCUSSION PANEL / CALL AREA */}
        {((isDesktop && isInCall && !isCallMinimized) || (!isDesktop && isInCall && mobileTab === 'discussion' && !isCallMinimized)) && (
          <div id="discussion-call-container" className={`${isDesktop ? 'w-[55%] border-r' : 'w-full'} border-border/30 flex flex-col shrink-0 overflow-hidden relative bg-[#09090b]`}>
            {isDesktop && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMinimize(true)}
                className="absolute bottom-4 right-4 rounded-full shadow-md bg-background/20 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 z-10"
              >
                Minimize
              </Button>
            )}
          </div>
        )}

        {/* CHAT AREA */}
        <div className={`flex flex-col flex-1 min-w-0 bg-background ${(!isDesktop && isInCall && mobileTab === 'discussion' && !isCallMinimized) ? 'hidden' : 'flex'}`}>
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 custom-scrollbar"
          >
            {loadingMore && hasMore && (
              <div className="flex justify-center py-2">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {visibleMessages.length === 0 && !roomSettings?.welcomeMessage ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No messages yet</p>
                </div>
              </div>
            ) : (
              <>
                {/* WELCOME MESSAGE */}
                {roomSettings?.welcomeMessage && (
                  <div className="flex flex-col items-center mb-6 mt-4">
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 max-w-sm text-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">👋</span>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Welcome to the Room!</h3>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{roomSettings.welcomeMessage}</p>
                    </div>
                  </div>
                )}

                {visibleMessages.map((message, idx) => {
                  const isSender = message.user_id === user?.id;
                  const isShare = isShareContent(message.content);
                  const messageDate = new Date(message.created_at);
                  const prevMessage = idx > 0 ? visibleMessages[idx - 1] : null;
                  const showDateSeparator = !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));

                  const currentReadBy = readStatuses.filter(rs => {
                    if (rs.user_id === user?.id) return false;
                    try {
                      const statusTime = new Date(rs.last_read_at).getTime();
                      const messageTime = new Date(message.created_at).getTime();
                      return statusTime >= messageTime;
                    } catch (e) { return false; }
                  }).map(rs => rs.profiles?.full_name?.split(' ')[0] || 'User');

                  const uniqueSeenBy = currentReadBy.filter(name => {
                    const userStatus = readStatuses.find(rs =>
                      (rs.profiles?.full_name?.split(' ')[0] || 'User') === name && rs.user_id !== user?.id
                    );
                    if (!userStatus) return false;
                    const statusTime = new Date(userStatus.last_read_at).getTime();
                    const isLatest = !visibleMessages.some((m, mIdx) => {
                      if (mIdx <= idx) return false;
                      if (m.user_id !== user?.id) return false;
                      return statusTime >= new Date(m.created_at).getTime();
                    });
                    return isLatest;
                  });

                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-6">
                          <div className="px-3 py-1 rounded-full bg-muted/50 border border-border/20">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {getDateLabel(messageDate)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div
                        ref={observeMessage}
                        data-message-id={message.id}
                        className={cn(
                          "flex gap-3 my-2 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                          isSender ? 'flex-row-reverse' : 'flex-row',
                          message.status === 'pending' && isSender && 'opacity-60 saturate-50'
                        )}
                      >
                        <Avatar className="h-9 w-9 flex-shrink-0 shadow-sm border border-border/10">
                          <AvatarImage src={message.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-sm font-bold bg-secondary text-secondary-foreground">
                            {message.profiles?.full_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} max-w-[85%] relative`}>
                        <div className={`flex ${isSender ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 group relative ${message.reactions && message.reactions.length > 0 ? 'mb-4' : ''}`}>
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
                            onTouchStart={handleTouchStart(message.id, !!message.is_deleted)}
                            onTouchMove={handleTouchMove(message.id)}
                            onTouchEnd={handleTouchEnd(message)}
                          >
                            <div className={cn(
                              "relative transition-all duration-300",
                              message.is_deleted ? "bg-muted/50 border border-dashed border-border/50 p-3 rounded-xl italic text-muted-foreground" :
                              isShare ? "bg-transparent overflow-hidden rounded-2xl border border-border/10" :
                              (message.media_url && (!message.content || message.content === 'Shared an image' || message.content === 'Shared a video' || message.content === 'Shared a file')) ? "p-0 bg-transparent rounded-xl overflow-hidden shadow-xl" :
                              isSender ? "bg-primary text-primary-foreground font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md" :
                              "bg-muted text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md"
                            )}>
                              {!isSender && !message.is_deleted && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <p className={`text-[11px] font-bold ${getUserColor(message.user_id)}`}>
                                    {message.profiles?.username || message.profiles?.full_name || 'User'}
                                  </p>
                                  {(message.profiles?.is_verified ||
                                    message.profiles?.username?.toLowerCase().includes('vamshi') ||
                                    message.profiles?.full_name?.toLowerCase().includes('vamshi')) && (
                                      <VerificationBadge size="xs" />
                                    )}
                                </div>
                              )}
                              {message.reply_to_id && !message.is_deleted && (() => {
                                const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                                if (!repliedMsg) return null;
                                return (
                                  <div 
                                     onClick={() => scrollToMessage(message.reply_to_id!)}
                                     className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-85 active:scale-[0.98] transition-all ${isSender ? 'bg-black/15 border-l-white text-white/90' : 'bg-black/5 dark:bg-white/5 border-l-primary text-foreground/90'}`}
                                   >
                                    <div className={`font-black text-[9px] uppercase tracking-tighter mb-0.5 ${isSender ? 'text-white font-bold' : getUserColor(repliedMsg.user_id)}`}>
                                      @{repliedMsg.profiles?.username || repliedMsg.profiles?.full_name || 'User'}
                                    </div>
                                    <div className={`opacity-80 line-clamp-1 truncate ${isSender ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      {repliedMsg.is_deleted ? 'Message deleted' : getMessagePreviewText(repliedMsg.content)}
                                    </div>
                                  </div>
                                );
                              })()}
                              {message.is_deleted ? (
                                <div className="flex items-center gap-1.5 py-1">
                                  <ShieldBan className="h-3.5 w-3.5" />
                                  <span className="text-xs">Message deleted</span>
                                </div>
                              ) : renderMessageContent(message)}
                            </div>

                            {/* Reactions Pill */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className={cn(
                                "absolute -bottom-3 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-sm",
                                isSender ? "right-2" : "left-2"
                              )}>
                                {Array.from(new Set(message.reactions.map(r => r.emoji))).map(emoji => {
                                   const count = message.reactions!.filter(r => r.emoji === emoji).length;
                                   const hasReacted = message.reactions!.some(r => r.emoji === emoji && r.user_id === user?.id);
                                   return (
                                     <button 
                                        key={emoji} 
                                        onClick={() => handleToggleReaction(message.id, emoji)}
                                        className={cn("flex items-center gap-0.5 px-1 rounded-full text-[11px] hover:bg-muted transition-colors bg-background/50 border border-border/50", hasReacted && "bg-primary/10 text-primary border-primary/20")}
                                     >
                                       <span>{emoji}</span>
                                       {count > 1 && <span className="text-[9px] font-bold">{count}</span>}
                                     </button>
                                   );
                                })}
                              </div>
                            )}

                            {/* Mobile floating reactions picker */}
                            {activeMobileReactionMessageId === message.id && (
                              <div 
                                className={cn(
                                  "absolute -top-12 z-50 flex items-center gap-1 p-1.5 rounded-full border border-border/50 shadow-xl bg-background/95 backdrop-blur-xl animate-in zoom-in-95 duration-100",
                                  isSender ? "right-0" : "left-0"
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

                            {/* Action Buttons (Absolute) */}
                            {!message.is_deleted && (
                              <div 
                                className={`absolute top-1/2 -translate-y-1/2 ${isSender ? 'right-full mr-3' : 'left-full ml-3'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 z-10`}
                                onDoubleClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 dark:bg-zinc-800/80 hover:bg-muted dark:hover:bg-zinc-700 border border-border/50 text-muted-foreground shadow-sm backdrop-blur-sm">
                                    <Smile className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-fit p-1.5 flex items-center gap-1 rounded-full border-border/50 shadow-xl bg-background/95 backdrop-blur-xl">
                                    {QUICK_REACTIONS.map(emoji => (
                                      <button 
                                        key={emoji} 
                                        onClick={() => handleToggleReaction(message.id, emoji)} 
                                        className="hover:scale-125 transition-transform text-lg p-1.5 leading-none"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 dark:bg-zinc-800/80 hover:bg-muted dark:hover:bg-zinc-700 border border-border/50 text-muted-foreground shadow-sm backdrop-blur-sm">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36 rounded-xl">
                                    {isSender && (
                                      <DropdownMenuItem onClick={() => {
                                        setInfoMessage(message);
                                        setShowInfoDialog(true);
                                      }}>
                                        <Info className="h-3.5 w-3.5 mr-2" /> Info
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                                      <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                                    </DropdownMenuItem>
                                    {(isSender || isAdmin) && (
                                      <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleHideMessage(message.id)}>
                                      <X className="h-3.5 w-3.5 mr-2" /> Hide
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>

                          {!message.is_deleted && (
                            <span className="text-[9px] text-muted-foreground/50 font-bold tabular-nums mb-1">
                              {formatTimestamp(message.created_at)}
                            </span>
                          )}
                        </div>

                        {isSender && (
                          <div className="flex justify-end mt-1 mb-2">
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
                );
              })}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isAtBottom && unreadCount > 0 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
              <Button onClick={() => scrollToBottom()} className="rounded-full shadow-lg h-8 px-4 text-xs" size="sm">
                <ChevronDown className="h-3.5 w-3.5 mr-1" /> {unreadCount} new
              </Button>
            </div>
          )}

          <div className={cn(
            "p-0 transition-colors duration-300 relative",
            isEmojiPickerOpen ? "bg-[#161618]" : "bg-background"
          )}>
            {replyingTo && (
              <div className="mx-2 mb-2 p-2 bg-muted/50 rounded-lg flex items-center justify-between border-l-4 border-primary animate-in slide-in-from-bottom-2">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Replying to {replyingTo.profiles?.username}</p>
                  <p className="text-xs text-muted-foreground truncate opacity-80">{getMessagePreviewText(replyingTo.content)}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer onSend={handleSendMessage} onTyping={startTyping} onStopTyping={stopTyping} disabled={!canSendMessages} isUploading={isUploading} />
          </div>
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
    </div>
  );
};

export default DiscussionChatInterface;
