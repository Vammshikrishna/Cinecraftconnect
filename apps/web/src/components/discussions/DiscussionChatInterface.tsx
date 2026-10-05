import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { StartAudioSpaceButton } from '@/components/calls/StartAudioSpaceButton';
import { useActiveRoomCall } from '@/hooks/useActiveRoomCall';
import {
  ArrowLeft, Settings, Loader2, ChevronDown,
  MessageSquare, Radio, X, MoreVertical, Reply, Trash2, ShieldBan, Smile, Flag, Info, CheckCheck, Copy, Share2, Check, Star, Phone,
  ShieldCheck, Globe, Video, Mic
} from 'lucide-react';
import { CallDetailsDialog } from '@/components/calls/CallDetailsDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboard } from '@/contexts/KeyboardContext';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { StarredMessagesDialog } from '@/components/chat/StarredMessagesDialog';

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
import { getReplyThumbnail, getReplySnippet } from '@/components/chat/chatUtils';
import { MediaAttachment } from '@/components/chat/MediaAttachment';
import { ImageLightboxModal } from '@/components/chat/ImageLightboxModal';
import { useMessageSeen } from '@/hooks/useMessageSeen';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';
import VerificationBadge from '../common/VerificationBadge';
import { useRoomMessageMutation } from '@/hooks/mutations/useRoomMessageMutation';
import { useGroupEncryption } from '@/hooks/useGroupEncryption';
import { playNotificationChime } from '@/utils/notificationSound';

// URL detection for allowLinks enforcement
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const containsURL = (text: string): boolean => URL_PATTERN.test(text);

// Profanity filter
const PROFANITY_LIST: string[] = []; // Extend with actual words as needed
const applyProfanityFilter = (text: string): string => {
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '***');
  });
  return filtered;
};

const isEncryptedPayload = (text: string) => {
  return typeof text === 'string' && (
    (text.startsWith('{') && text.includes('"ciphertext"') && text.includes('"iv"')) ||
    (text.startsWith('{') && text.includes('"type":"group"')) ||
    text.includes('__e2ee_group') ||
    text.includes('__e2ee')
  );
};


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
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string, newSettings?: any) => void;
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
  roomType = 'public',
  onClose,
  onRoomUpdated,
  showBackButton,
  roomSettings
}: DiscussionChatInterfaceProps) => {

  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [currentRoomType, setCurrentRoomType] = useState<'public' | 'private' | 'secret'>(roomType || 'public');
  useEffect(() => {
    if (roomType) setCurrentRoomType(roomType);
  }, [roomType]);
  const isPrivateRoom = currentRoomType === 'private' || currentRoomType === 'secret';

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
  const { encryptGroupMessage, decryptGroupMessage, isReady: isGroupE2EEReady } = useGroupEncryption('room', roomId);

  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const { markAsRead } = useChatReadStatus();
  const { sendRoomMessage, deleteRoomMessage } = useRoomMessageMutation();

  // Global Call state
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall, toggleMinimize, findActiveCall } = useGlobalCall();
  const { isEmojiPickerOpen } = useKeyboard();
  const isInCall = callState.isActive && callState.roomId === roomId;
  // A call or audio space somebody has already started here: the header offers Join, not another start option.
  const activeRoomCall = useActiveRoomCall('discussion', roomId);
  const isCallMinimized = callState.isMinimized;
  
  const [searchParams] = useSearchParams();
  const autoJoinParam = searchParams.get('autoJoin');
  const autoJoinHandled = useRef(false);

  useEffect(() => {
    if (autoJoinParam === 'true' && roomId && !isInCall && !callState.isActive && !autoJoinHandled.current) {
      autoJoinHandled.current = true;
      console.log('📞 [AUTO-JOIN] Launching Discussion Call for room:', roomTitle || roomId);
      joinGlobalCall('discussion', roomId, roomTitle || 'Discussion Room', 'member');
    }
  }, [autoJoinParam, roomId, isInCall, callState.isActive, roomTitle, joinGlobalCall]);
  const [lightboxState, setLightboxState] = useState<{ open: boolean; images: string[]; initialIndex: number; senderName?: string }>({ open: false, images: [], initialIndex: 0 });

  const isDefaultMediaContent = (str?: string | null) => {
    if (!str) return true;
    return /^Shared (\d+ photos|\d+ files|an image|a video|a file)$/i.test(str.trim());
  };
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`starred_msgs_disc_${roomId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showStarredDialog, setShowStarredDialog] = useState(false);
  const [selectedCallMessage, setSelectedCallMessage] = useState<any>(null);
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
        localStorage.setItem(`starred_msgs_disc_${roomId}`, JSON.stringify(Array.from(newSet)));
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
  const [showJoinBanner, setShowJoinBanner] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const [currentSettings, setCurrentSettings] = useState<any>(roomSettings || null);
  const [currentTitle, setCurrentTitle] = useState(roomTitle);
  const [currentDescription, setCurrentDescription] = useState(roomDescription);
  const [roomCreatorId, setRoomCreatorId] = useState<string | null>(null);
  const [actualRole, setActualRole] = useState<string | null>(null);

  useEffect(() => {
    if (roomSettings) setCurrentSettings(roomSettings);
  }, [roomSettings]);

  useEffect(() => {
    if (roomTitle) setCurrentTitle(roomTitle);
  }, [roomTitle]);

  useEffect(() => {
    if (roomDescription !== undefined) setCurrentDescription(roomDescription);
  }, [roomDescription]);

  // Strict permission derivation
  const isCreator = !!(user && roomCreatorId && user.id === roomCreatorId);
  const isAdmin = isCreator || actualRole === 'admin';
  const isSendRestrictedToAdmins = currentSettings?.onlyAdminsSend === true || currentSettings?.onlyAdminsSend === 'admins';
  const canSendMessages = !(isSendRestrictedToAdmins && !isAdmin);
  // Slow mode state
  const [slowModeCooldown, setSlowModeCooldown] = useState(0);
  const slowModeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Derived permission flags from room settings
  const canShareMedia = currentSettings?.allowMediaSharing !== false;
  const canShareLinks = currentSettings?.allowLinks !== false;

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



  const handleBroadcastRead = useCallback(() => {
    if (channelRef.current && user?.id) {
      const nowIso = new Date().toISOString();
      channelRef.current.send({
        type: 'broadcast',
        event: 'read_update',
        payload: {
          userId: user.id,
          user_id: user.id,
          last_read_at: nowIso,
          profile: profile || {
            full_name: (user as any)?.user_metadata?.full_name,
            username: (user as any)?.user_metadata?.username,
          },
        }
      }).catch(console.error);
    }
  }, [user?.id, profile, user]);

  const { observeMessage } = useMessageSeen('room_messages', handleBroadcastRead);
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
    if (!roomId) return;
    const fetchRoomMetaAndRole = async () => {
      try {
        const { data: roomData } = await supabase
          .from('discussion_rooms')
          .select('id, title, description, settings, creator_id, room_type')
          .eq('id', roomId)
          .maybeSingle();

        if (roomData) {
          if (roomData.settings) setCurrentSettings(roomData.settings);
          if (roomData.title) setCurrentTitle(roomData.title);
          if (roomData.description !== undefined) setCurrentDescription(roomData.description);
          if (roomData.room_type) setCurrentRoomType(roomData.room_type as any);
          setRoomCreatorId(roomData.creator_id || null);
        }

        if (user) {
          const { data: memberData } = await supabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (memberData) setActualRole(memberData.role);
          else setActualRole('member');
        } else {
          setActualRole(null);
        }
      } catch (err) {
        console.error('Error fetching room meta & role:', err);
      }
    };
    fetchRoomMetaAndRole();
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
      const targetMsg = messagesRef.current.find(m => m.id === messageId);
      const currentReactions: any[] = targetMsg?.reactions || [];
      
      const existingReaction = currentReactions.find(r => r.emoji === emoji && r.user_id === user.id);
      const isTogglingOff = !!existingReaction;

      const optimisticId = `temp-react-${Date.now()}`;
      let finalReactions: any[] = [];
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
        finalReactions = newReactions;
        updated[idx] = { ...updated[idx], reactions: newReactions };
        return updated;
      });

      if (channelRef.current) {
        // Send room_reaction_toggle so Mobile receives complete reactions array instantly
        channelRef.current.send({
          type: 'broadcast',
          event: 'room_reaction_toggle',
          payload: { msgId: messageId, reactions: finalReactions },
        }).catch(console.error);

        // Send reaction_update for web/delta listeners
        channelRef.current.send({
          type: 'broadcast',
          event: 'reaction_update',
          payload: { 
            eventType: isTogglingOff ? 'DELETE' : 'INSERT', 
            message_id: messageId,
            user_id: user.id,
            emoji,
            [isTogglingOff ? 'old' : 'new']: isTogglingOff ? existingReaction : { id: optimisticId, message_id: messageId, user_id: user.id, emoji, user_profile: profile ? { full_name: profile.full_name || '', avatar_url: profile.avatar_url || '' } : undefined }
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
      const decryptedFetched = await Promise.all(fetchedMessages.map(async (m: any) => {
        const raw = m.raw_content || m.content;
        const isCallMsg = m.media_type === 'call_event' || m.attachment_type === 'call_event' || (raw && raw.startsWith('📞'));
        let decContent = raw;
        if (!isCallMsg && raw && isEncryptedPayload(raw)) {
          try {
            decContent = await decryptGroupMessage(raw);
          } catch (e) {
            console.error('Error decrypting message:', e);
          }
        }
        return {
          ...m,
          raw_content: raw,
          content: decContent || raw || ''
        };
      }));
      const sortedMessages = [...decryptedFetched].sort((a, b) =>
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
        const decryptedOlder = await Promise.all(fetchedMessages.map(async (m: any) => {
          const raw = m.raw_content || m.content;
          const isCallMsg = m.media_type === 'call_event' || m.attachment_type === 'call_event' || (raw && raw.startsWith('📞'));
          let decContent = raw;
          if (!isCallMsg && raw && isEncryptedPayload(raw)) {
            try {
              decContent = await decryptGroupMessage(raw);
            } catch (e) {
              console.error('Error decrypting older message:', e);
            }
          }
          return {
            ...m,
            raw_content: raw,
            content: decContent || raw || ''
          };
        }));
        const sortedNewMessages = [...decryptedOlder].sort((a, b) =>
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
    try {
      const { data } = await supabase
        .from('room_message_read_status' as any)
        .select('user_id, last_read_at, profiles:user_id(full_name, username, avatar_url)')
        .eq('room_id', roomId);

      if (data && data.length > 0) {
        const missingUserIds = data
          .filter((rs: any) => !rs.profiles || (Array.isArray(rs.profiles) && !rs.profiles.length))
          .map((rs: any) => rs.user_id);

        if (missingUserIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .in('id', missingUserIds);

          const profMap: Record<string, any> = {};
          (profs || []).forEach((p: any) => {
            profMap[p.id] = p;
          });

          const merged = data.map((rs: any) => {
            const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
            return {
              ...rs,
              profiles: prof || profMap[rs.user_id] || { full_name: 'Member' },
            };
          });
          setReadStatuses(merged);
          return;
        }

        const normalized = data.map((rs: any) => ({
          ...rs,
          profiles: Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles || { full_name: 'Member' },
        }));
        setReadStatuses(normalized);
      } else if (data) {
        setReadStatuses(data);
      }
    } catch (err) {
      console.warn('Error fetching discussion room read statuses:', err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMessages();
    fetchReadStatuses();
  }, [fetchMessages, fetchReadStatuses, roomId]);

  // Re-decrypt messages when group E2EE key becomes available (private/secret rooms only)
  useEffect(() => {
    if (isGroupE2EEReady && messages.length > 0) {
      const hasEncrypted = messages.some(m => {
        const raw = m.raw_content || m.content;
        return (raw && isEncryptedPayload(raw)) ||
               (m.content && (m.content.startsWith('🔒') || m.content.includes('key loading') || m.content.startsWith('{')));
      });
      if (hasEncrypted) {
        Promise.all(messages.map(async m => {
          const raw = m.raw_content || m.content;
          const isCallMsg = m.media_type === 'call_event' || m.attachment_type === 'call_event' || (raw && raw.startsWith('📞'));
          if (!isCallMsg && raw && isEncryptedPayload(raw)) {
            try {
              const dec = await decryptGroupMessage(raw);
              return { ...m, raw_content: raw, content: dec };
            } catch (e) {
              console.error('Error re-decrypting message:', e);
            }
          }
          return m;
        })).then(updated => {
          setMessages(updated);
        });
      }
    }
  }, [isPrivateRoom, isGroupE2EEReady, decryptGroupMessage]);

  useEffect(() => {
    if (user && roomId && messages.length > 0) {
      markAsRead('discussion', roomId);
      handleBroadcastRead();
    }
  }, [roomId, messages.length, markAsRead, user, handleBroadcastRead]);

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
        const newMsg = { ...payload.new, raw_content: payload.new.content };
        const isCallMsg = newMsg.media_type === 'call_event' || newMsg.attachment_type === 'call_event' || (newMsg.content && newMsg.content.startsWith('📞'));
        if (!isCallMsg && newMsg.content && isEncryptedPayload(newMsg.content)) {
          try {
            newMsg.content = await decryptGroupMessage(newMsg.content);
          } catch (e) {
            console.error('Error decrypting realtime message:', e);
          }
        };


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

        // Sound alert for incoming messages (respecting per-user room notification preferences)
        if (newMsg.user_id !== userRef.current?.id) {
          try {
            const userKey = userRef.current?.id || 'anonymous';
            const rawPrefs = localStorage.getItem(`room_notif_${roomId}_${userKey}`);
            const prefs = rawPrefs ? JSON.parse(rawPrefs) : { muteRoom: false, mentionsOnly: false, soundAlerts: true };
            const isMuted = prefs.muteRoom === true;
            const isMentionsOnly = prefs.mentionsOnly === true;
            const soundEnabled = prefs.soundAlerts !== false;

            const myUsername = profileRef.current?.username?.toLowerCase() || '';
            const msgText = (newMsg.content || '').toLowerCase();
            const hasMention = myUsername && (msgText.includes(`@${myUsername}`) || msgText.includes('@all') || msgText.includes('@everyone'));

            if (!isMuted && (!isMentionsOnly || hasMention) && soundEnabled) {
              playNotificationChime();
            }
          } catch (soundErr) {
            console.warn('Audio chime warning:', soundErr);
          }
        }

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
      const reaction = payload?.new || payload?.old || payload;
      if (!reaction) return;
      const msgId = reaction.message_id;
      if (!msgId) return;

      const isDelete = payload?.eventType === 'DELETE' || (!payload?.new && payload?.old);

      // Instant optimistic update for the reaction
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msgId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const currentReactions: any[] = updated[idx].reactions || [];

        if (isDelete) {
          const filtered = currentReactions.filter((r: any) => {
            if (reaction.id && r.id === reaction.id) return false;
            if (reaction.user_id && r.user_id === reaction.user_id) return false;
            return true;
          });
          updated[idx] = { ...updated[idx], reactions: filtered };
        } else {
          const filtered = currentReactions.filter((r: any) => r.user_id !== reaction.user_id);
          filtered.push({
            id: reaction.id || `temp-react-${Date.now()}`,
            message_id: msgId,
            user_id: reaction.user_id,
            emoji: reaction.emoji,
            user_profile: reaction.user_profile,
          });
          updated[idx] = { ...updated[idx], reactions: filtered };
        }
        return updated;
      });

      // Background profile resolution if not present
      if (!isDelete && !reaction.user_profile && reaction.user_id) {
        supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', reaction.user_id)
          .maybeSingle()
          .then(
            ({ data: profileData }) => {
              if (profileData) {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== msgId) return m;
                    return {
                      ...m,
                      reactions: (m.reactions || []).map((r: any) =>
                        r.user_id === reaction.user_id ? { ...r, user_profile: profileData } : r
                      ),
                    };
                  })
                );
              }
            },
            () => {}
          );
      }
    };

    const channelName = `discussion-room-msgs:${roomId}`;

    // Clean up any stale or lingering channels for this topic to avoid reused closed/unhooked instances
    const existingChannels = supabase.getChannels().filter(
      (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );
    existingChannels.forEach((c) => {
      try {
        c.unsubscribe();
        supabase.removeChannel(c);
      } catch {}
    });

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { ack: false, self: false },
        },
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
         const newMsg = payload?.payload || payload;
         if (newMsg?.id) handleRoomMessageChange({ eventType: 'INSERT', new: newMsg });
      })
      .on('broadcast', { event: 'new_room_message' }, (payload) => {
         const newMsg = payload?.payload || payload;
         if (newMsg?.id) handleRoomMessageChange({ eventType: 'INSERT', new: newMsg });
      })
      .on('broadcast', { event: 'reaction_update' }, (payload) => {
        handleReactionChange(payload?.payload || payload);
      })
      .on('broadcast', { event: 'room_reaction_toggle' }, (payload) => {
        const data = payload?.payload || payload || {};
        const msgId = data.msgId || data.messageId;
        const reactions = data.reactions;
        if (!msgId || !Array.isArray(reactions)) return;
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions } : m)));
      })
      .on('broadcast', { event: 'read_update' }, (payload) => {
        const data = payload?.payload || payload || {};
        const readUid = data.userId || data.user_id;
        const readTime = data.last_read_at || data.lastReadAt || new Date().toISOString();
        if (readUid && readUid !== user?.id) {
          setReadStatuses((prev) => {
            const existingIdx = prev.findIndex((rs) => rs.user_id === readUid);
            const cachedProf = data.profile || (existingIdx >= 0 ? prev[existingIdx].profiles : null);
            if (existingIdx >= 0) {
              const copy = [...prev];
              copy[existingIdx] = {
                ...copy[existingIdx],
                last_read_at: readTime,
                profiles: copy[existingIdx].profiles || cachedProf,
              };
              return copy;
            }
            return [
              ...prev,
              {
                room_id: roomId,
                user_id: readUid,
                last_read_at: readTime,
                profiles: cachedProf || null,
              },
            ];
          });
        }
        fetchReadStatusesRef.current();
      })
      .on('broadcast', { event: 'room_settings_update' }, (payload) => {
        const updated = payload.payload;
        if (updated) {
          if (updated.settings) setCurrentSettings(updated.settings);
          if (updated.title) setCurrentTitle(updated.title);
          if (updated.description !== undefined) setCurrentDescription(updated.description);
          if (onRoomUpdated) onRoomUpdated(roomId, updated.title || currentTitle, updated.description || '', updated.settings);
        }
      })
      .on('broadcast', { event: 'history_cleared' }, () => {
        setMessages([]);
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`
      }, handleRoomMessageChange)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`
      }, handleRoomMessageChange)
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`
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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'discussion_rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        const updated = payload.new as any;
        if (updated) {
          if (updated.settings) setCurrentSettings(updated.settings);
          if (updated.title) setCurrentTitle(updated.title);
          if (updated.description !== undefined) setCurrentDescription(updated.description);
          if (updated.creator_id !== undefined) setRoomCreatorId(updated.creator_id);
          if (onRoomUpdated) onRoomUpdated(roomId, updated.title, updated.description, updated.settings);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${roomId}`
      }, () => {
        if (user && roomId) {
          supabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setActualRole(data.role);
            });
        }
      });

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to discussion room chat:', roomId);
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
    const handleHistoryCleared = (e: any) => {
      if (e.detail?.roomId === roomId) {
        setMessages([]);
      }
    };
    window.addEventListener('room_message_received', handleWindowMessage);
    window.addEventListener('room_history_cleared', handleHistoryCleared);

    return () => {
      window.removeEventListener('room_message_received', handleWindowMessage);
      window.removeEventListener('room_history_cleared', handleHistoryCleared);
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
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

  // Web visibilitychange listener: reconnect channel and refetch messages when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && roomId) {
        fetchMessages(false);
        if (channelRef.current && (channelRef.current as any).state !== 'joined') {
          channelRef.current.subscribe();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [roomId, fetchMessages]);

  // Periodic Background Liveness Heartbeat & Delta Message Sync on Web (every 6 seconds)
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        if (channelRef.current && (channelRef.current as any).state !== 'joined') {
          channelRef.current.subscribe();
        }

        const currentMsgs = messagesRef.current;
        if (!currentMsgs || currentMsgs.length === 0) return;
        const lastMsg = currentMsgs[currentMsgs.length - 1];
        if (!lastMsg?.created_at || (typeof lastMsg.id === 'string' && lastMsg.id.startsWith('temp-'))) return;

        const { data: newMsgs } = await supabase
          .from('room_messages')
          .select('*, profiles:user_id(id, full_name, username, avatar_url, craft)')
          .eq('room_id', roomId)
          .gt('created_at', lastMsg.created_at)
          .order('created_at', { ascending: true });

        if (newMsgs && newMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const toAdd = newMsgs.filter((m: any) => !existingIds.has(m.id));
            if (toAdd.length === 0) return prev;
            return [...prev, ...(toAdd as any[])];
          });
        }
      } catch { }
    }, 6000);

    return () => clearInterval(interval);
  }, [roomId]);

  const [isUploading, setIsUploading] = useState(false);
  const sendingRef = useRef(false);

  const handleSendMessage = async (content: string, files?: File[] | File | null) => {
    const fileList: File[] = Array.isArray(files) ? files : files ? [files] : [];
    if (!user || !roomId || sendingRef.current || (!content.trim() && fileList.length === 0)) return;

    // Enforce onlyAdminsSend
    if (!canSendMessages) {
      toast({ title: 'Restricted', description: 'Only admins can send messages in this room.', variant: 'destructive' });
      return;
    }

    // Enforce allowLinks
    if (!canShareLinks && containsURL(content)) {
      toast({ title: 'Links Blocked', description: 'Sharing links is not allowed in this room.', variant: 'destructive' });
      return;
    }

    // Enforce allowMediaSharing
    if (!canShareMedia && fileList.length > 0) {
      toast({ title: 'Media Blocked', description: 'Media sharing is disabled in this room.', variant: 'destructive' });
      return;
    }

    // Enforce slowMode
    if (currentSettings?.slowMode && !isAdmin && slowModeCooldown > 0) {
      toast({ title: 'Slow Mode', description: `Please wait ${slowModeCooldown}s before sending another message.`, variant: 'destructive' });
      return;
    }

    // Apply profanity filter
    let filteredContent = content;
    if (currentSettings?.profanityFilter && filteredContent) {
      filteredContent = applyProfanityFilter(filteredContent);
    }

    sendingRef.current = true;
    setIsUploading(true);

    // Start slow mode cooldown after a successful send (set below after try)
    const shouldStartCooldown = currentSettings?.slowMode && !isAdmin && currentSettings?.slowModeInterval;

    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (fileList.length === 1) {
        const fileToUpload = fileList[0];
        const { uploadFileToSupabase } = await import('@/utils/fileValidation');
        const { url: uploadedUrl, error: uploadErr } = await uploadFileToSupabase(
          fileToUpload,
          'post-media',
          `room/${roomId}`
        );
        if (uploadErr || !uploadedUrl) {
          throw new Error(uploadErr || 'Failed to upload attachment');
        }
        mediaUrl = uploadedUrl;
        mediaType = fileToUpload.type.startsWith('image/') ? 'image' : fileToUpload.type.startsWith('video/') ? 'video' : 'other';
      } else if (fileList.length > 1) {
        const { uploadFileToSupabase } = await import('@/utils/fileValidation');
        const uploadedUrls = await Promise.all(
          fileList.map(async (fileItem) => {
            const { url, error } = await uploadFileToSupabase(fileItem, 'post-media', `room/${roomId}`);
            if (error || !url) throw new Error(error || 'Failed to upload one of the attachments');
            return url;
          })
        );
        const validUrls = uploadedUrls.filter(Boolean) as string[];
        mediaUrl = JSON.stringify(validUrls);
        mediaType = fileList.every(f => f.type.startsWith('image/')) ? 'image' : 'mixed';
      }

      const rawText = filteredContent.trim() || (mediaType ? `Shared ${fileList.length > 1 ? `${fileList.length} photos` : mediaType === 'image' ? 'an image' : mediaType === 'video' ? 'a video' : 'a file'}` : '');

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const optimisticMessage: Message = {
        id: tempId,
        content: rawText,
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

      let textToSend = rawText;
      if (isPrivateRoom) {
        try {
          textToSend = await encryptGroupMessage(rawText);
        } catch (e) {
          console.error("Group encryption failed:", e);
          toast({
            title: "Encryption Unavailable",
            description: "Cannot send message: Security key setup or PIN recovery is required.",
            variant: "destructive"
          });
          return;
        }
      }

      setMessages(prev => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom(), 50);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
             id: optimisticMessage.id,
             room_id: roomId,
             content: textToSend,
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
        textToSend,
        { replyToId: replyingTo?.id, mediaUrl, mediaType }
      );

      setReplyingTo(null);
      stopTyping();
      fetchMessages();

      // Start slow mode cooldown after successful send
      if (shouldStartCooldown) {
        setSlowModeCooldown(currentSettings.slowModeInterval);
        if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current);
        slowModeTimerRef.current = setInterval(() => {
          setSlowModeCooldown(prev => {
            if (prev <= 1) {
              if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
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


  // Starting a call ENDS any call already running in the room (one call per room), so if one is live — a normal call or
  // an audio space — join it instead of replacing it.
  const handleStartAudioSpace = async (speakingMode: 'open' | 'request') => {
    setCallLoading(true);
    const active = await findActiveCall('discussion', roomId);
    const success = active
      ? await joinGlobalCall('discussion', roomId, roomTitle, userRole as any)
      : await startGlobalCall('discussion', roomId, roomTitle, userRole as any, { mode: 'audio_space', speakingMode });
    setCallLoading(false);
    if (success) {
      toast({
        title: active ? "Joined the live room" : "🎙️ Audio space started",
        description: active ? "Something is already running here, so you joined it." : "Listeners can join now. You are on stage.",
      });
    } else {
      toast({ title: "Could not start the audio space", description: "Audio spaces need the latest server update: run the database part_n SQL and deploy the livekit-token and space-control functions.", variant: "destructive" });
    }
  };

  const handleStartSpace = async () => {
    setCallLoading(true);
    const active = await findActiveCall('discussion', roomId);
    // Simple casting for role compatibility
    const success = active
      ? await joinGlobalCall('discussion', roomId, roomTitle, userRole as any)
      : await startGlobalCall('discussion', roomId, roomTitle, userRole as any);
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

  const visibleMessages = useMemo(() => {
    return messages.filter(m => !m.deleted_for_users?.includes(user?.id || ''));
  }, [messages, user?.id]);

  const messageSeenUsersMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!readStatuses?.length || !visibleMessages?.length || !user?.id) return map;

    const ownMessages = visibleMessages.filter(m => m.user_id === user.id && m.created_at);

    (readStatuses || []).forEach((rs: any) => {
      if (!rs.user_id || rs.user_id === user.id || !rs.last_read_at) return;
      const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
      const name = prof?.full_name?.split(' ')[0] || prof?.username || 'Member';
      const ts = new Date(rs.last_read_at).getTime();

      let lastSeenMsgId: string | null = null;
      for (let i = ownMessages.length - 1; i >= 0; i--) {
        const m = ownMessages[i];
        const msgTs = new Date(m.created_at).getTime();
        if (ts >= msgTs - 1000) {
          lastSeenMsgId = m.id;
          break;
        }
      }

      if (lastSeenMsgId) {
        if (!map.has(lastSeenMsgId)) {
          map.set(lastSeenMsgId, []);
        }
        map.get(lastSeenMsgId)!.push(name);
      }
    });

    return map;
  }, [readStatuses, visibleMessages, user?.id]);

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  const renderMessageContent = (message: Message) => {
    const { content, media_url, media_type } = message;
    return (
      <>
        {media_url && (
          <div className="mb-1">
            <MediaAttachment
              url={media_url}
              type={media_type}
              onSelectMedia={(clickedUrl, idx, allUrls) => {
                setLightboxState({
                  open: true,
                  images: allUrls && allUrls.length > 0 ? allUrls : [clickedUrl],
                  initialIndex: idx || 0,
                  senderName: message.user_id === user?.id ? 'You' : (message.profiles?.full_name || message.profiles?.username || 'User'),
                });
              }}
            />
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
        ) : (content && !isDefaultMediaContent(content)) ? (
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

  return (
    <div className="flex flex-col flex-1 w-full bg-background text-foreground overflow-hidden relative">
      {/* HEADER */}
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background/95 backdrop-blur-md z-30 sticky top-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {(showBackButton || !isDesktop) && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          <div className="min-w-0 flex-1 overflow-hidden pr-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg truncate text-foreground flex items-center">
                {currentSettings?.roomEmoji && <span className="mr-2 text-xl">{currentSettings.roomEmoji}</span>}
                {currentTitle}
              </h2>
              {isPrivateRoom ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0" title="End-to-End Encrypted Room">
                  <ShieldCheck className="w-3 h-3" />
                  E2EE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full shrink-0" title="Public Discussion Room">
                  <Globe className="w-3 h-3" />
                  Public
                </span>
              )}
              {isInCall && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isInCall && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartSpace}
              disabled={callLoading}
              // Same small round icon button as the audio-space one next to it; green when a call/space is already live.
              className={
                activeRoomCall
                  ? 'h-8 w-8 rounded-full shrink-0 text-green-500 bg-green-500/10 hover:bg-green-500/20 hover:text-green-500'
                  : 'h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10'
              }
              title={activeRoomCall ? (activeRoomCall.mode === 'audio_space' ? 'Join the live audio space' : 'Join the live call') : 'Start a video call'}
            >
              {callLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : activeRoomCall?.mode === 'audio_space' ? (
                <Mic className="h-4 w-4" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </Button>
          )}
          {!isInCall && !activeRoomCall && <StartAudioSpaceButton onStart={handleStartAudioSpace} disabled={callLoading} />}



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
              currentTitle={currentTitle}
              currentDescription={currentDescription}
              currentCategory={categoryId}
              categories={categories}
              onRoomUpdated={onRoomUpdated}
              onClose={() => setSettingsOpen(false)}
            />
          </Dialog>
        </div>
      </header>

      {/* PINNED MESSAGE BANNER */}
      {currentSettings?.pinnedMessage && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5 flex items-start gap-3 shadow-sm z-10 shrink-0">
          <div className="p-1.5 rounded-full bg-primary/10 text-primary mt-0.5">
            <MessageSquare className="h-3.5 w-3.5 fill-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-0.5">Pinned Message</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed line-clamp-2">{currentSettings.pinnedMessage}</p>
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
          <div id="discussion-call-container" className={`${isDesktop ? 'w-[55%] border-r' : 'w-full'} border-border/30 flex flex-col shrink-0 overflow-hidden relative bg-[#09090b]`} />
        )}

        {/* CHAT AREA */}
        <div className={`flex flex-col flex-1 min-w-0 bg-background ${(!isDesktop && isInCall && mobileTab === 'discussion' && !isCallMinimized) ? 'hidden' : 'flex'} relative`}>
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
            className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 scrollbar-hide"
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
                {currentSettings?.welcomeMessage && (
                  <div className="flex flex-col items-center mb-6 mt-4">
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 max-w-sm text-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-xl">👋</span>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Welcome to the Room!</h3>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentSettings.welcomeMessage}</p>
                    </div>
                  </div>
                )}

                {visibleMessages.map((message, idx) => {
                  const isSender = message.user_id === user?.id;
                  const isShare = isShareContent(message.content);
                  const messageDate = new Date(message.created_at);
                  const prevMessage = idx > 0 ? visibleMessages[idx - 1] : null;
                  const showDateSeparator = !prevMessage || !isSameDay(messageDate, new Date(prevMessage.created_at));
                  const nextMessage = idx < visibleMessages.length - 1 ? visibleMessages[idx + 1] : null;
                  const isNextDateSeparator = nextMessage ? !isSameDay(new Date(nextMessage.created_at), messageDate) : false;
                  const isSameSenderAsNext = !!(nextMessage && !isNextDateSeparator && nextMessage.user_id === message.user_id);
                  const isSameSenderAsPrev = !!(prevMessage && !showDateSeparator && prevMessage.user_id === message.user_id);

                  const showAvatar = !isSameSenderAsNext;
                  const showSenderName = !isSender && !isSameSenderAsPrev && !message.is_deleted;

                  const uniqueSeenBy = isSender ? (messageSeenUsersMap.get(message.id) || []) : [];

                  const isCallEvent = message.media_type === 'call_event' || (message as any).attachment_type === 'call_event' || (typeof message.content === 'string' && (message.content.includes('Video call started') || message.content.includes('Call ended') || message.content.includes('call started') || message.content.includes('📞')));

                  if (isCallEvent) {
                    const isStarted = message.content?.includes('started');
                    const cleanContent = message.content ? message.content.replace(/^📞\s*/, '') : '';
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
                          onClick={() => setSelectedCallMessage(message)}
                          className="flex justify-center my-3 cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-all"
                          title="Click to view call details"
                        >
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary/80 border border-border/40 backdrop-blur-md shadow-sm transition-all">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              isStarted ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-400"
                            )}>
                              <Phone className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-medium text-foreground">
                              {cleanContent}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {format(messageDate, 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

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
                        data-sender-id={message.user_id}
                        className={cn(
                          "flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                          isSender ? 'flex-row-reverse' : 'flex-row',
                          isSameSenderAsNext ? 'mb-1' : 'mb-3',
                          message.status === 'pending' && isSender && 'opacity-60 saturate-50'
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
                        <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} max-w-[85%] relative`}>
                          <div className={`flex ${isSender ? 'flex-row-reverse' : 'flex-row'} items-center gap-1 group relative ${message.reactions && message.reactions.length > 0 ? 'mb-4' : ''}`}>
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
                              message.is_deleted ? "bg-muted/50 border border-dashed border-border/50 p-3 rounded-xl italic text-muted-foreground" :
                              isShare ? "bg-transparent rounded-2xl border border-border/10" :
                              (message.media_url && isDefaultMediaContent(message.content)) ? "p-0 bg-transparent rounded-xl shadow-xl" :
                              isSender ? "bg-gradient-to-br from-chat-outgoing-bg-start to-chat-outgoing-bg-end text-chat-outgoing-text font-medium rounded-[22px] rounded-tr-[4px] px-4 py-2.5 shadow-sm hover:shadow-md" :
                              "bg-chat-incoming-bg border border-chat-incoming-border text-chat-incoming-text dark:bg-muted dark:border-transparent dark:text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm hover:shadow-md"
                            )}>
                              {!isSender && !message.is_deleted && (
                                showSenderName ? (
                                  <div className="flex items-center justify-between gap-4 mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className={`text-[11px] font-bold ${getUserColor(message.user_id)}`}>
                                        {message.profiles?.username || message.profiles?.full_name || 'User'}
                                      </p>
                                      {message.profiles?.is_verified && (
                                          <VerificationBadge size="xs" />
                                        )}
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button 
                                          className="p-1 text-current opacity-80 hover:opacity-100 rounded focus:outline-none inline-flex items-center justify-center shrink-0 min-w-[18px] min-h-[18px] pointer-events-auto"
                                          title="Options"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span className="inline-flex items-center justify-center">
                                            <ChevronDown className="h-4 w-4" />
                                          </span>
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start" className="w-40 z-50">
                                      {!message.is_deleted && (
                                        <DropdownMenuItem onClick={() => setActiveMobileReactionMessageId(message.id)}>
                                          <Smile className="h-3.5 w-3.5 mr-2" /> React
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => handleToggleStarMessages([message.id])}>
                                        <Star className={cn("h-3.5 w-3.5 mr-2", starredMessageIds.has(message.id) && "fill-amber-400 text-amber-400")} />
                                        <span>{starredMessageIds.has(message.id) ? 'Unstar' : 'Star'}</span>
                                      </DropdownMenuItem>
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
                                      {(isSender || isAdmin) && (
                                        <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                        </DropdownMenuItem>
                                      )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                ) : null)}
                              {message.reply_to_id && !message.is_deleted && (() => {
                                const repliedMsg = messages.find(m => m.id === message.reply_to_id);
                                if (!repliedMsg) return null;
                                const repThumb = getReplyThumbnail(repliedMsg);
                                const rawText = repliedMsg.is_deleted ? 'Message deleted' : getMessagePreviewText(repliedMsg.content);
                                const snippet = repliedMsg.is_deleted ? rawText : getReplySnippet(repliedMsg, rawText);
                                return (
                                  <div 
                                     onClick={() => scrollToMessage(message.reply_to_id!)}
                                     className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-85 active:scale-[0.98] transition-all flex items-center justify-between gap-2.5 ${isSender ? 'bg-black/15 border-l-white text-white/90' : 'bg-black/5 dark:bg-white/5 border-l-primary text-foreground/90'}`}
                                   >
                                    <div className="flex-1 min-w-0">
                                      <div className={`font-black text-[9px] uppercase tracking-tighter mb-0.5 truncate ${isSender ? 'text-white font-bold' : getUserColor(repliedMsg.user_id)}`}>
                                        @{repliedMsg.profiles?.username || repliedMsg.profiles?.full_name || 'User'}
                                      </div>
                                      <div className={`opacity-80 line-clamp-1 truncate ${isSender ? 'text-white/80' : 'text-muted-foreground'}`}>
                                        {snippet}
                                      </div>
                                    </div>
                                    {repThumb && (
                                      <img loading="lazy" decoding="async"
                                        src={repThumb}
                                        alt="thumbnail"
                                        className="w-9 h-9 rounded-md object-cover shrink-0 border border-black/10 dark:border-white/10"
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                              {message.is_deleted ? (
                                <p className="text-sm italic opacity-70 flex items-center gap-1.5 py-0.5">
                                 This message was deleted
                               </p>
                              ) : (
                                renderMessageContent(message)
                              )}

                                   {/* WhatsApp style inline timestamp for normal text messages */}
                                   {!message.is_deleted && !isShare && (
                                     <span className="inline-flex items-center gap-1 float-right text-[10px] ml-2.5 mt-1.5 align-baseline select-none shrink-0 leading-none text-chat-text-muted/80 dark:text-muted-foreground/80">
                                       {starredMessageIds.has(message.id) && (
                                         <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline shrink-0 mr-0.5" />
                                       )}
                                       <span>{format(new Date(message.created_at), 'p')}</span>

                                       {(isSender || !showSenderName) && (
                                         <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                             <button 
                                               className="p-0 text-current opacity-80 hover:opacity-100 rounded focus:outline-none inline-flex items-center justify-center shrink-0 min-w-[16px] min-h-[16px] pointer-events-auto ml-0.5"
                                               title="Options"
                                               onClick={(e) => e.stopPropagation()}
                                             >
                                               <ChevronDown className="h-3.5 w-3.5" />
                                             </button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-40 z-[60]">
                                             {!message.is_deleted && (
                                               <DropdownMenuItem onClick={() => setActiveMobileReactionMessageId(message.id)}>
                                                 <Smile className="h-3.5 w-3.5 mr-2" /> React
                                               </DropdownMenuItem>
                                             )}
                                             {isSender && (
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
                                             <DropdownMenuItem onClick={() => handleToggleStarMessages([message.id])}>
                                               <Star className={cn("h-3.5 w-3.5 mr-2", starredMessageIds.has(message.id) && "fill-amber-400 text-amber-400")} />
                                               <span>{starredMessageIds.has(message.id) ? 'Unstar' : 'Star'}</span>
                                             </DropdownMenuItem>
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
                                             {(isSender || isAdmin) && (
                                               <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                                 <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                               </DropdownMenuItem>
                                             )}
                                           </DropdownMenuContent>
                                         </DropdownMenu>
                                       )}
                                     </span>
                                   )}

                        {/* Reactions Pill */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className={cn(
                            "absolute -bottom-3.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/95 backdrop-blur-md border border-border/80 shadow-md left-2"
                          )}>
                            {Array.from(new Set((message.reactions || []).map((r: any) => String(r.emoji)))).map((emoji: string) => {
                               const count = (message.reactions || []).filter((r: any) => r.emoji === emoji).length;
                               const hasReacted = (message.reactions || []).some((r: any) => r.emoji === emoji && r.user_id === user?.id);
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

                      {/* Hover Reaction Button (like DM Chat) */}
                      {!message.is_deleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMobileReactionMessageId(prev => prev === message.id ? null : message.id);
                          }}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all opacity-0 group-hover:opacity-100 shrink-0 z-20",
                            isSender ? "-left-8" : "-right-8",
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
                          </div>
                          {/* Dedicated timestamp row for share cards below card */}
                          {isShare && !message.is_deleted && (
                            <div className="w-full flex items-center justify-end gap-1 mt-1 px-1 text-[10px] text-chat-text-muted/80 dark:text-muted-foreground/80 select-none">
                              {starredMessageIds.has(message.id) && (
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline shrink-0 mr-0.5" />
                              )}
                              <span>{format(new Date(message.created_at), 'p')}</span>

                              {(isSender || !showSenderName) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button 
                                      className="p-0 text-current opacity-80 hover:opacity-100 rounded focus:outline-none inline-flex items-center justify-center shrink-0 min-w-[16px] min-h-[16px] pointer-events-auto ml-0.5"
                                      title="Options"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-40 z-[60]">
                                    {!message.is_deleted && (
                                      <DropdownMenuItem onClick={() => setActiveMobileReactionMessageId(message.id)}>
                                        <Smile className="h-3.5 w-3.5 mr-2" /> React
                                      </DropdownMenuItem>
                                    )}
                                    {isSender && (
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
                                    <DropdownMenuItem onClick={() => handleToggleStarMessages([message.id])}>
                                      <Star className={cn("h-3.5 w-3.5 mr-2", starredMessageIds.has(message.id) && "fill-amber-400 text-amber-400")} />
                                      <span>{starredMessageIds.has(message.id) ? 'Unstar' : 'Star'}</span>
                                    </DropdownMenuItem>
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
                                    {(isSender || isAdmin) && (
                                      <DropdownMenuItem onClick={() => handleUndoMessage(message.id)} className="text-destructive focus:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                          {/* Seen status info block */}
                          {isSender && (!isSameSenderAsNext || uniqueSeenBy.length > 0) && (
                            <div className="w-full text-right mt-0.5 mb-1 px-1 select-none">
                              {uniqueSeenBy.length > 0 ? (
                                <span 
                                  className="text-[9px] font-bold text-primary/70 tracking-tight cursor-pointer hover:underline inline-block text-right"
                                  onClick={() => {
                                    setInfoMessage(message);
                                    setShowInfoDialog(true);
                                  }}
                                >
                                  Seen by {uniqueSeenBy.join(', ')}
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-muted-foreground/60 tracking-tight inline-block text-right">
                                  {message.status === 'pending' ? 'Sending...' : 'Sent'}
                                </span>
                              )}
                            </div>
                          )}
                         </div>
                       </div>
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
            {replyingTo && (() => {
              const repThumb = getReplyThumbnail(replyingTo);
              const rawText = getMessagePreviewText(replyingTo.content);
              const snippet = getReplySnippet(replyingTo, rawText);
              return (
                <div className="mx-2 mb-2 p-2 bg-muted/50 rounded-lg flex items-center justify-between border-l-4 border-primary animate-in slide-in-from-bottom-2 gap-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary truncate">
                      Replying to {replyingTo.profiles?.username || replyingTo.profiles?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate opacity-80">
                      {snippet}
                    </p>
                  </div>
                  {repThumb && (
                    <img loading="lazy" decoding="async"
                      src={repThumb}
                      alt="thumbnail"
                      className="w-8 h-8 rounded-md object-cover shrink-0 border border-border"
                    />
                  )}
                  <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-muted rounded text-muted-foreground shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })()}
            <TypingIndicator typingUsers={typingUsers} />
            <MessageComposer onSend={handleSendMessage} onTyping={startTyping} onStopTyping={stopTyping} disabled={!canSendMessages} isUploading={isUploading} slowModeCooldown={slowModeCooldown} disableMedia={!canShareMedia} />
          </div>
        </div>
      </div>

      <ImageLightboxModal
        open={lightboxState.open}
        onOpenChange={(open) => setLightboxState(prev => ({ ...prev, open }))}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        senderName={lightboxState.senderName}
      />

      {/* Message Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Message Info</DialogTitle>
            <DialogDescription>
              Details of who has seen this message.
            </DialogDescription>
            <div className="mt-2">
              {isPrivateRoom ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>End-to-End Encrypted Message</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-medium">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Public Discussion Message</span>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto py-2 divide-y divide-border/30">
            {infoMessage && (() => {
              const messageTime = new Date(infoMessage.created_at).getTime();
              const viewers = readStatuses.filter(rs => {
                if (rs.user_id === user?.id) return false;
                try {
                  const statusTime = new Date(rs.last_read_at).getTime();
                  return statusTime >= messageTime - 1000;
                } catch (e) { return false; }
              });

              if (viewers.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No one else has seen this message yet.
                  </p>
                );
              }

              return viewers.map(rs => {
                const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
                const name = prof?.full_name || prof?.username || 'User';
                const avatar = prof?.avatar_url;
                return (
                  <div key={rs.user_id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={avatar || undefined} />
                        <AvatarFallback className="text-xs bg-secondary text-secondary-foreground font-bold">
                          {name[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold leading-none mb-1">
                          {name}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-none">
                          Read
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {rs.last_read_at ? format(new Date(rs.last_read_at), 'p') : ''}
                    </span>
                  </div>
                );
              });
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
      {/* Call Details Dialog */}
      <CallDetailsDialog
        isOpen={!!selectedCallMessage}
        onClose={() => setSelectedCallMessage(null)}
        message={selectedCallMessage}
        roomType="discussion"
        roomId={roomId || ''}
      />
    </div>
  );
};

export default DiscussionChatInterface;
