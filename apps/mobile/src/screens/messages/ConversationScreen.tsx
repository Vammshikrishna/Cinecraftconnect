import { ReportModal } from '../../components/modals/ReportModal';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  ActivityIndicator,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Animated,
  PanResponder,
  InteractionManager,
  Dimensions,
  Linking,
  FlatList,
  NativeModules,
} from 'react-native';
import { pickAttachments } from '../../services/attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../../config/env';
import { decryptDirectMessage, encryptDirectMessage } from '@cinecraft/e2ee';
import { useE2EEChatKeys } from '../../hooks/useE2EEChatKeys';
import { ChatMessagesSkeleton } from '../../components/common/Skeleton';
import { CachedImage } from '../../components/common/CachedImage';
import { MediaCollageGrid } from '../../components/chat/MediaCollageGrid';
import { getReplyThumbnail, getReplySnippet } from '../../components/chat/chatUtils';
import { useUserSettings } from '../../hooks/useUserSettings';
import { setActiveChatContext, clearActiveChatContext } from '../../services/activeScreenTracker';
import { handleSmartBack } from '../../services/navigationUtils';
import { uploadMediaPipeline } from '../../services/mediaPipeline';

const FlashListAny = FlashList as any;
import { usePresence } from '../../hooks/usePresence';
import { getCache, saveCache, getCacheSync, getCurrentUserIdSync, resolveCurrentUserId } from '../../services/offlineCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DMSettingsModal } from '../../components/chat/DMSettingsModal';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const generateDirectRoomId = (userId1: string, userId2: string): string => {
  const [id1, id2] = [userId1, userId2].sort();
  if (id1?.length === 36 && id2?.length === 36) {
    return id1.slice(0, 18) + id2.slice(18);
  }
  return `${id1}-${id2}`.slice(0, 36);
};

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  onDoubleTap?: () => void;
  onLongPress: () => void;
  isMe: boolean;
  themeColors: any;
  isDark: boolean;
}

const SwipeableMessageRow: React.FC<SwipeableMessageRowProps> = ({
  children,
  onSwipeReply,
  onDoubleTap,
  onLongPress,
  isMe,
  themeColors,
  isDark,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 14 && Math.abs(gestureState.dy) < 16;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const drag = gestureState.dx > 55 ? 55 + (gestureState.dx - 55) * 0.32 : gestureState.dx;
          panX.setValue(Math.min(drag, 80));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 42) {
          onSwipeReply();
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 12,
          speed: 18,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      if (onDoubleTap) onDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  };

  const replyIconOpacity = panX.interpolate({
    inputRange: [0, 20, 42],
    outputRange: [0, 0.7, 1],
    extrapolate: 'clamp',
  });

  const replyIconScale = panX.interpolate({
    inputRange: [0, 20, 48],
    outputRange: [0.5, 0.9, 1.2],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.swipeContainer, isMe ? styles.swipeContainerMe : styles.swipeContainerOther]}>
      <Animated.View
        style={[
          styles.swipeReplyIconWrap,
          {
            opacity: replyIconOpacity,
            transform: [{ scale: replyIconScale }],
            backgroundColor: isDark ? 'rgba(255, 75, 51, 0.18)' : '#FFEBE8',
            borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFD6D0',
          },
        ]}
      >
        <Icon name="corner-up-left" size={15} color={ORANGE} strokeWidth={2.5} />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          { transform: [{ translateX: panX }] },
          styles.swipeInnerWrap,
          isMe ? styles.swipeInnerWrapMe : styles.swipeInnerWrapOther,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={280}
          style={[styles.touchableBubbleWrap, isMe ? styles.touchableBubbleWrapMe : styles.touchableBubbleWrapOther]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export const ConversationScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const conversationId = route.params?.conversationId || route.params?.channelId || route.params?.channel_id;
  const initialPartnerId = route.params?.partnerId || route.params?.partner_id || route.params?.senderId || route.params?.sender_id || route.params?.trigger_user_id || (conversationId && typeof conversationId === 'string' && conversationId.includes('-') ? conversationId : undefined);
  const initialPartnerName = route.params?.partnerName || route.params?.senderName || route.params?.sender_name || route.params?.title;
  const initialPartnerAvatar = route.params?.partnerAvatar || route.params?.avatarUrl || route.params?.avatar_url;
  const initialPartnerCraft = route.params?.partnerCraft || 'FILMMAKER';

  const authUserId = getCurrentUserIdSync();
  const initialRoomId = conversationId || (authUserId && initialPartnerId ? generateDirectRoomId(authUserId, initialPartnerId) : null);
  const initialCached = initialRoomId ? getCacheSync<any[]>(`conv_messages_${initialRoomId}`) : null;

  const [messages, setMessages] = useState<any[]>(() => initialCached || []);
  const rawMessagesRef = useRef<any[]>(initialCached || []);
  const [inputText, setInputText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [infoMessage, setInfoMessage] = useState<any | null>(null);
  const [reportingMessage, setReportingMessage] = useState<any | null>(null);
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(authUserId || null);
  const [resolvedConvId, setResolvedConvId] = useState<string | null>(initialRoomId || null);
  const [resolvedPartnerId, setResolvedPartnerId] = useState<string | null>(initialPartnerId || null);
  const [partnerDetails, setPartnerDetails] = useState<{
    name: string;
    avatar: string | null;
    craft: string;
  }>({
    name: initialPartnerName || 'Crew Member',
    avatar: initialPartnerAvatar || null,
    craft: initialPartnerCraft || 'FILMMAKER',
  });
  const [loading, setLoading] = useState<boolean>(() => !initialCached || initialCached.length === 0);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const flatListRef = useRef<any>(null);

  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [lightboxState, setLightboxState] = useState<{ visible: boolean; images: string[]; currentIndex: number }>({ visible: false, images: [], currentIndex: 0 });

  const allImageUrls = useMemo(() => {
    const urls: string[] = [];
    messages.forEach((m: any) => {
      if (m.attachment_url) {
        if (m.attachment_type === 'image') {
          urls.push(m.attachment_url);
        } else if (m.attachment_type === 'multi_media' || m.attachment_type === 'media') {
          try {
            const parsed = typeof m.attachment_url === 'string' ? JSON.parse(m.attachment_url) : m.attachment_url;
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const url = typeof item === 'string' ? item : item.url;
                const type = typeof item === 'string' ? '' : item.type;
                if (url && (type === 'image' || !type || /\.(jpg|jpeg|png|webp|gif)$/i.test(url))) {
                  urls.push(url);
                }
              });
            }
          } catch {
            if (/\.(jpg|jpeg|png|webp|gif)$/i.test(m.attachment_url)) {
              urls.push(m.attachment_url);
            }
          }
        }
      }
    });
    return urls;
  }, [messages]);

  const openImageLightbox = useCallback((targetUrl: string) => {
    let index = allImageUrls.indexOf(targetUrl);
    if (index === -1) {
      setLightboxState({ visible: true, images: [targetUrl], currentIndex: 0 });
    } else {
      setLightboxState({ visible: true, images: allImageUrls, currentIndex: index });
    }
  }, [allImageUrls]);

  const handlePickDocument = async () => {
    try {
      const results = await pickAttachments();
      if (results.length > 0) {
        setAttachedFiles((prev) => [...prev, ...results]);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick files');
      }
    }
  };

  // E2EE Keys
  const { privateKey, userPublicKey, partnerPublicKey } = useE2EEChatKeys(resolvedPartnerId);
  const privateKeyRef = useRef<string | null>(privateKey);
  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  const { settings, triggerHaptic, themeColors, isDark } = useUserSettings();
  const { isUserOnline } = usePresence();
  const isPartnerOnline = isUserOnline(resolvedPartnerId);

  useFocusEffect(
    useCallback(() => {
      setActiveChatContext({
        screen: 'Conversation',
        partnerId: resolvedPartnerId || initialPartnerId,
        conversationId: resolvedConvId || conversationId,
      });
      return () => {
        clearActiveChatContext();
      };
    }, [resolvedPartnerId, initialPartnerId, resolvedConvId, conversationId])
  );

  // Per-DM Notification Mute State & Settings Modal
  const [isMuted, setIsMuted] = useState(false);
  const [showDMSettings, setShowDMSettings] = useState(false);

  // Load Starred Messages
  useEffect(() => {
    if (!currentUserId) return;
    AsyncStorage.getItem(`@starred_dms_${currentUserId}`).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setStarredMsgIds(new Set(parsed));
          }
        } catch { }
      }
    });
  }, [currentUserId]);

  useEffect(() => {
    const loadMuteState = async () => {
      try {
        const uId = currentUserId || 'anonymous';
        const candidateKeys = [
          resolvedConvId ? `@dm_notif_${resolvedConvId}_${uId}` : null,
          resolvedConvId ? `@dm_notif_${resolvedConvId}` : null,
          resolvedPartnerId ? `@dm_notif_${resolvedPartnerId}_${uId}` : null,
          resolvedPartnerId ? `@dm_notif_${resolvedPartnerId}` : null,
          conversationId ? `@dm_notif_${conversationId}_${uId}` : null,
          conversationId ? `@dm_notif_${conversationId}` : null,
        ].filter(Boolean) as string[];

        for (const k of candidateKeys) {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.muteConversation !== undefined) {
              setIsMuted(Boolean(parsed.muteConversation));
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[Conversation] Error loading mute state:', err);
      }
    };
    loadMuteState();
  }, [resolvedConvId, resolvedPartnerId, conversationId, currentUserId]);

  const toggleMuteConversation = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    triggerHaptic();
    try {
      const uId = currentUserId || 'anonymous';
      const payload = JSON.stringify({ muteConversation: newMuted });
      const candidateKeys = [
        resolvedConvId ? `@dm_notif_${resolvedConvId}_${uId}` : null,
        resolvedConvId ? `@dm_notif_${resolvedConvId}` : null,
        resolvedPartnerId ? `@dm_notif_${resolvedPartnerId}_${uId}` : null,
        resolvedPartnerId ? `@dm_notif_${resolvedPartnerId}` : null,
        conversationId ? `@dm_notif_${conversationId}_${uId}` : null,
        conversationId ? `@dm_notif_${conversationId}` : null,
      ].filter(Boolean) as string[];

      for (const k of candidateKeys) {
        await AsyncStorage.setItem(k, payload);
      }
      Alert.alert(
        newMuted ? 'Conversation Muted' : 'Conversation Unmuted',
        newMuted
          ? 'Notifications for this conversation have been silenced.'
          : 'You will now receive notifications for this conversation.'
      );
    } catch (err) {
      console.warn('[Conversation] Error saving mute state:', err);
    }
  };

  const markMessagesRead = useCallback(async (channelId: string, userId: string) => {
    // Respect user privacy setting: do not mark messages as read if read receipts are disabled
    if (settings.read_receipts === false) return;

    try {
      const supabase = getSupabaseClient();
      await (supabase.from('direct_messages') as any)
        .update({ is_read: true })
        .eq('channel_id', channelId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
    } catch (e) {
      console.warn('[Conversation] Error marking as read:', e);
    }
  }, [settings.read_receipts]);

  const handleClearChat = useCallback(async () => {
    if (!resolvedConvId) return;
    setMessages([]);
    rawMessagesRef.current = [];
    saveCache(`conv_messages_${resolvedConvId}`, []).catch(() => { });
    Alert.alert('Chat Cleared', 'Conversation history cleared on this device.');
  }, [resolvedConvId]);

  const decryptMessageContent = useCallback(async (content: string, isSender: boolean): Promise<string> => {
    if (!content) return '';
    if (content.includes('__e2ee') || content.startsWith('{')) {
      if (privateKeyRef.current) {
        try {
          const decrypted = await decryptDirectMessage(content, privateKeyRef.current, isSender);
          return decrypted;
        } catch {
          return '🔒 Unable to decrypt message';
        }
      }
      return '🔒 Encrypted Message';
    }
    return content;
  }, []);

  const fetchReactions = useCallback(async (msgList: any[]) => {
    const ids = msgList.map((m) => m.id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('direct_message_reactions' as any)
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', ids);

      if (!error && data) {
        const reactionsMap: Record<string, any[]> = {};
        (data as any[]).forEach((r: any) => {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          reactionsMap[r.message_id].push(r);
        });

        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            reactions: reactionsMap[msg.id] || msg.reactions || [],
          }))
        );
      }
    } catch (err) {
      console.warn('[Conversation] Error fetching reactions:', err);
    }
  }, []);

  const processAndSetMessages = useCallback(async (rawList: any[], cId?: string) => {
    rawMessagesRef.current = rawList;
    const processed = await Promise.all(
      rawList.map(async (m) => {
        const isSender = m.sender_id === currentUserId;
        const raw = m.rawContent || m.content;
        const decrypted = await decryptMessageContent(raw, isSender);
        return {
          ...m,
          rawContent: raw,
          displayContent: decrypted,
        };
      })
    );
    setMessages(processed);
    if (cId) {
      saveCache(`conv_messages_${cId}`, processed).catch(() => { });
    }
    fetchReactions(processed);
  }, [currentUserId, decryptMessageContent, fetchReactions]);

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchMessages = useCallback(async (cId: string, force = false) => {
    if (!cId) return;
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 3000) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      const supabase = getSupabaseClient();
      const PAGE_SIZE = 25;

      // 1. Try RPC get_messages_for_channel_paginated
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'get_messages_for_channel_paginated',
        { p_channel_id: cId, p_limit: PAGE_SIZE, p_offset: 0 }
      );

      if (!rpcError && Array.isArray(rpcData)) {
        const sorted = [...rpcData].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setHasMoreOlder(rpcData.length === PAGE_SIZE);
        await processAndSetMessages(sorted, cId);
        setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: false }); }, 100);
        return;
      }

      // 2. Direct query fallback
      const { data, error } = await supabase
        .from('direct_messages' as any)
        .select(`id, content, created_at, sender_id, receiver_id, reply_to_id, is_read, attachment_url, attachment_type`)
        .eq('channel_id', cId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (!error && data) {
        const chronological = [...data].reverse();
        setHasMoreOlder(data.length === PAGE_SIZE);
        await processAndSetMessages(chronological, cId);
        setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: false }); }, 100);
      }
    } catch (e) {
      console.warn('[Conversation] Error fetching messages:', e);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [processAndSetMessages]);

  const fetchOlderDMs = useCallback(async (cId: string) => {
    if (!cId || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const PAGE_SIZE = 15;
    try {
      const supabase = getSupabaseClient();
      const oldestTimestamp = rawMessagesRef.current[0]?.created_at || messages[0]?.created_at;
      const { data: rawData, error } = await supabase
        .from('direct_messages' as any)
        .select(`id, content, created_at, sender_id, receiver_id, reply_to_id, is_read, attachment_url, attachment_type`)
        .eq('channel_id', cId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      const data = rawData as any[] | null;

      if (!error && data && data.length > 0) {
        const older = [...data].reverse();
        setHasMoreOlder(data.length === PAGE_SIZE);
        const processed = await Promise.all(
          older.map(async (m: any) => {
            const isSender = m.sender_id === currentUserId;
            const decrypted = await decryptMessageContent(m.content, isSender);
            return { ...m, displayContent: decrypted };
          })
        );
        rawMessagesRef.current = [...older, ...rawMessagesRef.current];
        setMessages((prev) => {
          const next = [...processed, ...prev];
          saveCache(`conv_messages_${cId}`, next).catch(() => { });
          return next;
        });
        fetchReactions(processed);
      } else {
        setHasMoreOlder(false);
      }
    } catch (e) {
      console.warn('[Conversation] Error fetching older messages:', e);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMoreOlder, messages, currentUserId, decryptMessageContent, fetchReactions]);

  // Instant parameter-based cache hydration on mount
  useEffect(() => {
    if (conversationId) {
      getCache<any[]>(`conv_messages_${conversationId}`).then((cached) => {
        if (cached && cached.length > 0) {
          setMessages(cached);
          setLoading(false);
          setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: false }); }, 50);
        }
      });
    }
  }, [conversationId]);

  useEffect(() => {
    const resolveConversation = async () => {
      try {
        const supabase = getSupabaseClient();

        // 1. Resolve user ID offline-first without blocking network call
        let userId = currentUserId || getCurrentUserIdSync();
        if (!userId) {
          const { data: sessionData } = await supabase.auth.getSession();
          userId = sessionData?.session?.user?.id || null;
        }
        if (!userId) {
          userId = await resolveCurrentUserId();
        }
        if (!userId) {
          const cachedSession = await getCache<any>('user_session');
          userId = cachedSession?.user?.id || null;
        }
        if (!userId) return;
        setCurrentUserId(userId);

        let targetPartnerId = initialPartnerId;

        // If no partnerId, check if conversationId is a user UUID
        if (!targetPartnerId && conversationId && typeof conversationId === 'string') {
          if (conversationId.length === 36 && conversationId.includes('-')) {
            targetPartnerId = conversationId;
          }
        }

        const channelId = conversationId && conversationId.length < 36 && !conversationId.includes('-')
          ? conversationId
          : (targetPartnerId ? generateDirectRoomId(userId, targetPartnerId) : conversationId);

        if (channelId) {
          setResolvedConvId(channelId);

          // Instant Cache Load: display cached messages immediately
          const cached = await getCache<any[]>(`conv_messages_${channelId}`);
          if (cached && cached.length > 0) {
            setMessages(cached);
            setLoading(false);
            setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: false }); }, 50);
          }

          // Start loading messages now. Looking up the partner (below) used to run first and delay the
          // whole conversation by a network round trip even though the messages only need the channel id.
          fetchMessages(channelId);

          if (!targetPartnerId) {
            try {
              const { data: latestDm } = await supabase
                .from('direct_messages' as any)
                .select('sender_id, receiver_id')
                .eq('channel_id', channelId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (latestDm) {
                const ld: any = latestDm;
                targetPartnerId = ld.sender_id === userId ? ld.receiver_id : ld.sender_id;
              }
            } catch {}
          }

          if (targetPartnerId) {
            setResolvedPartnerId(targetPartnerId);

            // Fetch partner profile in background if details missing
            if (!initialPartnerName || initialPartnerName === 'Crew Member') {
              (async () => {
                try {
                  const { data: prof } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, craft')
                    .eq('id', targetPartnerId)
                    .single();
                  if (prof) {
                    setPartnerDetails({
                      name: prof.full_name || 'Crew Member',
                      avatar: prof.avatar_url || null,
                      craft: prof.craft || 'FILMMAKER',
                    });
                  }
                } catch { }
              })();
            }

            markMessagesRead(channelId, userId);
          }
        }
      } catch (e) {
        console.warn('[Conversation] Resolve error:', e);
      } finally {
        setLoading(false);
      }
    };

    resolveConversation();
  }, [conversationId, initialPartnerId, initialPartnerName, fetchMessages, markMessagesRead]);

  // Refresh conversation messages whenever returning from a call or refocusing
  useFocusEffect(
    useCallback(() => {
      if (!resolvedConvId) return;
      const task = InteractionManager.runAfterInteractions(() => {
        fetchMessages(resolvedConvId);
        if (currentUserId) {
          markMessagesRead(resolvedConvId, currentUserId);
        }
        if (NativeModules.NotificationBridge?.dismissNotification) {
          if (resolvedPartnerId) NativeModules.NotificationBridge.dismissNotification(`Conversation_${resolvedPartnerId}`);
          if (resolvedConvId) NativeModules.NotificationBridge.dismissNotification(`Conversation_${resolvedConvId}`);
        }
      });
      return () => task.cancel();
    }, [resolvedConvId, resolvedPartnerId, currentUserId, fetchMessages, markMessagesRead])
  );

  // Re-decrypt messages when privateKey is loaded
  useEffect(() => {
    if (privateKey) {
      const msgsToDecrypt = rawMessagesRef.current.length > 0 ? rawMessagesRef.current : messages;
      if (msgsToDecrypt.length > 0) {
        processAndSetMessages(msgsToDecrypt, resolvedConvId || undefined);
      }
    }
  }, [privateKey, resolvedConvId, processAndSetMessages]);

  // Realtime messages subscription
  useEffect(() => {
    if (!resolvedConvId) return;

    const supabase = getSupabaseClient();
    const subscription = supabase
      .channel(`chat-room-${resolvedConvId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `channel_id=eq.${resolvedConvId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            const isSender = newMsg.sender_id === currentUserId;
            const decrypted = await decryptMessageContent(newMsg.content, isSender);
            const enriched = { ...newMsg, displayContent: decrypted, reactions: [] };

            rawMessagesRef.current = [...rawMessagesRef.current.filter((m) => m.id !== newMsg.id), newMsg];
            setMessages((current) => {
              if (current.find((m) => m.id === newMsg.id)) return current;
              const next = [...current, enriched];
              if (resolvedConvId) {
                saveCache(`conv_messages_${resolvedConvId}`, next).catch(() => { });
              }
              return next;
            });

            if (currentUserId && newMsg.receiver_id === currentUserId) {
              markMessagesRead(resolvedConvId, currentUserId);
            }
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            const isSender = updated.sender_id === currentUserId;
            const decrypted = await decryptMessageContent(updated.content, isSender);

            setMessages((current) =>
              current.map((msg) => (msg.id === updated.id ? { ...msg, ...updated, displayContent: decrypted } : msg))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((current) => current.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Reactions realtime subscription
    const reactionsSub = supabase
      .channel(`chat-reactions-${resolvedConvId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_message_reactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as any;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === newReaction.message_id) {
                  const current = m.reactions || [];
                  if (current.some((r: any) => r.id === newReaction.id || (r.user_id === newReaction.user_id && r.emoji === newReaction.emoji))) {
                    return m;
                  }
                  return { ...m, reactions: [...current, newReaction] };
                }
                return m;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as any;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === oldReaction.message_id || (m.reactions && m.reactions.some((r: any) => r.id === oldReaction.id))) {
                  return {
                    ...m,
                    reactions: (m.reactions || []).filter((r: any) => r.id !== oldReaction.id),
                  };
                }
                return m;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      try {
        subscription.unsubscribe();
        supabase.removeChannel(subscription);
      } catch { }
      try {
        reactionsSub.unsubscribe();
        supabase.removeChannel(reactionsSub);
      } catch { }
    };
  }, [resolvedConvId, currentUserId, markMessagesRead, decryptMessageContent]);

  const handleSend = async () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || !resolvedConvId || !currentUserId || !resolvedPartnerId) return;
    setSending(true);
    const text = inputText.trim();
    const filesToSend = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);

    try {
      const supabase = getSupabaseClient();
      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;

      if (filesToSend.length > 0) {
        setUploadingMedia(true);
        const uploadedItems: Array<{ url: string; type: string; name: string; size?: number }> = [];

        for (const file of filesToSend) {
          try {
            const uploaded = await uploadMediaPipeline(
              {
                uri: file.uri,
                name: file.name,
                type: file.type,
                size: file.size,
              },
              {
                bucket: 'post-media',
                folder: `chat_media/${resolvedConvId || 'dm'}`,
              }
            );

            uploadedItems.push({
              url: uploaded.url,
              type: uploaded.type,
              name: file.name || 'Attachment',
              size: uploaded.size,
            });
          } catch (uploadErr: any) {
            console.warn('[ConversationScreen] File upload error:', uploadErr);
          }
        }

        if (uploadedItems.length === 1) {
          attachmentUrl = uploadedItems[0].url;
          attachmentType = uploadedItems[0].type;
        } else if (uploadedItems.length > 1) {
          const allImages = uploadedItems.every(u => u.type === 'image');
          attachmentUrl = JSON.stringify(uploadedItems.map(u => u.url));
          attachmentType = allImages ? 'image' : 'multi_media';
        }
        setUploadingMedia(false);
      }

      // Encrypt message if public keys available
      let contentToSend = text;
      if (text && !userPublicKey) {
        throw new Error('Your secure messaging keys are not ready yet. Please wait a moment or set up your encryption PIN, then try again.');
      }
      if (text && !partnerPublicKey) {
        throw new Error('This person has not set up secure messaging yet, so your message was not sent. Ask them to open CineCraft and finish setup.');
      }
      if (text && userPublicKey && partnerPublicKey) {
        try {
          contentToSend = await encryptDirectMessage(text, userPublicKey, partnerPublicKey);
        } catch (encErr) {
          // Never downgrade an encrypted conversation to plaintext on failure.
          console.warn('[Conversation] Encryption failed, message not sent:', encErr);
          throw new Error('Could not encrypt this message. It was not sent. Please try again.');
        }
      }

      const defaultFallbackContent = attachmentType === 'image' ? '📷 Image' : attachmentType === 'video' ? '🎥 Video' : attachmentType === 'multi_media' ? '🖼️ Media' : '📎 File';

      const { data: inserted, error } = await (supabase.from('direct_messages') as any)
        .insert({
          channel_id: resolvedConvId,
          sender_id: currentUserId,
          receiver_id: resolvedPartnerId,
          content: contentToSend || defaultFallbackContent,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          reply_to_id: replyingTo ? replyingTo.id : null,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;
      setReplyingTo(null);

      if (inserted) {
        triggerHaptic(35);
        const msg = {
          ...(inserted as any),
          displayContent: text || defaultFallbackContent,
          reactions: [],
        };
        rawMessagesRef.current = [...rawMessagesRef.current, inserted];
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          if (resolvedConvId) {
            saveCache(`conv_messages_${resolvedConvId}`, next).catch(() => { });
          }
          return next;
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send message.');
      setInputText(text);
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId || !messageId) return;
    triggerHaptic(30);

    // Decide add / remove from the messages on screen NOW (not inside the setMessages updater, which React runs later:
    // `isTogglingOff` and the rollback list were still unset when the database write below used them).
    const targetMsg = messages.find((m) => m.id === messageId);
    const currentReactions: any[] = targetMsg?.reactions || [];
    const existingIndex = currentReactions.findIndex((r: any) => r.user_id === currentUserId && r.emoji === emoji);
    const isTogglingOff = existingIndex !== -1;

    // Optimistic UI update
    const updatedReactions = isTogglingOff
      ? currentReactions.filter((_, idx) => idx !== existingIndex)
      : [...currentReactions.filter((r: any) => r.user_id !== currentUserId), { id: `temp-${Date.now()}`, message_id: messageId, user_id: currentUserId, emoji }];
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedReactions } : m)));

    setSelectedMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await (supabase.from('direct_message_reactions') as any)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId);
      if (delErr) throw delErr;

      if (!isTogglingOff) {
        const { error: insErr } = await (supabase.from('direct_message_reactions') as any).insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        });
        if (insErr) throw insErr;
      }
    } catch (err) {
      console.warn('[Conversation] Error updating reaction:', err);
      // Rollback on error
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: currentReactions } : m))
      );
    }
  };

  const handleToggleStar = async (messageId: string) => {
    if (!currentUserId) return;
    triggerHaptic(30);
    const next = new Set(starredMsgIds);
    if (next.has(messageId)) {
      next.delete(messageId);
    } else {
      next.add(messageId);
    }
    setStarredMsgIds(next);
    setSelectedMessage(null);
    try {
      await AsyncStorage.setItem(`@starred_dms_${currentUserId}`, JSON.stringify(Array.from(next)));
    } catch (err) {
      console.warn('[Conversation] Error saving starred messages:', err);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              await (supabase.from('direct_messages') as any)
                .delete()
                .eq('id', messageId);

              setMessages((prev) => prev.filter((m) => m.id !== messageId));
              rawMessagesRef.current = rawMessagesRef.current.filter((m) => m.id !== messageId);
              if (resolvedConvId) {
                saveCache(`conv_messages_${resolvedConvId}`, messages.filter((m) => m.id !== messageId)).catch(() => { });
              }
            } catch (err) {
              console.warn('[Conversation] Error deleting message:', err);
            } finally {
              setSelectedMessage(null);
            }
          },
        },
      ]
    );
  };

  const handleForwardMessage = async (content: string) => {
    setSelectedMessage(null);
    try {
      await Share.share({
        message: content,
      });
    } catch (err) {
      console.warn('[Conversation] Forward error:', err);
    }
  };

  const handleStartCall = (isVideo: boolean) => {
    if (!resolvedConvId && !resolvedPartnerId) {
      Alert.alert('Not Ready', 'Conversation is still loading. Please try again.');
      return;
    }
    navigation.navigate('Call', {
      roomId: resolvedConvId || `dm-${resolvedPartnerId || Date.now()}`,
      partnerName: partnerDetails.name || 'Crew Member',
      partnerId: resolvedPartnerId,
      roomName: partnerDetails.name || 'Direct Call',
      roomType: 'direct',
      isVideo,
    });
  };

  const handleCallButtonPress = () => {
    Alert.alert(
      `Call ${partnerDetails.name || 'Contact'}`,
      'Select call type',
      [
        {
          text: 'Voice Call 📞',
          onPress: () => handleStartCall(false),
        },
        {
          text: 'Video Call 📹',
          onPress: () => handleStartCall(true),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCopyMessage = () => {
    const textToCopy = selectedMessage?.displayContent || selectedMessage?.content;
    if (textToCopy) {
      Clipboard.setString(textToCopy);
      Alert.alert('Copied 📋', 'Message copied to clipboard.');
    }
    setSelectedMessage(null);
  };

  const formatDisplayFallback = (raw: string) => {
    if (!raw) return '';
    if (raw.startsWith('POST_SHARE::')) return 'Shared a post';
    if (raw.startsWith('MARKETPLACE_SHARE::')) return 'Shared a marketplace listing';
    if (raw.startsWith('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
    if (raw.startsWith('VENDOR_SHARE::')) return 'Shared a vendor profile';
    if (raw.startsWith('PROJECT_SHARE::')) return 'Shared a project';
    if (raw.startsWith('DISCUSSION_SHARE::')) return 'Shared a discussion room';
    if (raw.startsWith('JOB_SHARE::')) return 'Shared a job';
    if (raw.startsWith('PROFILE_SHARE::')) return 'Shared a profile';
    if (raw.startsWith('PITCH_SHARE::')) return 'Shared a pitch deck';
    if (raw.startsWith('CONTENT_SHARE::')) return 'Shared a video/content';
    if (raw.startsWith('FORWARDED::')) return raw.replace('FORWARDED::', '');
    return raw;
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDateTime = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Find if there is a recently started call
  const latestCallEvent = [...messages].reverse().find(
    (m) =>
      m.attachment_type === 'call_event' ||
      m.media_type === 'call_event' ||
      (typeof m.content === 'string' &&
        (m.content.includes('Video call started') ||
          m.content.includes('Call ended') ||
          m.content.includes('call started') ||
          m.content.startsWith('📞')))
  );
  const isCallActive =
    latestCallEvent &&
    (latestCallEvent.content?.includes('started') ||
      latestCallEvent.content?.includes('Video call started')) &&
    Date.now() - new Date(latestCallEvent.created_at).getTime() < 1000 * 60 * 30;

  const renderMessageItem = ({ item }: { item: any }) => {
    const isMe = item.sender_id === currentUserId;
    const isStarred = starredMsgIds.has(item.id);
    const isSelected = selectedMessage?.id === item.id;

    // Call System Message Event
    const isCallEvent =
      item.attachment_type === 'call_event' ||
      item.media_type === 'call_event' ||
      (typeof item.content === 'string' &&
        (item.content.includes('Video call started') ||
          item.content.includes('Call ended') ||
          item.content.includes('call started') ||
          item.content.startsWith('📞')));

    if (isCallEvent) {
      const isStarted = item.content?.includes('started') || item.content?.includes('Video call started');
      const cleanContent = (item.content || '').replace(/^📞\s*/, '');
      const timeStr = formatTime(item.created_at);

      return (
        <View style={styles.callEventCenteredRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleStartCall(true)}
            style={[styles.callEventPill, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
          >
            <View
              style={[
                styles.callEventIconCircle,
                isStarted ? styles.callEventIconGreen : styles.callEventIconRed,
              ]}
            >
              <Icon name="phone" size={13} color={isStarted ? '#10B981' : '#EF4444'} />
            </View>
            <View style={styles.callEventTextWrap}>
              <Text style={[styles.callEventTitle, { color: themeColors.textPrimary }]}>{cleanContent}</Text>
              {timeStr ? <Text style={[styles.callEventTime, { color: themeColors.textMuted }]}>{timeStr}</Text> : null}
            </View>
            <View
              style={[
                styles.callEventActionBadge,
                isStarted ? styles.callJoinBadge : styles.callBackBadge,
              ]}
            >
              <Text
                style={[
                  styles.callEventActionText,
                  isStarted ? styles.callJoinText : styles.callBackText,
                ]}
              >
                {isStarted ? 'Join' : 'Call'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    const rawDisplayText = formatDisplayFallback(item.displayContent || item.content);
    const isDefaultMedia = !rawDisplayText ||
      rawDisplayText === 'Shared an image' ||
      rawDisplayText === 'Shared a video' ||
      rawDisplayText === 'Shared an attachment' ||
      (rawDisplayText.startsWith('Shared ') && rawDisplayText.endsWith(' photos'));
    const displayText = isDefaultMedia ? '' : rawDisplayText;
    const isMediaOnly = Boolean(item.attachment_url && !displayText);

    // Group reactions by emoji
    const itemReactions: any[] = item.reactions || [];
    const uniqueEmojiList = Array.from(new Set(itemReactions.map((r) => r.emoji)));
    const reactionCounts = uniqueEmojiList.map((emoji) => {
      const count = itemReactions.filter((r) => r.emoji === emoji).length;
      const hasReacted = itemReactions.some((r) => r.emoji === emoji && r.user_id === currentUserId);
      return { emoji, count, hasReacted };
    });

    const isReadReceiptActive = settings.read_receipts !== false;
    const isMessageRead = item.is_read && isReadReceiptActive;

    return (
      <View
        style={[
          styles.msgRow,
          isMe ? styles.msgRowMe : styles.msgRowOther,
          reactionCounts.length > 0 && { marginBottom: 20 },
        ]}
      >
        {/* WhatsApp-Style Floating Reaction Bar directly above the selected message */}
        {isSelected && (
          <View
            style={[
              styles.floatingReactionPill,
              isMe ? styles.floatingReactionPillMe : styles.floatingReactionPillOther,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              },
            ]}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.floatingReactionBtn}
                onPress={() => {
                  handleToggleReaction(item.id, emoji);
                  setSelectedMessage(null);
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.floatingReactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <SwipeableMessageRow
          isMe={isMe}
          themeColors={themeColors}
          isDark={isDark}
          onSwipeReply={() => {
            triggerHaptic(30);
            setReplyingTo(item);
          }}
          onDoubleTap={() => {
            handleToggleReaction(item.id, '❤️');
          }}
          onLongPress={() => {
            triggerHaptic(40);
            setSelectedMessage(item);
          }}
        >
          <View
            style={[
              styles.bubble,
              isMe
                ? styles.bubbleMe
                : [
                  styles.bubbleOther,
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.border,
                  },
                ],
              isMediaOnly && (isMe ? styles.bubbleMediaOnlyMe : styles.bubbleMediaOnlyOther),
              isSelected && (isMe ? styles.bubbleSelectedMe : styles.bubbleSelectedOther),
            ]}
          >
            {item.reply_to_id ? (
              (() => {
                const repliedMsg = messages.find((m) => m.id === item.reply_to_id);
                const authorName = repliedMsg
                  ? (repliedMsg.sender_id === currentUserId ? 'You' : partnerDetails.name)
                  : 'Reply';
                const repThumb = repliedMsg ? getReplyThumbnail(repliedMsg) : null;
                const rawSnippet = repliedMsg
                  ? formatDisplayFallback(repliedMsg.displayContent || repliedMsg.content)
                  : 'Quoted message';
                const snippet = getReplySnippet(repliedMsg, rawSnippet);

                return (
                  <View
                    style={[
                      styles.quoteBubbleCard,
                      isMe
                        ? styles.quoteBubbleCardMe
                        : [
                          styles.quoteBubbleCardOther,
                          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
                        ],
                    ]}
                  >
                    <View style={[styles.quoteBubbleAccent, isMe ? styles.quoteBubbleAccentMe : styles.quoteBubbleAccentOther]} />
                    <View style={styles.quoteBubbleContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1, marginRight: repThumb ? 8 : 0 }}>
                          <Text style={[styles.quoteBubbleAuthor, isMe ? styles.quoteBubbleAuthorMe : styles.quoteBubbleAuthorOther]}>
                            {authorName}
                          </Text>
                          <Text
                            style={[
                              styles.quoteBubbleText,
                              isMe ? styles.quoteBubbleTextMe : [styles.quoteBubbleTextOther, { color: themeColors.textSecondary }],
                            ]}
                            numberOfLines={2}
                          >
                            {snippet}
                          </Text>
                        </View>
                        {repThumb ? (
                          <CachedImage
                            uri={repThumb}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                            }}
                            resizeMode="cover"
                          />
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : null}
            {/* Media Attachment Rendering */}
            {item.attachment_url ? (
              <View style={displayText ? { marginBottom: 6 } : undefined}>
                <MediaCollageGrid
                  mediaUrl={item.attachment_url}
                  mediaType={item.attachment_type}
                  onOpenImage={(url) => openImageLightbox(url)}
                  onOpenFile={(url) => Linking.openURL(url).catch(() => {})}
                  isOwn={isMe}
                  imageContainerStyle={
                    isMediaOnly
                      ? (isMe ? styles.mediaOnlyImageContainerMe : styles.mediaOnlyImageContainerOther)
                      : (isMe ? styles.mediaWithCaptionImageContainerMe : styles.mediaWithCaptionImageContainerOther)
                  }
                  overlayMeta={
                    isMediaOnly ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        {isStarred && <Icon name="star" size={10} color="#FBBF24" fill="#FBBF24" />}
                        <Text style={{ fontSize: 9.5, color: '#FFFFFF', fontWeight: '600' }}>
                          {formatTime(item.created_at)}
                        </Text>
                        {isMe && (
                          <View style={styles.tickContainer}>
                            <Icon
                              name="check-check"
                              size={13}
                              color={isMessageRead ? '#60A5FA' : 'rgba(255,255,255,0.7)'}
                              strokeWidth={isMessageRead ? 2.5 : 2}
                            />
                          </View>
                        )}
                      </View>
                    ) : undefined
                  }
                />
              </View>
            ) : null}

            {displayText ? (
              <View style={[styles.bubbleContentRow, item.attachment_url && { paddingHorizontal: 12, paddingBottom: 6 }]}>
                <Text
                  style={[
                    styles.msgText,
                    isMe
                      ? styles.msgTextMe
                      : [styles.msgTextOther, { color: themeColors.textPrimary }],
                  ]}
                >
                  {displayText}
                </Text>

                {/* Inline Timestamp, Star indicator, and Double-tick status */}
                <View style={styles.msgFooterInline}>
                  {isStarred && (
                    <Icon name="star" size={10} color="#F59E0B" />
                  )}
                  <Text
                    style={[
                      styles.msgTime,
                      isMe ? styles.msgTimeMe : [styles.msgTimeOther, { color: themeColors.textMuted }],
                    ]}
                  >
                    {formatTime(item.created_at)}
                  </Text>
                  {isMe && (
                    <View style={styles.tickContainer}>
                      <Icon
                        name="check-check"
                        size={13}
                        color={isMessageRead ? '#60A5FA' : 'rgba(255,255,255,0.7)'}
                        strokeWidth={isMessageRead ? 2.5 : 2}
                      />
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {/* Unified Reactions Pill Container - positioned on Bottom-Left and hanging down */}
            {reactionCounts.length > 0 && (() => {
              const uniqueEmojis = reactionCounts.map((rc) => rc.emoji);
              const totalCount = reactionCounts.reduce((sum, rc) => sum + rc.count, 0);
              const myReaction = reactionCounts.find((rc) => rc.hasReacted);

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.unifiedReactionsPill,
                    isMe ? styles.unifiedReactionsPillMe : styles.unifiedReactionsPillOther,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: myReaction
                        ? (isDark ? 'rgba(255, 75, 51, 0.5)' : '#FFD6D0')
                        : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0'),
                    },
                    myReaction && {
                      backgroundColor: isDark ? '#2A1F22' : '#FFF7F5',
                    },
                  ]}
                  onPress={() => {
                    if (myReaction) {
                      handleToggleReaction(item.id, myReaction.emoji);
                    } else if (reactionCounts.length > 0) {
                      handleToggleReaction(item.id, reactionCounts[0].emoji);
                    }
                  }}
                  onLongPress={() => setSelectedMessage(item)}
                >
                  <View style={styles.unifiedReactionsEmojiRow}>
                    {uniqueEmojis.slice(0, 4).map((em, idx) => (
                      <Text key={idx} style={styles.unifiedReactionEmoji}>
                        {em}
                      </Text>
                    ))}
                  </View>
                  {totalCount > 1 && (
                    <Text
                      style={[
                        styles.unifiedReactionCountText,
                        {
                          color: myReaction
                            ? ORANGE
                            : (isDark ? '#94A3B8' : '#64748B'),
                        },
                      ]}
                    >
                      {totalCount}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>
        </SwipeableMessageRow>
      </View>
    );
  };

  const isSelectedMsgMe = selectedMessage?.sender_id === currentUserId;
  const isSelectedMsgStarred = selectedMessage ? starredMsgIds.has(selectedMessage.id) : false;

  return (
    <TabletContainer backgroundColor={themeColors.bgScreen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: themeColors.bgScreen }]}
      >
        {/* Header: Normal DM Header OR WhatsApp-Style Message Selection Action Header */}
        {selectedMessage ? (
          <View
            style={[
              styles.headerSelection,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderBottomColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.headerSelectionLeft}>
              <TouchableOpacity
                style={styles.headerSelectionIconBtn}
                onPress={() => setSelectedMessage(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="arrow-left" size={20} color={themeColors.textPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={[styles.headerSelectionCount, { color: themeColors.textPrimary }]}>1</Text>
            </View>

            <View style={styles.headerSelectionActions}>
              {/* Reply */}
              <TouchableOpacity
                style={styles.headerSelectionActionBtn}
                onPress={() => {
                  setReplyingTo(selectedMessage);
                  setSelectedMessage(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Reply"
              >
                <Icon name="corner-up-left" size={18} color={themeColors.textPrimary} strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Star / Unstar */}
              <TouchableOpacity
                style={styles.headerSelectionActionBtn}
                onPress={() => handleToggleStar(selectedMessage.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Star"
              >
                <Icon
                  name="star"
                  size={18}
                  color={isSelectedMsgStarred ? '#F59E0B' : themeColors.textPrimary}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>

              {/* Copy */}
              <TouchableOpacity
                style={styles.headerSelectionActionBtn}
                onPress={handleCopyMessage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Copy"
              >
                <Icon name="copy" size={18} color={themeColors.textPrimary} strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Forward */}
              <TouchableOpacity
                style={styles.headerSelectionActionBtn}
                onPress={() => {
                  const text = selectedMessage?.displayContent || selectedMessage?.content;
                  if (text) handleForwardMessage(text);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Forward"
              >
                <Icon name="share-2" size={18} color={themeColors.textPrimary} strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Message Info (if outgoing) */}
              {isSelectedMsgMe && (
                <TouchableOpacity
                  style={styles.headerSelectionActionBtn}
                  onPress={() => {
                    setInfoMessage(selectedMessage);
                    setSelectedMessage(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Message Info"
                >
                  <Icon name="info" size={18} color={themeColors.textPrimary} strokeWidth={2.2} />
                </TouchableOpacity>
              )}

              {/* Delete / Report */}
              {isSelectedMsgMe ? (
                <TouchableOpacity
                  style={styles.headerSelectionActionBtn}
                  onPress={() => handleUndoMessage(selectedMessage.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Delete"
                >
                  <Icon name="trash-2" size={18} color="#EF4444" strokeWidth={2.2} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.headerSelectionActionBtn}
                  onPress={() => {
                    setReportingMessage(selectedMessage);
                    setSelectedMessage(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Report"
                >
                  <Icon name="flag" size={18} color="#EF4444" strokeWidth={2.2} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.header,
              {
                backgroundColor: themeColors.bgCard,
                borderBottomColor: themeColors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => handleSmartBack(navigation, 'Messages')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="arrow-left" size={20} color={themeColors.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.partnerInfoTouch}
              onPress={() => setShowDMSettings(true)}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrap}>
                {partnerDetails.avatar ? (
                  <CachedImage uri={partnerDetails.avatar} style={styles.headerAvatar} />
                ) : (
                  <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                    <Text style={styles.headerAvatarFallbackText}>
                      {(partnerDetails.name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {settings.show_online_status !== false && isPartnerOnline ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={[styles.partnerName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {partnerDetails.name}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Single Call Button */}
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }]}
              onPress={handleCallButtonPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Start Call"
            >
              <Icon name="phone" size={18} color={ORANGE} />
            </TouchableOpacity>
          </View>
        )}

        {/* Active Call Floating Banner */}
        {isCallActive && (
          <View style={styles.activeCallBanner}>
            <View style={styles.activeCallLeft}>
              <View style={styles.activeCallPulseDot} />
              <Text style={styles.activeCallText}>Live Call in progress</Text>
            </View>
            <TouchableOpacity
              style={styles.activeCallJoinBtn}
              onPress={() => handleStartCall(true)}
              activeOpacity={0.8}
            >
              <Icon name="phone" size={12} color="#FFFFFF" />
              <Text style={styles.activeCallJoinText}>Join Call</Text>
            </TouchableOpacity>
          </View>
        )}



        {/* Messages Feed */}
        {loading ? (
          <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false}>
            <ChatMessagesSkeleton showAvatars={false} showAuthorNames={false} />
          </ScrollView>
        ) : (
          <FlashListAny
            ref={flatListRef}
            data={messages}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            estimatedItemSize={90}
            onContentSizeChange={() => {
              if (messages && messages.length > 0) {
                try {
                  flatListRef.current?.scrollToEnd({ animated: true });
                } catch { }
              }
            }}
            ListHeaderComponent={
              hasMoreOlder && resolvedConvId ? (
                <TouchableOpacity
                  style={[
                    styles.loadOlderBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6',
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    if (resolvedConvId) fetchOlderDMs(resolvedConvId);
                  }}
                  disabled={loadingOlder}
                  activeOpacity={0.7}
                >
                  {loadingOlder ? (
                    <ActivityIndicator size="small" color={ORANGE} />
                  ) : (
                    <>
                      <Icon name="chevron-up" size={14} color={themeColors.textSecondary} />
                      <Text style={[styles.loadOlderText, { color: themeColors.textSecondary }]}>Load earlier messages</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyAvatarBig}>
                  {partnerDetails.avatar ? (
                    <CachedImage uri={partnerDetails.avatar} style={styles.bigAvatar} />
                  ) : (
                    <View style={[styles.bigAvatar, styles.bigAvatarFallback]}>
                      <Text style={styles.bigAvatarFallbackText}>
                        {(partnerDetails.name || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.emptyName, { color: themeColors.textPrimary }]}>{partnerDetails.name}</Text>
                <Text style={styles.emptyCraft}>{partnerDetails.craft}</Text>
                <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
                  This is the beginning of your direct conversation. Say hello! 👋
                </Text>
              </View>
            }
          />
        )}

        {/* WhatsApp-Style Replying Bar docked right on top of text input */}
        {replyingTo && (() => {
          const repThumb = getReplyThumbnail(replyingTo);
          const authorName = replyingTo.sender_id === currentUserId ? 'You' : partnerDetails.name;
          const rawSnippet = formatDisplayFallback(replyingTo.displayContent || replyingTo.content);
          const snippet = getReplySnippet(replyingTo, rawSnippet);

          return (
            <View
              style={[
                styles.replyingBar,
                {
                  backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                  borderTopColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.replyingBarAccent} />
              <View style={styles.replyingContentWrap}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flex: 1 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replyingAuthorName}>
                      {authorName}
                    </Text>
                    <Text style={[styles.replyingSnippetText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {snippet}
                    </Text>
                  </View>
                  {repThumb ? (
                    <CachedImage
                      uri={repThumb}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={styles.replyingCloseBtn}
                onPress={() => setReplyingTo(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Horizontal Attachment Preview Bar */}
        {attachedFiles.length > 0 && (
          <View style={{ backgroundColor: isDark ? '#1E293B' : '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: themeColors.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {attachedFiles.map((file, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#334155' : '#FFFFFF', borderRadius: 20, paddingLeft: 10, paddingRight: 6, paddingVertical: 4, borderWidth: 1, borderColor: themeColors.border }}>
                  <Icon name={file.type?.startsWith('image/') ? 'image' : file.type?.startsWith('video/') ? 'video' : 'file'} size={14} color={ORANGE} />
                  <Text style={{ fontSize: 12, color: themeColors.textPrimary, marginLeft: 6, maxWidth: 120 }} numberOfLines={1}>
                    {file.name || 'Attachment'}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))} style={{ marginLeft: 6, padding: 2 }}>
                    <Icon name="x" size={14} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: themeColors.bgCard,
              borderTopColor: themeColors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={handlePickDocument} style={{ padding: 8, marginRight: 2 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="paperclip" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: themeColors.inputBg,
                color: themeColors.textPrimary,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={themeColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, ((!inputText.trim() && attachedFiles.length === 0) || sending || uploadingMedia) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!inputText.trim() && attachedFiles.length === 0) || sending || uploadingMedia}
          >
            {sending || uploadingMedia ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="send" size={17} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>



        {/* Message Info Modal */}
        <ReportModal
          visible={!!reportingMessage}
          onClose={() => setReportingMessage(null)}
          targetTitle="this message"
          targetType="message"
          targetId={reportingMessage?.id}
          messageReport={reportingMessage ? {
            messageId: reportingMessage.id,
            channelId: resolvedConvId,
            scope: 'dm',
            decryptedContent: String(reportingMessage.displayContent || reportingMessage.content || ''),
          } : undefined}
        />
        <Modal
          visible={!!infoMessage}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoMessage(null)}
        >
          <TouchableWithoutFeedback onPress={() => setInfoMessage(null)}>
            <View style={styles.infoModalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.infoModalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.infoModalHeader}>
                    <Text style={[styles.infoModalTitle, { color: themeColors.textPrimary }]}>Message Info</Text>
                    <TouchableOpacity onPress={() => setInfoMessage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="x" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.infoContentWrap}>
                    {/* Sent Time */}
                    <View style={[styles.infoRow, { borderBottomColor: themeColors.border }]}>
                      <View style={styles.infoRowLeft}>
                        <Icon name="send" size={16} color={ORANGE} />
                        <Text style={[styles.infoRowLabel, { color: themeColors.textPrimary }]}>Sent</Text>
                      </View>
                      <Text style={[styles.infoRowVal, { color: themeColors.textSecondary }]}>
                        {formatFullDateTime(infoMessage?.created_at)}
                      </Text>
                    </View>

                    {/* Read / Delivery Status */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoRowLeft}>
                        <Icon
                          name="check-check"
                          size={17}
                          color={infoMessage?.is_read && settings.read_receipts !== false ? '#60A5FA' : 'rgba(156, 163, 175, 0.9)'}
                          strokeWidth={infoMessage?.is_read && settings.read_receipts !== false ? 2.5 : 2}
                        />
                        <Text style={[styles.infoRowLabel, { color: themeColors.textPrimary }]}>Read Status</Text>
                      </View>
                      <View style={styles.infoStatusPill}>
                        <Text
                          style={[
                            styles.infoStatusText,
                            { color: infoMessage?.is_read && settings.read_receipts !== false ? '#3B82F6' : themeColors.textSecondary },
                          ]}
                        >
                          {infoMessage?.is_read && settings.read_receipts !== false ? 'Read by recipient' : 'Delivered'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.infoCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                    onPress={() => setInfoMessage(null)}
                  >
                    <Text style={[styles.infoCloseBtnText, { color: themeColors.textPrimary }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Dedicated DM Settings Modal */}
        <DMSettingsModal
          visible={showDMSettings}
          conversationId={resolvedConvId}
          partnerId={resolvedPartnerId}
          partnerName={partnerDetails.name}
          partnerAvatar={partnerDetails.avatar}
          partnerCraft={partnerDetails.craft}
          currentUserId={currentUserId}
          isOnline={isPartnerOnline}
          onClose={() => setShowDMSettings(false)}
          onStartCall={handleStartCall}
          onViewProfile={() => {
            if (resolvedPartnerId) {
              navigation.navigate('PublicProfile', {
                creatorName: partnerDetails.name,
                craft: partnerDetails.craft,
                userId: resolvedPartnerId,
              });
            }
          }}
          onClearChat={handleClearChat}
          onMuteChanged={(muted) => setIsMuted(muted)}
        />

        {/* WhatsApp-Style Fullscreen Media Gallery Lightbox Modal with Side Swiping */}
        <Modal
          visible={lightboxState.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxState((prev) => ({ ...prev, visible: false }))}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
            {/* Header Bar */}
            <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 0, zIndex: 10 }}>
              <TouchableOpacity onPress={() => setLightboxState((prev) => ({ ...prev, visible: false }))} style={{ padding: 8 }}>
                <Icon name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                {lightboxState.images.length > 0 ? `${lightboxState.currentIndex + 1} of ${lightboxState.images.length}` : ''}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Horizontal Side-Swiping Carousel */}
            <FlatList
              data={lightboxState.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={lightboxState.currentIndex >= 0 && lightboxState.currentIndex < lightboxState.images.length ? lightboxState.currentIndex : 0}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setLightboxState((prev) => ({ ...prev, currentIndex: idx }));
              }}
              keyExtractor={(item, index) => item + index}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, height: '88%', justifyContent: 'center', alignItems: 'center' }}>
                  <CachedImage uri={item} style={{ width: SCREEN_WIDTH, height: '100%' }} resizeMode="contain" />
                </View>
              )}
            />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  partnerInfoTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  headerAvatarFallback: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  headerAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerTextGroup: { flex: 1, justifyContent: 'center' },
  partnerName: { color: INK, fontSize: 15.5, fontWeight: '700' },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messagesList: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginHorizontal: 60,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadOlderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  swipeContainer: {
    position: 'relative',
    width: '100%',
  },
  swipeContainerMe: {
    alignItems: 'flex-end',
  },
  swipeContainerOther: {
    alignItems: 'flex-start',
  },
  swipeInnerWrap: {
    maxWidth: '82%',
  },
  swipeInnerWrapMe: {
    alignSelf: 'flex-end',
  },
  swipeInnerWrapOther: {
    alignSelf: 'flex-start',
  },
  touchableBubbleWrap: {
    maxWidth: '100%',
  },
  touchableBubbleWrapMe: {
    alignSelf: 'flex-end',
  },
  touchableBubbleWrapOther: {
    alignSelf: 'flex-start',
  },
  swipeReplyIconWrap: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -16,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  msgRow: { marginVertical: 3, width: '100%' },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  headerSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerSelectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSelectionIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSelectionCount: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSelectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerSelectionActionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  floatingReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
    marginBottom: 6,
    gap: 6,
    zIndex: 10,
  },
  floatingReactionPillMe: {
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  floatingReactionPillOther: {
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  floatingReactionBtn: {
    padding: 3,
    borderRadius: 14,
  },
  floatingReactionEmoji: {
    fontSize: 20,
  },
  bubbleSelectedMe: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FF4B33',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  bubbleSelectedOther: {
    borderWidth: 1.5,
    borderColor: ORANGE,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: ORANGE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
    alignSelf: 'flex-end',
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'flex-start',
  },
  bubbleMediaOnlyMe: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  bubbleMediaOnlyOther: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  mediaOnlyImageContainerMe: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 3,
  },
  mediaOnlyImageContainerOther: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 16,
  },
  mediaWithCaptionImageContainerMe: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  mediaWithCaptionImageContainerOther: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  quoteBubbleCard: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    paddingRight: 6,
    minWidth: 100,
  },
  quoteBubbleCardMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  quoteBubbleCardOther: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  quoteBubbleAccent: {
    width: 3.5,
  },
  quoteBubbleAccentMe: {
    backgroundColor: '#FFFFFF',
  },
  quoteBubbleAccentOther: {
    backgroundColor: ORANGE,
  },
  quoteBubbleContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quoteBubbleAuthor: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 1,
  },
  quoteBubbleAuthorMe: {
    color: '#FFFFFF',
  },
  quoteBubbleAuthorOther: {
    color: ORANGE,
  },
  quoteBubbleText: {
    fontSize: 12,
    lineHeight: 16,
  },
  quoteBubbleTextMe: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  quoteBubbleTextOther: {
    color: '#4B5563',
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  replyingBarAccent: {
    width: 3.5,
    height: '100%',
    minHeight: 34,
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  replyingContentWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  replyingAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: 2,
  },
  replyingSnippetText: {
    fontSize: 12.5,
  },
  replyingCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  msgTextMe: { color: '#FFFFFF' },
  msgTextOther: { color: INK },
  msgFooterInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    gap: 3,
    paddingBottom: 1,
  },
  tickContainer: { marginLeft: 2, justifyContent: 'center', alignItems: 'center' },
  msgTime: { fontSize: 9.5 },
  msgTimeMe: { color: 'rgba(255,255,255,0.75)' },
  msgTimeOther: { color: '#9CA3AF' },

  unifiedReactionsPill: {
    position: 'absolute',
    bottom: -17,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 3,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 4,
  },
  unifiedReactionsPillMe: {
    left: 8,
  },
  unifiedReactionsPillOther: {
    left: 8,
  },
  unifiedReactionsEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  unifiedReactionEmoji: {
    fontSize: 13.5,
    lineHeight: 16,
  },
  unifiedReactionCountText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 1,
  },

  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyAvatarBig: { marginBottom: 12 },
  bigAvatar: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  bigAvatarFallback: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  bigAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 28,
    fontWeight: '800',
  },
  emptyName: { fontSize: 17, fontWeight: '800', color: INK },
  emptyCraft: { fontSize: 11, fontWeight: '800', color: ORANGE, textTransform: 'uppercase', marginTop: 2, marginBottom: 8 },
  emptyHint: { fontSize: 12.5, color: '#6B7280', textAlign: 'center', lineHeight: 18 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 13.5,
    color: INK,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#FCA5A5' },

  // Message Context Options Modal
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  menuModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  quickReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  quickReactionBtn: {
    padding: 6,
    borderRadius: 20,
  },
  quickReactionEmoji: {
    fontSize: 24,
  },
  menuPreviewBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  menuPreviewText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  menuActionsList: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Message Info Modal
  infoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoContentWrap: {
    gap: 12,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  infoRowVal: {
    fontSize: 12,
  },
  infoStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  infoStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  infoCloseBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  // Active Call Banner
  activeCallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeCallPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activeCallText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '700',
  },
  activeCallJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  activeCallJoinText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Centered Call Event Card in Message Stream
  callEventCenteredRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  callEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
  },
  callEventIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callEventIconGreen: {
    backgroundColor: '#DCFCE7',
  },
  callEventIconRed: {
    backgroundColor: '#FEE2E2',
  },
  callEventTextWrap: {
    flexDirection: 'column',
  },
  callEventTitle: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '700',
  },
  callEventTime: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  callEventActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
  },
  callJoinBadge: {
    backgroundColor: '#ECFDF5',
  },
  callBackBadge: {
    backgroundColor: '#F1F5F9',
  },
  callEventActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  callJoinText: {
    color: '#059669',
  },
  callBackText: {
    color: '#64748B',
  },
});

export default ConversationScreen;
