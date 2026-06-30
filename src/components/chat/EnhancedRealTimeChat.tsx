import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User, BellOff, Paperclip, Play, FileText, X, Send, Smile, Keyboard, ShieldBan, Trash2, Reply, MoreVertical, Video, Phone, Settings, ArrowLeft, ShieldAlert, Search, Flag, Info } from 'lucide-react';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import { useCall } from '@/hooks/useCall';
import { useGlobalCall } from '@/contexts/CallContext';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme as EmojiTheme } from 'emoji-picker-react';
import { PostShareCard } from './PostShareCard';
import { ProfileShareCard } from './ProfileShareCard';
import { PitchShareCard } from './PitchShareCard';
import { CompanyShareCard } from './CompanyShareCard';
import { ContentShareCard } from './ContentShareCard';
import { MarketplaceShareCard } from './MarketplaceShareCard';
import { AnnouncementShareCard } from './AnnouncementShareCard';
import { VendorShareCard } from './VendorShareCard';
import { JobShareCard } from './JobShareCard';
import { ProjectShareCard } from './ProjectShareCard';
import { DiscussionShareCard } from './DiscussionShareCard';
import { usePresence } from '@/hooks/usePresence';
import { useChatReadStatus } from '@/hooks/useChatReadStatus';
import VerificationBadge from '../common/VerificationBadge';
import { TypingIndicator } from '../discussions/TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useE2EEChatKeys } from '@/hooks/useE2EEChatKeys';
import { decryptDirectMessage, encryptDirectMessage } from '@/lib/e2ee';
import { MessageReportDialog } from './MessageReportDialog';
import { CachedImage } from '@/components/common/CachedImage';
import { CachedVideo } from '@/components/common/CachedVideo';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
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
  reactions?: MessageReaction[];
}

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
    const bubble = element.querySelector('.relative.transition-all.duration-300') || element.querySelector('.rounded-xl');
    if (bubble) {
      bubble.classList.add('ring-4', 'ring-primary/40', 'scale-105', 'transition-all');
      setTimeout(() => {
        bubble.classList.remove('ring-4', 'ring-primary/40', 'scale-105');
      }, 1200);
    }
  }
};

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

const EnhancedRealTimeChat = ({ roomId, partnerId, partnerName, partnerAvatarUrl, partnerIsVerified, onBackClick }: EnhancedRealTimeChatProps) => {
  const { user, profile } = useAuth();
  const { push } = useAppNavigation();
  const { onlineUserIds } = usePresence();
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId || '');
  const { privateKey, partnerPublicKey, userPublicKey, keysLoaded } = useE2EEChatKeys(partnerId);
  const privateKeyRef = useRef(privateKey);
  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const reactionLocksRef = useRef<Set<string>>(new Set());
  const markedReadRef = useRef<Set<string>>(new Set());
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reportingMessage, setReportingMessage] = useState<{ id: string, content: string } | null>(null);
  const { markAsRead } = useChatReadStatus();
  const { toast } = useToast();
  const { callState, startCall: startGlobalCall, joinCall: joinGlobalCall } = useGlobalCall();
  const { activeCall } = useCall('direct', roomId || '');
  const isInCall = callState.isActive && callState.roomId === roomId;
  
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{file: File, preview: string, type: 'image' | 'video' | 'other'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const globalUpdatesChannelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const isInitialLoad = useRef(true);
  const { isEmojiPickerOpen: showEmojiPicker, setIsEmojiPickerOpen: setShowEmojiPicker, keyboardHeight } = useKeyboard();
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
  const isPartnerOnline = onlineUserIds.includes(partnerId);
  
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollContainerRef.current) {
      const targetScroll = scrollContainerRef.current.scrollHeight;
      if (behavior === 'smooth') {
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest('button')?.querySelector('.lucide-smile')) {
          setShowEmojiPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Access the global updates channel. It is managed and subscribed by the parent page/sidebar components,
    // so we do not call removeChannel on unmount to prevent tearing down the sidebar's subscription.
    const channel = supabase.channel('global_chat_updates');
    channel.subscribe();
    globalUpdatesChannelRef.current = channel;
  }, []);



  const processMessages = async (msgs: Message[]) => {
    if (!user) return msgs;
    return await Promise.all(msgs.map(async m => {
      try {
        const isSender = m.sender_id === user.id;
        let decryptedContent = m.content;
        
        if (m.content.includes('__e2ee')) {
           if (!privateKey) {
             decryptedContent = '🔒 Encrypted Message (Unlock required)';
           } else {
             decryptedContent = await decryptDirectMessage(m.content, privateKey, isSender);
           }
        }
        
        let repliedToMessage = m.replied_to_message;
        if (repliedToMessage && repliedToMessage.content.includes('__e2ee')) {
          if (!privateKey) {
            repliedToMessage = { ...repliedToMessage, content: '🔒 Encrypted Message' };
          } else {
            try {
              const originalWasSender = repliedToMessage.sender_profile?.full_name === profile?.full_name;
              const decryptedReply = await decryptDirectMessage(repliedToMessage.content, privateKey, originalWasSender);
              repliedToMessage = { ...repliedToMessage, content: decryptedReply };
            } catch (e) {
              console.error("Failed to decrypt replied message", e);
            }
          }
        }

        return { ...m, content: decryptedContent, replied_to_message: repliedToMessage };
      } catch (err) {
        console.error("Failed to decrypt message:", err);
        return m;
      }
    }));
  };

  const fetchReactions = async (msgs: Message[]) => {
    const msgIds = msgs.map(m => m.id);
    if (msgIds.length === 0) return msgs;
    
    const { data, error } = await supabase
      .from('direct_message_reactions')
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

  const fetchMessages = useCallback(async (isNewRoom = true) => {
    if (!roomId || !keysLoaded) return;
    
    if (isNewRoom) {
      setLoading(true);
      isInitialLoad.current = true;
    }

    const { data, error } = await supabase.rpc('get_messages_for_channel_paginated', { 
      p_channel_id: roomId,
      p_limit: 30,
      p_offset: 0
    });

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_messages_for_channel', { p_channel_id: roomId });
      if (fallbackError) {
        console.error('Error fetching messages:', fallbackError);
        setMessages([]);
      } else {
        const processed = await processMessages(fallbackData as Message[]);
        const withReactions = await fetchReactions(processed);
        setMessages(withReactions);
        setHasMore(false);
      }
    } else {
      const fetchedMessages = (data as Message[]) || [];
      const sortedMessages = [...fetchedMessages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const processed = await processMessages(sortedMessages);
      const withReactions = await fetchReactions(processed);
      setMessages(withReactions);
      setHasMore(fetchedMessages.length === 30);
    }
    setLoading(false);
  }, [roomId, privateKey, keysLoaded, user?.id, profile?.full_name]);

  const loadMoreMessages = async () => {
    if (!roomId || loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    lastScrollHeight.current = scrollContainerRef.current?.scrollHeight || 0;

    const { data, error } = await supabase.rpc('get_messages_for_channel_paginated', {
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
        const processed = await processMessages(sortedNewMessages);
        const withReactions = await fetchReactions(processed);
        setMessages(prev => [...withReactions, ...prev]);
        setHasMore(fetchedMessages.length === 30);
      } else {
        setHasMore(false);
      }
    }
    setLoadingMore(false);
  };

  const fetchMessagesRef = useRef(fetchMessages);
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    isInitialLoad.current = true;
  }, [roomId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (partnerId && messages.length > 0) {
      console.log(`[EnhancedRealTimeChat] Evaluating unread messages. Total messages: ${messages.length}, partnerId: ${partnerId}`);
      const unreadMessages = messages.filter(m => {
        const isIncoming = m.sender_id === partnerId;
        const isUnread = !m.is_read;
        const isNotTemp = !String(m.id).startsWith('temp-');
        return isIncoming && isUnread && isNotTemp;
      });
      console.log(`[EnhancedRealTimeChat] Unread incoming messages count: ${unreadMessages.length}`);
      
      const toMark = unreadMessages.filter(m => !markedReadRef.current.has(m.id));
      console.log(`[EnhancedRealTimeChat] Unread messages not yet marked: ${toMark.length}`);
      
      if (toMark.length > 0) {
        // The RPC marks all messages up to this ID as read
        const latest = toMark[toMark.length - 1];
        console.log(`[EnhancedRealTimeChat] Triggering markAsRead for message: ${latest.id}`);
        markAsRead('dm', partnerId, latest.id);
        
        // Add to ref to prevent duplicate calls before postgres_changes arrives
        toMark.forEach(m => markedReadRef.current.add(m.id));

        // Instantly broadcast the read receipt to the sender
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'message_seen',
            payload: { messageId: latest.id }
          }).catch(console.error);
        }
      }
    }
  }, [partnerId, messages, markAsRead]);


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

    const handleDirectMessageChange = async (payload: any) => {
      console.log('[Realtime] EnhancedRealTimeChat received payload:', payload);
      const msg = payload.new || payload.old;
      if (msg && msg.channel_id !== roomId) return;
      
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;
        const isMyMessage = newMsg.sender_id === user?.id;
        console.log('[Realtime] Processing new message:', newMsg.id);

        let decryptedContent = newMsg.content;
        if (newMsg.content?.includes('__e2ee')) {
            if (privateKeyRef.current) {
                try {
                  decryptedContent = await decryptDirectMessage(newMsg.content, privateKeyRef.current, isMyMessage);
                } catch (e) {
                  console.error("Failed to decrypt real-time message", e);
                }
            } else {
                decryptedContent = '🔒 Encrypted Message (Unlock required)';
            }
        }

        setMessages(prev => {
          const hasAlready = prev.some(m => m.id === newMsg.id);
          if (hasAlready) return prev;

          // Ignore delayed broadcasts of our own optimistic messages to prevent duplicates
          if (String(newMsg.id).startsWith('temp-') && isMyMessage) {
            return prev;
          }

          // Deduplicate incoming broadcasts against existing real messages
          if (String(newMsg.id).startsWith('temp-') && !isMyMessage) {
            const hasRealMessage = prev.some(m => 
              m.sender_id === newMsg.sender_id && 
              m.content === decryptedContent && 
              !String(m.id).startsWith('temp-') && 
              Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000
            );
            if (hasRealMessage) {
               return prev;
            }
          }

          // Find if we have a pending optimistic message with matching content and update its ID
          const pendingIdx = prev.findIndex(m => 
            (String(m.id).startsWith('temp-')) && 
            m.sender_id === newMsg.sender_id && 
            m.content === decryptedContent
          );

          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = {
              ...updated[pendingIdx],
              id: newMsg.id,
              created_at: newMsg.created_at,
              content: decryptedContent
            };
            return updated;
          }

          const sender_profile = isMyMessage ? {
            full_name: profile?.full_name || user?.user_metadata?.full_name || 'You',
            avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || '',
            is_verified: profile?.is_verified || false
          } : {
            full_name: partnerName || '',
            avatar_url: partnerAvatarUrl || '',
            is_verified: partnerIsVerified || false
          };

          let replied_to_message = undefined;
          if (newMsg.reply_to_id) {
            const repliedMsg = prev.find(m => m.id === newMsg.reply_to_id);
            if (repliedMsg) {
               replied_to_message = {
                 id: repliedMsg.id,
                 content: repliedMsg.content,
                 is_deleted: repliedMsg.is_deleted,
                 sender_profile: repliedMsg.sender_profile
               };
            }
          }

          const appended: Message = {
            id: newMsg.id,
            content: decryptedContent,
            created_at: newMsg.created_at,
            sender_id: newMsg.sender_id,
            is_deleted: newMsg.is_deleted,
            reply_to_id: newMsg.reply_to_id,
            attachment_url: newMsg.attachment_url,
            attachment_type: newMsg.attachment_type,
            deleted_for_users: newMsg.deleted_for_users || [],
            sender_profile: sender_profile,
            replied_to_message: replied_to_message
          };
          return [...prev, appended];
        });

        setTimeout(() => scrollToBottom(), 100);

      } else if (payload.eventType === 'UPDATE') {
        const updatedMsg = payload.new;
        const isMyMessage = updatedMsg.sender_id === user?.id;

        let decryptedContent = updatedMsg.content;
        if (updatedMsg.content?.includes('__e2ee')) {
            if (privateKeyRef.current) {
                try {
                  decryptedContent = await decryptDirectMessage(updatedMsg.content, privateKeyRef.current, isMyMessage);
                } catch (e) {
                  console.error("Failed to decrypt updated real-time message", e);
                }
            } else {
                decryptedContent = '🔒 Encrypted Message (Unlock required)';
            }
        }

        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? {
          ...m,
          content: decryptedContent,
          is_deleted: updatedMsg.is_deleted,
          attachment_url: updatedMsg.attachment_url,
          attachment_type: updatedMsg.attachment_type,
          deleted_for_users: updatedMsg.deleted_for_users || [],
          is_read: updatedMsg.is_read,
          read_at: updatedMsg.read_at
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
          
          // Remove any existing reactions from THIS user to prevent orphans from temp IDs
          newReactions = newReactions.filter(r => r.user_id !== reaction.user_id);
          
          newReactions.push({ ...reaction, user_profile: profile || undefined });
          
          updated[idx] = { ...updated[idx], reactions: newReactions };
          return updated;
        });
      } else if (payload.eventType === 'DELETE') {
        // payload.old might only have { id }, so we must search messages for the matching reaction ID.
        // If it comes from our broadcast, it has full context (message_id, user_id) so we aggressively wipe all reactions from that user.
        setMessages(prev => {
          const updated = [...prev];
          
          if (reaction.message_id && reaction.user_id) {
            // Broadcast DELETE
            const idx = updated.findIndex(m => m.id === reaction.message_id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], reactions: (updated[idx].reactions || []).filter(r => r.user_id !== reaction.user_id) };
            }
          } else {
            // Postgres DELETE
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
      .channel(`chat-v4-${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        handleDirectMessageChange
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages' },
        handleDirectMessageChange
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'direct_messages' },
        handleDirectMessageChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'direct_message_reactions' },
        handleReactionChange
      )
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMsg = payload.payload;
        handleDirectMessageChange({ eventType: 'INSERT', new: newMsg });
      })
      .on('broadcast', { event: 'reaction_update' }, (payload) => {
        handleReactionChange(payload.payload);
      })
      .on('broadcast', { event: 'message_seen' }, (payload) => {
        const { messageId } = payload.payload;
        setMessages(prev => {
          const targetIdx = prev.findIndex(m => m.id === messageId);
          if (targetIdx === -1) return prev;
          
          const targetDate = new Date(prev[targetIdx].created_at).getTime();
          let updated = false;
          
          const newMsgs = prev.map(m => {
            if (m.sender_id === user?.id && !m.is_read && new Date(m.created_at).getTime() <= targetDate) {
              updated = true;
              return { ...m, is_read: true, read_at: new Date().toISOString() };
            }
            return m;
          });
          
          return updated ? newMsgs : prev;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time chat for room:', roomId);
          channelRef.current = channel;
        } else if (status === 'CLOSED') {
          console.log('Real-time chat channel closed for room:', roomId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error in real-time chat channel for room:', roomId);
          // Try to re-fetch manually as fallback
          fetchMessagesRef.current(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user?.id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { FILE_SIZE_LIMITS } = await import('@/utils/fileValidation');
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'other';
    const limit = type === 'video' ? FILE_SIZE_LIMITS.video : type === 'image' ? FILE_SIZE_LIMITS.image : FILE_SIZE_LIMITS.file;

    if (file.size > limit) {
      toast({ title: "File too large", description: `Maximum file size is ${Math.round(limit / (1024 * 1024))}MB`, variant: "destructive" });
      return;
    }

    const preview = URL.createObjectURL(file);
    setSelectedFile({ file, preview, type });
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      const { uploadFileToSupabase } = await import('@/utils/fileValidation');
      const { url, error: uploadError } = await uploadFileToSupabase(
        file,
        'post-media',
        user?.id || 'unknown'
      );

      if (uploadError || !url) throw new Error(uploadError || 'Failed to upload media');

      return url;
    } catch (error) {
      console.error('Error uploading media:', error);
      toast({ title: "Upload failed", description: "Failed to upload media", variant: "destructive" });
      return null;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((newMessage.trim() === '' && !selectedFile) || !user || !roomId) return;

    stopTyping();
    setUploading(true);
    let attachmentUrl = null;
    let attachmentType = null;

    if (selectedFile) {
      attachmentUrl = await uploadMedia(selectedFile.file);
      attachmentType = selectedFile.type;
    }

    const contentToSend = newMessage.trim() || (attachmentType === 'image' ? 'Shared an image' : attachmentType === 'video' ? 'Shared a video' : attachmentType ? 'Shared a file' : '');

    let finalContent = contentToSend;
    if (keysLoaded && userPublicKey && partnerPublicKey) {
      try {
        finalContent = await encryptDirectMessage(contentToSend, userPublicKey, partnerPublicKey);
      } catch (err) {
        console.error('Error encrypting message payload:', err);
      }
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: contentToSend,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      reply_to_id: replyingTo?.id || null,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      sender_profile: {
        full_name: profile?.full_name || user?.user_metadata?.full_name || 'You',
        avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || '',
        is_verified: profile?.is_verified || false
      },
      is_read: false
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(), 50);

    // Clear input fields immediately for instant feel
    setNewMessage('');
    setSelectedFile(null);
    setUploading(false);
    setShowEmojiPicker(false);
    setReplyingTo(null);
    if (!showEmojiPicker) {
      inputRef.current?.focus();
    }

    const { data: insertedMsg, error: sendError } = await supabase.from('direct_messages').insert({
      content: finalContent,
      sender_id: user.id,
      channel_id: roomId,
      receiver_id: partnerId,
      reply_to_id: replyingTo?.id || null,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType
    }).select().single();
    
    if (sendError || !insertedMsg) {
      console.error('Error sending message:', sendError);
      // Remove optimistic message if insert failed
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({ title: "Failed to send", description: "Message could not be saved to server", variant: "destructive" });
      return;
    }

    // Update the local message ID from tempId to the real ID
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, created_at: insertedMsg.created_at } : m));

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: insertedMsg.id,
          channel_id: roomId,
          content: finalContent,
          sender_id: user.id,
          receiver_id: partnerId,
          created_at: insertedMsg.created_at,
          reply_to_id: replyingTo?.id || null,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType
        }
      }).catch(console.error);
    }

    console.log('[EnhancedRealTimeChat] Dispatching local chat_list_update event for send');
    window.dispatchEvent(new CustomEvent('chat_list_update', {
      detail: { senderId: user.id, receiverId: partnerId }
    }));

    if (globalUpdatesChannelRef.current) {
      console.log('[EnhancedRealTimeChat] Broadcasting chat_list_update (send) to global updates channel');
      globalUpdatesChannelRef.current.send({
        type: 'broadcast',
        event: 'chat_list_update',
        payload: { senderId: user.id, receiverId: partnerId }
      }).catch(console.error);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);
    
    if (error) {
      console.error('Error undoing message:', error);
      toast({ title: "Error", description: "Failed to undo message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      console.log('[EnhancedRealTimeChat] Dispatching local chat_list_update event for undo');
      window.dispatchEvent(new CustomEvent('chat_list_update', {
        detail: { senderId: user.id, receiverId: partnerId }
      }));
      if (globalUpdatesChannelRef.current) {
        console.log('[EnhancedRealTimeChat] Broadcasting chat_list_update (undo) to global updates channel');
        globalUpdatesChannelRef.current.send({
          type: 'broadcast',
          event: 'chat_list_update',
          payload: { senderId: user.id, receiverId: partnerId }
        }).catch(console.error);
      }
    }
  };

  const handleHideMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc('hide_message_for_user', {
      p_table: 'direct_messages',
      p_message_id: messageId,
      p_user_id: user.id
    });
    
    if (error) {
      console.error('Error hiding message:', error);
      toast({ title: "Error", description: "Failed to hide message", variant: "destructive" });
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const onEmojiClick = (emojiObject: EmojiClickData) => {
    setNewMessage(prevMessage => prevMessage + emojiObject.emoji);
  };

  const openEmojiPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Aggressively blur any active element to force keyboard dismissal
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    inputRef.current?.blur();

    setTimeout(() => {
      setShowEmojiPicker(true);
    }, 150);
  };

  const openKeyboard = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Focus input first to start bringing up system keyboard
    inputRef.current?.focus();
    // Wait for keyboard to start appearing before closing emoji panel
    setTimeout(() => {
      setShowEmojiPicker(false);
    }, 200);
  };

  const handleDeleteChat = async () => {
    if (!user || !roomId) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this specific conversation? This cannot be undone.");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`);
    
    if (error) {
      console.error('Error deleting chat history:', error);
      alert('Failed to delete history. Please try again.');
    } else {
      setMessages([]);
      
      // Dispatch local event for instant UI update
      console.log('[EnhancedRealTimeChat] Dispatching local chat_list_update event for delete');
      window.dispatchEvent(new CustomEvent('chat_list_update', {
        detail: { senderId: user.id, receiverId: partnerId }
      }));

      // Broadcast globally to other sessions
      if (globalUpdatesChannelRef.current) {
        console.log('[EnhancedRealTimeChat] Broadcasting chat_list_update (delete) to global updates channel');
        globalUpdatesChannelRef.current.send({
          type: 'broadcast',
          event: 'chat_list_update',
          payload: { senderId: user.id, receiverId: partnerId }
        }).catch(console.error);
      }

      onBackClick();
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
  const lastReadIndexSentByMe = visibleMessages.reduce((lastIdx, msg, idx) => 
    (msg.sender_id === user?.id && (msg.is_read || msg.read_at)) ? idx : lastIdx, -1);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    // Prevent concurrent reaction clicks for the same message to avoid duplicates
    if (reactionLocksRef.current.has(messageId)) return;
    reactionLocksRef.current.add(messageId);
    
    try {
      // Get freshest state
      let currentReactions: MessageReaction[] = [];
      setMessages(prev => {
        const msg = prev.find(m => m.id === messageId);
        if (msg) currentReactions = msg.reactions || [];
        return prev;
      });
      
      const existingReaction = currentReactions.find(r => r.emoji === emoji && r.user_id === user.id);
      const isTogglingOff = !!existingReaction;

      // Optimistic UI Update
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

      // Broadcast optimistic update
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

      // Database Operations
      // Always clear existing reactions for this user & message to avoid conflicts
      await supabase.from('direct_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      if (!isTogglingOff) {
        // Insert new reaction
        const { data, error } = await supabase.from('direct_message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        }).select().single();
        
        if (error) {
          console.error('Error adding reaction', error);
          // Rollback UI
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], reactions: currentReactions };
            return updated;
          });
        } else if (data) {
          // Update temp ID with real ID
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


  return (
    <div className="flex flex-col h-full bg-background text-foreground relative">
      <header className="flex items-center justify-between px-4 py-4 border-b border-border bg-background/95 backdrop-blur-md z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onBackClick} className="p-2 rounded-full hover:bg-muted lg:hidden">
            <ArrowLeft className="h-6 w-6" />
          </button>
          {partnerName && (
            <div 
              className="flex items-center gap-3 cursor-pointer group/partner"
              onClick={() => push(`/profile/${partnerId}`)}
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
                title="Start Call"
              >
                <Video className="h-5 w-5" />
              </Button>
            </div>
          )}
          
          <div className="h-4 w-[1px] bg-border mx-1" />

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDeleteChat}
            className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete Chat"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

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
                
                <DropdownMenuItem onClick={() => push(`/profile/${partnerId}`)} className="cursor-pointer gap-2 py-2 px-3 focus:bg-primary/10 transition-colors">
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
                const isAttachmentOnly = message.attachment_url && (
                  !message.content || 
                  message.content === 'Shared an image' || 
                  message.content === 'Shared a video' || 
                  message.content === 'Shared a file'
                );

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
                  data-message-id={message.id}
                  data-unread={!message.is_read && !message.read_at}
                  data-sender-id={message.sender_id}
                  className={`flex items-start gap-2 my-2 ${isSender ? 'flex-row-reverse pl-12' : 'pr-12'}`}
                >
                  <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                    <AvatarImage src={message.sender_profile?.avatar_url} />
                    <AvatarFallback>{message.sender_profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
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
                          (message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::') || message.content.startsWith('VENDOR_SHARE::') || message.content.includes('JOB_SHARE::') || message.content.startsWith('PROJECT_SHARE::') || message.content.startsWith('DISCUSSION_SHARE::') || message.content.startsWith('ROOM_SHARE::') || message.content.startsWith('COMPANY_SHARE::') || message.content.startsWith('PROFILE_SHARE::') || message.content.startsWith('PITCH_SHARE::') || message.content.startsWith('CONTENT_SHARE::')) ? "p-0 bg-transparent overflow-hidden rounded-2xl border border-border/10" :
                          isAttachmentOnly ? "p-0 bg-transparent rounded-xl overflow-hidden shadow-xl" :
                          isSender ? "bg-primary text-primary-foreground font-medium rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md" : 
                          "bg-muted text-foreground font-medium rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md"
                        )}>

                        {message.replied_to_message && !message.is_deleted && (
                          <div 
                            onClick={() => scrollToMessage(message.replied_to_message!.id)}
                            className={`mb-2 p-2 rounded-xl text-[11px] border-l-4 cursor-pointer hover:opacity-85 active:scale-[0.98] transition-all ${isSender ? 'bg-black/15 border-l-white text-white/90' : 'bg-black/5 dark:bg-white/5 border-l-primary text-foreground/90'}`}
                          >
                            <div className={`font-semibold text-[10px] mb-0.5 ${isSender ? 'text-white font-bold' : getUserColor(message.replied_to_message.sender_profile?.full_name || 'User')}`}>
                              {message.replied_to_message.sender_profile?.full_name || 'User'}
                            </div>
                            <div className={`opacity-80 line-clamp-1 ${isSender ? 'text-white/80' : 'text-muted-foreground'}`}>
                              {message.replied_to_message.is_deleted ? <em>This message was deleted</em> : (
                                getMessagePreviewText(message.replied_to_message.content)
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
                            {message.attachment_url && (
                              <div className={cn(
                                "mb-1 rounded-lg overflow-hidden",
                                (message.attachment_type === 'image' || message.attachment_type === 'video') ? "" : "bg-black/5 dark:bg-white/5 border border-white/10"
                              )}>
                                {message.attachment_type === 'image' ? (
                                  <CachedImage 
                                    src={message.attachment_url} 
                                    alt="Attachment" 
                                    className="max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                                    onClick={() => message.attachment_url && setSelectedImage(message.attachment_url)}
                                  />
                                ) : message.attachment_type === 'video' ? (
                                  <div className="relative group cursor-pointer" onClick={() => message.attachment_url && setSelectedImage(message.attachment_url)}>
                                    <CachedVideo 
                                      src={message.attachment_url} 
                                      className="max-w-full h-auto max-h-[300px]"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                                      <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center text-black">
                                        <Play className="h-6 w-6 fill-current" />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    href={message.attachment_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 text-primary hover:bg-primary/5 transition-colors"
                                  >
                                    <FileText className="h-8 w-8" />
                                    <span className="text-xs font-bold uppercase tracking-wider">View Document</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {message.content && 
                             message.content !== 'Shared an image' && 
                             message.content !== 'Shared a video' && 
                             message.content !== 'Shared a file' && (
                              message.content.startsWith('POST_SHARE::') ? (
                                (() => {
                                  try {
                                    const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                                    return <PostShareCard {...shareData} />;
                                  } catch (e) {
                                    return <p className="text-sm break-words">{message.content}</p>;
                                  }
                                })()
                              ) : message.content.startsWith('PROFILE_SHARE::') ? (
                                (() => {
                                  try {
                                    const shareData = JSON.parse(message.content.replace('PROFILE_SHARE::', ''));
                                    return <ProfileShareCard {...shareData} />;
                                  } catch (e) {
                                    return <p className="text-sm break-words">{message.content}</p>;
                                  }
                                })()
                              ) : message.content.startsWith('PITCH_SHARE::') ? (
                                (() => {
                                  try {
                                    const shareData = JSON.parse(message.content.replace('PITCH_SHARE::', ''));
                                    return <PitchShareCard {...shareData} />;
                                  } catch (e) {
                                    return <p className="text-sm break-words">{message.content}</p>;
                                  }
                                })()
                              ) : message.content.startsWith('COMPANY_SHARE::') ? (
                                (() => {
                                  try {
                                    const shareData = JSON.parse(message.content.replace('COMPANY_SHARE::', ''));
                                    return <CompanyShareCard {...shareData} />;
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
                              ) : message.content.startsWith('CONTENT_SHARE::') ? (
                                (() => {
                                  try {
                                    const shareData = JSON.parse(message.content.replace('CONTENT_SHARE::', ''));
                                    return <ContentShareCard {...shareData} />;
                                  } catch (e) {
                                    return <p className="text-sm break-words">{message.content}</p>;
                                  }
                                })()
                              ) : (message.content.startsWith('DISCUSSION_SHARE::') || message.content.startsWith('ROOM_SHARE::')) ? (
                                (() => {
                                  try {
                                    const prefix = message.content.startsWith('DISCUSSION_SHARE::') ? 'DISCUSSION_SHARE::' : 'ROOM_SHARE::';
                                    const shareData = JSON.parse(message.content.replace(prefix, ''));
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
                              )
                             )}
                          </>
                        )}
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
                                  className={cn("flex items-center gap-0.5 px-1 rounded-full text-[11px] hover:bg-muted transition-colors", hasReacted && "bg-primary/10 text-primary")}
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
                        <div className={`absolute top-1/2 -translate-y-1/2 ${isSender ? 'right-full mr-2' : 'left-full ml-2'} opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 flex items-center gap-0.5`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                <Smile className="h-4 w-4" />
                              </button>
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
                              <button className="p-1 px-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36">
                              {isSender && (
                                <DropdownMenuItem onClick={() => {
                                  setInfoMessage(message);
                                  setShowInfoDialog(true);
                                }}>
                                  <Info className="h-4 w-4 mr-2" /> Info
                                </DropdownMenuItem>
                              )}
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
                              {!isSender && (
                                <DropdownMenuItem onClick={() => setReportingMessage({ id: message.id, content: message.content })} className="text-destructive focus:bg-red-500/10">
                                  <Flag className="h-4 w-4 mr-2" /> Report Message
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
                    <span 
                      className="text-[10px] text-primary/60 font-medium tracking-tight cursor-pointer hover:underline animate-in fade-in slide-in-from-top-1 duration-500"
                      onClick={() => {
                        setInfoMessage(message);
                        setShowInfoDialog(true);
                      }}
                    >
                      {partnerId ? 'Seen' : `Seen by ${partnerName}`}
                    </span>
                  </div>
                )}
              </Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
            <div className="flex flex-col relative bg-background z-20 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]">
            {replyingTo && (
              <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex-1 overflow-hidden pr-2">
                  <div className={`font-semibold mb-0.5 ${getUserColor(replyingTo.sender_id)}`}>
                    Replying to {replyingTo.sender_profile?.full_name || 'User'}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {getMessagePreviewText(replyingTo.content)}
                  </div>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {selectedFile && (
              <div className="p-3 bg-muted/20 border-b border-border flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shadow-xl bg-black">
                  {selectedFile.type === 'image' ? (
                    <CachedImage src={selectedFile.preview} fallbackSrc={selectedFile.preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : selectedFile.type === 'video' ? (
                    <CachedVideo src={selectedFile.preview} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-foreground uppercase tracking-widest truncate">
                    {selectedFile.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {(selectedFile.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            )}
            <TypingIndicator typingUsers={typingUsers} />
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-1.5 bg-background">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/*,video/*"
              />
              
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full text-muted-foreground"
                title="Attach media"
                disabled={uploading}
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              {/* WhatsApp-style toggle: keyboard icon when emoji open, emoji icon otherwise */}
              {showEmojiPicker ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={openKeyboard}
                  className="rounded-full text-primary bg-primary/10"
                  title="Open keyboard"
                  disabled={uploading}
                >
                  <Keyboard className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEmojiPanel(e);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="rounded-full text-muted-foreground emoji-toggle-button"
                  title="Open emoji picker"
                  disabled={uploading}
                >
                  <Smile className="h-5 w-5" />
                </Button>
              )}
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  startTyping();
                }}
                onBlur={() => stopTyping()}
                onFocus={() => {
                  if (showEmojiPicker) {
                    setTimeout(() => setShowEmojiPicker(false), 200);
                  }
                }}
                placeholder="Send a message..."
                className="flex-1 rounded-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 h-10"
                autoComplete="off"
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full h-10 w-10 shrink-0" 
                disabled={(!newMessage.trim() && !selectedFile) || uploading}
              >
                {uploading ? (
                  <div className="h-5 w-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </div>

          <div
            ref={emojiPickerRef}
            className={cn(
              "w-full bg-background border-t border-border overflow-hidden h-[300px] transition-all duration-300",
              showEmojiPicker ? "block animate-in slide-in-from-bottom" : "hidden"
            )}
          >
            <EmojiPicker 
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              theme={EmojiTheme.DARK}
              emojiStyle={EmojiStyle.APPLE}
              width="100%"
              height={Math.max(300, keyboardHeight || 350)}
              lazyLoadEmojis={true}
              previewConfig={{ showPreview: false }}
              searchDisabled={false}
              skinTonesDisabled={true}
            />
          </div>
        </>
      )}
      {/* Lightbox Dialog */}
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
      {reportingMessage && (
        <MessageReportDialog
          isOpen={!!reportingMessage}
          onOpenChange={(open) => !open && setReportingMessage(null)}
          targetType="dm"
          messageId={reportingMessage.id}
          channelId={roomId}
          decryptedContent={reportingMessage.content}
        />
      )}

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
              const isRead = infoMessage.is_read || !!infoMessage.read_at;
              const readTime = infoMessage.read_at ? new Date(infoMessage.read_at) : null;
              
              return (
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={partnerAvatarUrl} />
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground font-bold">
                        {partnerName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-none mb-1">
                        {partnerName}
                      </p>
                      <p className={cn("text-[10px] leading-none font-medium", isRead ? "text-primary" : "text-muted-foreground")}>
                        {isRead ? "Read" : "Delivered"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {isRead && readTime ? format(readTime, 'p') : format(new Date(infoMessage.created_at), 'p')}
                  </span>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedRealTimeChat;

