import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Clipboard,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  InteractionManager,
  PanResponder,
  Animated,
  Dimensions,
  FlatList,
  AppState,
  Linking,
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { pickAttachments } from '../../services/attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../../config/env';
import { getCache, saveCache, getCacheSync, getCurrentUserIdSync, resolveCurrentUserId } from '../../services/offlineCache';
import { ChatMessagesSkeleton } from '../../components/common/Skeleton';
import { CachedImage } from '../../components/common/CachedImage';
import { MediaCollageGrid } from '../../components/chat/MediaCollageGrid';
import { getReplyThumbnail, getReplySnippet } from '../../components/chat/chatUtils';
import { FlashList } from '@shopify/flash-list';
import { useGroupEncryption } from '../../hooks/useGroupEncryption';
import { ShareCard, ShareCardData } from '../../components/chat/ShareCard';
import { RoomSettingsModal } from '../../components/chat/RoomSettingsModal';
import { useGlobalCall } from '../../contexts/CallContext';
import { InlineCallPanel } from '../../components/calls/InlineCallPanel';
import { beginCallSession, askHowToStart } from '../../services/callSession';
import { findActiveCall } from '../../services/liveCall';
import { useUserSettings } from '../../hooks/useUserSettings';
import { setActiveChatContext, clearActiveChatContext } from '../../services/activeScreenTracker';
import { handleSmartBack } from '../../services/navigationUtils';
import { uploadMediaPipeline } from '../../services/mediaPipeline';

const ORANGE = '#FF5733';
const INK = '#0D0D0D';
const SCREEN_WIDTH = Dimensions.get('window').width;
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    iconEmoji: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗',
      '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨',
      '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
      '😰', '😥', '😓', '🫣', '🤗', '🫡', '🤔', '🫢', '🤫', '🫠',
      '🤥', '😶', '🫥', '😐', '🫤', '😑', '🫨', '😬', '🙄', '😯',
      '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫',
      '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕',
    ],
  },
  {
    id: 'cinema',
    name: 'Cinema',
    iconEmoji: '🎬',
    emojis: [
      '🎬', '🎥', '🍿', '🎞️', '📽️', '🎭', '🎪', '🎨', '🎙️', '🎧',
      '📻', '📸', '📹', '📼', '📺', '📀', '💿', '🎟️', '🎫', '🏆',
      '🥇', '🎖️', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺', '🎸',
      '🪕', '🎻', '🪄', '🖌️', '🖍️', '🧵', '🪡', '✂️', '📐', '🏷️',
      '🕹️', '🎮', '🎲', '🎳', '🥊', '🎯', '✨', '⚡', '🌟', '💫',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    iconEmoji: '👍',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
      '🦾', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🫰', '🤟', '🤘',
      '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
      '🖐️', '🖖', '👋', '🤙', '🫲', '🫱', '🫴', '🫳', '🫦', '👄',
      '💋', '👀', '👁️', '🧠', '🫀', '🫁', '🩸', '👣', '👂', '👃',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    iconEmoji: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💌',
      '💘', '💝', '🎁', '🎈', '🎉', '🎊', '🔥', '✨', '💯', '⚡',
      '⭐', '🌟', '💥', '💡', '🔔', '📢', '📣', '💬', '💭', '🗨️',
      '🗯️', '🔒', '🔓', '🔑', '🛡️', '☀️', '🌙', '⭐', '🌈', '💎',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    iconEmoji: '🍕',
    emojis: [
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🍷', '🥂', '🥃', '🍸',
      '🍹', '🍕', '🍔', '🍟', '🌭', '🍿', '🌮', '🌯', '🍜', '🍝',
      '🍣', '🍱', '🍦', '🍩', '🎂', '🍰', '🍫', '🍬', '🍭', '🍪',
      '🍎', '🍓', '🍇', '🍉', '🍌', '🥑', '🥦', '🌶️', '🧀', '🥐',
    ],
  },
  {
    id: 'travel',
    name: 'Places',
    iconEmoji: '🚀',
    emojis: [
      '🚀', '✈️', '🛫', '🛬', '🚁', '🚗', '🏎️', '🏍️', '🛵', '🚲',
      '🚂', '🚆', '🚇', '🏖️', '🏝️', '🌋', '🏔️', '⛰️', '🏕️', '⛺',
      '🏠', '🏡', '🏢', '🏰', '🗼', '🗽', '🌆', '🏙️', '🌃', '🌌',
    ],
  },
];

const SENDER_COLORS = [
  '#BE185D', // crimson red matching web screenshot 'demon'
  '#2563EB', // blue
  '#D97706', // amber
  '#059669', // emerald
  '#7C3AED', // violet
  '#DB2777', // pink
  '#0891B2', // cyan
];

const getUserColor = (userId: string) => {
  if (!userId) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

// URL detection for allowLinks enforcement
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const containsURL = (text: string): boolean => URL_PATTERN.test(text);

// Profanity filter
const PROFANITY_LIST: string[] = [];
const applyProfanityFilter = (text: string): string => {
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '***');
  });
  return filtered;
};

const shareDataCache = new Map<string, { type: ShareCardData['type']; data: any } | null>();
const parseShareData = (content: string): { type: ShareCardData['type']; data: any } | null => {
  if (!content) return null;
  if (shareDataCache.has(content)) {
    return shareDataCache.get(content)!;
  }
  const prefixes: { prefix: string; type: ShareCardData['type'] }[] = [
    { prefix: 'POST_SHARE::', type: 'post' },
    { prefix: 'MARKETPLACE_SHARE::', type: 'marketplace' },
    { prefix: 'ANNOUNCEMENT_SHARE::', type: 'announcement' },
    { prefix: 'VENDOR_SHARE::', type: 'vendor' },
    { prefix: 'PROJECT_SHARE::', type: 'project' },
    { prefix: 'PROFILE_SHARE::', type: 'profile' },
    { prefix: 'PITCH_SHARE::', type: 'pitch' },
    { prefix: 'COMPANY_SHARE::', type: 'company' },
    { prefix: 'DISCUSSION_SHARE::', type: 'room' },
    { prefix: 'ROOM_SHARE::', type: 'room' },
    { prefix: 'CONTENT_SHARE::', type: 'post' },
  ];

  for (const { prefix, type } of prefixes) {
    if (content.startsWith(prefix)) {
      try {
        const jsonStr = content.substring(prefix.length);
        const parsed = JSON.parse(jsonStr);
        const res = { type, data: { ...parsed, type } };
        shareDataCache.set(content, res);
        return res;
      } catch {
        shareDataCache.set(content, null);
        return null;
      }
    }
  }

  if (content.includes('JOB_SHARE::')) {
    try {
      const parts = content.split('JOB_SHARE::');
      const jsonStr = parts[parts.length - 1].trim();
      const parsed = JSON.parse(jsonStr);
      const res = { type: 'job' as const, data: { ...parsed, type: 'job' } };
      shareDataCache.set(content, res);
      return res;
    } catch {
      shareDataCache.set(content, null);
      return null;
    }
  }

  shareDataCache.set(content, null);
  return null;
};

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const monthNames = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

interface SwipeableMessageProps {
  children: React.ReactNode;
  onPress?: () => void;
  onSwipeReply?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  isOwn?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

const SwipeableMessage = React.memo<SwipeableMessageProps>(({
  children,
  onPress,
  onSwipeReply,
  onDoubleTap,
  onLongPress,
  isOwn,
  isSelected,
  isSelectionMode,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  const isSelectionModeRef = useRef(isSelectionMode);
  isSelectionModeRef.current = isSelectionMode;
  const onSwipeReplyRef = useRef(onSwipeReply);
  onSwipeReplyRef.current = onSwipeReply;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isSelectionModeRef.current) return false;
        return gestureState.dx > 14 && Math.abs(gestureState.dy) < 16;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const drag = Math.min(gestureState.dx, 75);
          panX.setValue(drag);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 42 && onSwipeReplyRef.current) {
          onSwipeReplyRef.current();
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
    if (isSelectionMode && onPress) {
      onPress();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      if (onDoubleTap) onDoubleTap();
    } else {
      lastTapRef.current = now;
      if (onPress) onPress();
    }
  };

  const replyIconOpacity = panX.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const replyIconScale = panX.interpolate({
    inputRange: [0, 30, 60],
    outputRange: [0.5, 1, 1.2],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ position: 'relative', width: '100%', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 12,
          top: '30%',
          opacity: replyIconOpacity,
          transform: [{ scale: replyIconScale }],
          zIndex: -1,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Icon name="corner-up-left" size={16} color={ORANGE} strokeWidth={2.2} />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          { transform: [{ translateX: panX }] },
          { width: '100%', alignItems: isOwn ? 'flex-end' : 'flex-start' },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          delayPressIn={0}
          delayLongPress={160}
          onPress={handlePress}
          onLongPress={onLongPress}
          style={{ width: '100%', alignItems: isOwn ? 'flex-end' : 'flex-start' }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

interface DiscussionMessageRowProps {
  item: any;
  index: number;
  isOwn: boolean;
  showDateHeader: boolean;
  currentDateLabel: string;
  isSameSenderAsPrev: boolean;
  isSameSenderAsNext: boolean;
  author: any;
  userColor: string;
  timeStr: string;
  replyMsg: any;
  shareInfo: any;
  isStarred: boolean;
  seenStatusLabel: string;
  themeColors: any;
  isDark: boolean;
  currentUserId?: string | null;
  currentUserProfile?: any;
  roomId?: string | null;
  roomTitle?: string | null;
  navigation: any;
  decryptFallback: (raw: string) => string;
  setSelectedImageModal: (url: string) => void;
  isSelected?: boolean;
  isSingleSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelectMsg?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onSwipeReply?: (msg: any) => void;
  onToggleReaction?: (msgId: string, emoji: string) => void;
  /** Join the room's call (opens the Call tab inside the room). */
  onJoinCall?: () => void;
}

const areDiscussionMessageRowPropsEqual = (
  prev: DiscussionMessageRowProps,
  next: DiscussionMessageRowProps
): boolean => {
  if (prev.isOwn !== next.isOwn) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isSingleSelected !== next.isSingleSelected) return false;
  if (prev.isSelectionMode !== next.isSelectionMode) return false;
  if (prev.isStarred !== next.isStarred) return false;
  if (prev.seenStatusLabel !== next.seenStatusLabel) return false;
  if (prev.showDateHeader !== next.showDateHeader) return false;
  if (prev.currentDateLabel !== next.currentDateLabel) return false;
  if (prev.isSameSenderAsPrev !== next.isSameSenderAsPrev) return false;
  if (prev.isSameSenderAsNext !== next.isSameSenderAsNext) return false;
  if (prev.isDark !== next.isDark) return false;
  if (prev.themeColors !== next.themeColors) return false;

  // Item checks
  if (prev.item?.id !== next.item?.id) return false;
  if (prev.item?.content !== next.item?.content) return false;
  if (prev.item?.media_url !== next.item?.media_url) return false;
  if (prev.item?.media_type !== next.item?.media_type) return false;
  if (prev.item?.is_deleted !== next.item?.is_deleted) return false;

  // Reactions fast check
  const prevRx = prev.item?.reactions;
  const nextRx = next.item?.reactions;
  if ((prevRx?.length || 0) !== (nextRx?.length || 0)) return false;
  if (prevRx?.length && nextRx?.length) {
    for (let i = 0; i < prevRx.length; i++) {
      if (
        prevRx[i]?.id !== nextRx[i]?.id ||
        prevRx[i]?.emoji !== nextRx[i]?.emoji ||
        prevRx[i]?.user_id !== nextRx[i]?.user_id
      ) {
        return false;
      }
    }
  }

  // Reply message check
  if (
    prev.replyMsg?.id !== next.replyMsg?.id ||
    prev.replyMsg?.content !== next.replyMsg?.content ||
    prev.replyMsg?.media_url !== next.replyMsg?.media_url ||
    prev.replyMsg?.attachment_url !== next.replyMsg?.attachment_url
  ) {
    return false;
  }

  // Author profile check
  if (
    prev.author?.avatar_url !== next.author?.avatar_url ||
    prev.author?.username !== next.author?.username ||
    prev.author?.full_name !== next.author?.full_name
  ) {
    return false;
  }

  // Current user profile check (for outgoing avatar)
  if (
    prev.currentUserProfile?.avatar_url !== next.currentUserProfile?.avatar_url ||
    prev.currentUserProfile?.username !== next.currentUserProfile?.username ||
    prev.currentUserProfile?.full_name !== next.currentUserProfile?.full_name
  ) {
    return false;
  }

  return true;
};

const renderReplyQuoteBlock = (
  replyMsg: any,
  isOwn: boolean,
  isDark: boolean,
  themeColors: any,
  decryptFallback: (c: string) => string
) => {
  if (!replyMsg) return null;
  const repThumb = getReplyThumbnail(replyMsg);
  const repAuthor = replyMsg.profiles?.username || replyMsg.profiles?.full_name || 'User';
  const rawSnippet = decryptFallback(replyMsg.content);
  const snippet = getReplySnippet(replyMsg, rawSnippet);

  return (
    <View
      style={{
        backgroundColor: isOwn ? 'rgba(0, 0, 0, 0.18)' : (isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)'),
        borderLeftWidth: 3,
        borderLeftColor: isOwn ? '#FFFFFF' : ORANGE,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, marginRight: repThumb ? 8 : 0 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: isOwn ? '#FFFFFF' : ORANGE,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          Replying to {repAuthor}
        </Text>
        <Text
          style={{
            fontSize: 11.5,
            color: isOwn ? 'rgba(255, 255, 255, 0.9)' : themeColors.textSecondary,
          }}
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
  );
};

const DiscussionMessageRow = React.memo<DiscussionMessageRowProps>(({
  item,
  index,
  isOwn,
  showDateHeader,
  currentDateLabel,
  isSameSenderAsPrev,
  isSameSenderAsNext,
  author,
  userColor,
  timeStr,
  replyMsg,
  shareInfo,
  isStarred,
  seenStatusLabel,
  themeColors,
  isDark,
  currentUserId,
  currentUserProfile,
  roomId,
  roomTitle,
  navigation,
  decryptFallback,
  setSelectedImageModal,
  isSelected,
  isSingleSelected,
  isSelectionMode,
  onToggleSelectMsg,
  onLongPress,
  onSwipeReply,
  onToggleReaction,
  onJoinCall,
}) => {
  const isCallEvent =
    item.attachment_type === 'call_event' ||
    (typeof item.content === 'string' &&
      (item.content.includes('Video call started') ||
        item.content.includes('Call ended') ||
        item.content.includes('call started') ||
        item.content.includes('📞')));

  if (isCallEvent) {
    const isVideoStarted =
      item.content?.includes('started') || item.content?.includes('Video call started');
    const cleanContent = item.content ? item.content.replace(/^📞\s*/, '') : '';

    return (
      <View key={item.id}>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <View style={[styles.dateHeaderPill, { backgroundColor: themeColors.chipBg }]}>
              <Text style={[styles.dateHeaderText, { color: themeColors.textSecondary }]}>{currentDateLabel}</Text>
            </View>
          </View>
        )}

        <View style={styles.webCallEventRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              onJoinCall?.();
            }}
            style={[
              styles.webCallEventPill,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <View
              style={[
                styles.webCallIconCircle,
                isVideoStarted ? styles.webCallIconCircleGreen : styles.webCallIconCircleRed,
              ]}
            >
              <Icon name="phone" size={13} color={isVideoStarted ? '#10B981' : '#EF4444'} />
            </View>
            <Text style={[styles.webCallEventText, { color: themeColors.textPrimary }]}>{cleanContent}</Text>
            <View
              style={[
                styles.webCallActionBadge,
                isVideoStarted
                  ? styles.webCallJoinBadge
                  : [styles.webCallBackBadge, { backgroundColor: themeColors.chipBg }],
              ]}
            >
              <Text
                style={[
                  styles.webCallActionText,
                  isVideoStarted
                    ? styles.webCallJoinText
                    : [styles.webCallBackText, { color: themeColors.textSecondary }],
                ]}
              >
                {isVideoStarted ? 'Join' : 'Call'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isMediaOrShare = !!shareInfo || !!item.media_url;

  return (
    <View
      key={item.id}
      style={[
        styles.msgRowWrapper,
        isSelected && {
          backgroundColor: isDark ? 'rgba(255, 75, 51, 0.20)' : 'rgba(255, 75, 51, 0.12)',
          borderRadius: 14,
          paddingVertical: 4,
          paddingHorizontal: 6,
          marginTop: isSingleSelected ? 42 : 0,
        },
        item.reactions && item.reactions.length > 0
          ? { marginBottom: 20 }
          : isSameSenderAsNext
            ? { marginBottom: 3 }
            : { marginBottom: 10 },
      ]}
    >
      {showDateHeader && (
        <View style={styles.dateHeaderContainer}>
          <View style={styles.dateHeaderPill}>
            <Text style={styles.dateHeaderText}>{currentDateLabel}</Text>
          </View>
        </View>
      )}

      {/* Floating Quick Reaction Picker Bar when single message is selected */}
      {isSelected && isSingleSelected && (
        <View
          style={[
            styles.floatingReactionPicker,
            isOwn ? styles.reactionPickerRight : styles.reactionPickerLeft,
            { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
          ]}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onToggleReaction?.(item.id, emoji)}
              style={styles.reactionEmojiBtn}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.reactionEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SwipeableMessage
        isOwn={isOwn}
        isSelected={isSelected}
        isSelectionMode={isSelectionMode}
        onSwipeReply={() => onSwipeReply?.(item)}
        onDoubleTap={() => onToggleReaction?.(item.id, '❤️')}
        onLongPress={() => onLongPress?.(item.id)}
        onPress={() => {
          if (isSelectionMode) {
            onToggleSelectMsg?.(item.id);
          }
        }}
      >
        <View
          style={[
            styles.msgRow,
            isOwn ? styles.msgRowOwn : styles.msgRowOther,
          ]}
        >
          <View
            style={[
              styles.msgInnerRow,
              isOwn ? styles.msgInnerRowOwn : styles.msgInnerRowOther,
            ]}
          >
            {/* Avatar on Left for Others */}
            {!isOwn && (
              <View style={styles.avatarWrapper}>
                {!isSameSenderAsNext ? (
                  author?.avatar_url ? (
                    <CachedImage uri={author.avatar_url} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: '#4C1D95' }]}>
                      <Text style={styles.avatarText}>
                        {(author?.username || author?.full_name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={{ width: 34 }} />
                )}
              </View>
            )}

            <View style={[styles.bubbleColWrap, isOwn ? styles.bubbleColWrapOwn : styles.bubbleColWrapOther]}>
              <View style={[
                styles.touchableBubbleWrap,
                isOwn ? styles.touchableBubbleWrapOwn : styles.touchableBubbleWrapOther,
              ]}>
                <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
                  {/* Share Cards & Photos/Videos */}
                  {isMediaOrShare ? (
                    <View style={styles.transparentMediaWrapper}>
                      {replyMsg && (
                        <View style={{ marginBottom: 4, width: '100%' }}>
                          {renderReplyQuoteBlock(replyMsg, isOwn, isDark, themeColors, decryptFallback)}
                        </View>
                      )}
                      {item.media_url && (
                        <View style={{ marginBottom: 4 }}>
                          <MediaCollageGrid
                            mediaUrl={item.media_url}
                            mediaType={item.media_type}
                            onOpenImage={(url) => setSelectedImageModal(url)}
                            onOpenFile={(url) => Linking.openURL(url).catch(() => { })}
                            onLongPress={() => onLongPress?.(item.id)}
                            isOwn={isOwn}
                          />
                        </View>
                      )}
                      {shareInfo && (
                        <View style={styles.shareCardContainer}>
                          <ShareCard data={shareInfo.data} navigation={navigation} />
                        </View>
                      )}
                      {item.content &&
                        item.content !== 'Shared an attachment' &&
                        item.content !== 'Shared an image' &&
                        item.content !== 'Shared a video' && (
                          <View
                            style={[
                              styles.msgBubble,
                              isOwn
                                ? styles.msgBubbleOwn
                                : [
                                  styles.msgBubbleOther,
                                  { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                                ],
                            ]}
                          >
                            <Text
                              style={[
                                styles.msgBody,
                                isOwn
                                  ? styles.msgBodyOwn
                                  : [styles.msgBodyOther, { color: themeColors.textPrimary }],
                              ]}
                            >
                              {decryptFallback(item.content)}
                            </Text>
                          </View>
                        )}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.msgBubble,
                        isOwn
                          ? styles.msgBubbleOwn
                          : [
                            styles.msgBubbleOther,
                            { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                          ],
                      ]}
                    >
                      {replyMsg && renderReplyQuoteBlock(replyMsg, isOwn, isDark, themeColors, decryptFallback)}
                      {/* First Message Header for Others */}
                      {!isSameSenderAsPrev && !isOwn && (
                        <View style={styles.webMsgHeaderRow}>
                          <Text style={[styles.msgAuthor, { color: userColor }]}>
                            {author.username || author.full_name || 'demon'}
                          </Text>
                        </View>
                      )}

                      {/* Normal Text Content */}
                      <View style={styles.textRow}>
                        <Text
                          style={[
                            styles.msgBody,
                            isOwn
                              ? styles.msgBodyOwn
                              : [styles.msgBodyOther, { color: themeColors.textPrimary }],
                          ]}
                        >
                          {decryptFallback(item.content)}
                        </Text>
                        <View style={styles.inlineTimeWrap}>
                          <Text
                            style={[
                              styles.inlineTime,
                              isOwn
                                ? styles.inlineTimeOwn
                                : [styles.inlineTimeOther, { color: themeColors.textMuted }],
                            ]}
                          >
                            {timeStr}
                          </Text>
                          {isStarred && (
                            <Icon name="star" size={10} color={isOwn ? 'rgba(255,255,255,0.95)' : '#F59E0B'} fill={isOwn ? 'rgba(255,255,255,0.95)' : '#F59E0B'} style={{ marginLeft: 3 }} />
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Unified Reactions Pill Container */}
              {item.reactions && item.reactions.length > 0 && (() => {
                const reactionsList = item.reactions || [];
                const totalCount = reactionsList.length;
                const emojiCounts: Record<string, number> = {};
                reactionsList.forEach((r: any) => {
                  emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
                });
                const uniqueEmojis = Object.keys(emojiCounts).slice(0, 3);
                const myReaction = reactionsList.find((r: any) => r.user_id === currentUserId);

                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.unifiedReactionsPill,
                      isOwn ? styles.unifiedReactionsPillOwn : styles.unifiedReactionsPillOther,
                      {
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        borderColor: myReaction ? ORANGE : themeColors.border,
                      },
                    ]}
                    onPress={() => {
                      if (myReaction) {
                        onToggleReaction?.(item.id, myReaction.emoji);
                      } else {
                        onLongPress?.(item.id);
                      }
                    }}
                  >
                    <View style={styles.unifiedReactionsEmojiRow}>
                      {uniqueEmojis.map((e, idx) => (
                        <Text key={idx} style={styles.unifiedReactionEmoji}>{e}</Text>
                      ))}
                    </View>
                    {totalCount > 1 && (
                      <Text style={[styles.unifiedReactionCountText, { color: myReaction ? ORANGE : themeColors.textSecondary }]}>
                        {totalCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })()}

              {/* Outgoing Status: "Seen by..." placed inside bubbleColWrap directly below message bubble */}
              {isOwn && !!seenStatusLabel && (
                <View style={[styles.readReceiptMeRow, item.reactions && item.reactions.length > 0 && { marginTop: 4 }]}>
                  <Text style={styles.readReceiptMeText}>
                    {seenStatusLabel}
                  </Text>
                </View>
              )}
            </View>

            {/* Avatar on Right for Outgoing */}
            {isOwn && (
              <View style={styles.avatarWrapperRight}>
                {!isSameSenderAsNext ? (
                  currentUserProfile?.avatar_url ? (
                    <Image source={{ uri: currentUserProfile.avatar_url, cache: 'force-cache' }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: '#1E293B' }]}>
                      <Text style={styles.avatarText}>
                        {(currentUserProfile?.username || currentUserProfile?.full_name || 'Y')[0].toUpperCase()}
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={{ width: 34 }} />
                )}
              </View>
            )}
          </View>
        </View>
      </SwipeableMessage>
    </View>
  );
}, areDiscussionMessageRowPropsEqual);

export const DiscussionRoomDetailScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const rawRoomId = route.params?.roomId || route.params?.room_id || route.params?.relatedId || route.params?.id;
  const { roomTitle, roomDescription, roomType } = route.params || {};
  const roomId = rawRoomId;
  const [currentRoomType, setCurrentRoomType] = useState<string>(roomType || 'public');
  const isPrivateRoom = currentRoomType === 'private';
  const { themeColors, isDark, triggerHaptic, settings } = useUserSettings();
  const { encryptGroupMessage, decryptGroupMessage, isReady: isE2EEReady } = useGroupEncryption('room', isPrivateRoom ? roomId : null);

  // Global Call State for seamless Call/Chat switching
  const { callState, startCall, minimizeCall, maximizeCall } = useGlobalCall();
  const isInCall = callState.isActive && callState.roomId === roomId;
  // Which tab is showing while a call is running in this room: the live call or the chat. The call keeps running
  // (audio/video never stops) whichever tab is selected.
  const [roomTab, setRoomTab] = useState<'call' | 'chat'>('call');
  const showInlineCall = isInCall && roomTab === 'call';

  // When a call starts in this room, land on the Call tab; when it ends, go back to the chat.
  const wasInCallRef = useRef(false);
  useEffect(() => {
    if (isInCall && !wasInCallRef.current) setRoomTab('call');
    wasInCallRef.current = isInCall;
  }, [isInCall]);

  // Leaving the room screen while the call is running: show the floating bubble; coming back: restore it inline.
  useFocusEffect(
    useCallback(() => {
      if (isInCallRef.current) {
        // Coming back from the full-screen call via its "Chat" button: the user wants the chat, not the call tab.
        if (callMinimizedRef.current) setRoomTab('chat');
        maximizeCall();
      }
      return () => {
        if (isInCallRef.current) minimizeCall();
      };
    }, [maximizeCall, minimizeCall])
  );

  const isInCallRef = useRef(isInCall);
  isInCallRef.current = isInCall;
  const callMinimizedRef = useRef(callState.isMinimized);
  callMinimizedRef.current = callState.isMinimized;

  /** Starts (or joins) this room's call without leaving the room: the call opens in the Call tab next to the chat. */
  const startInlineCall = useCallback(
    async (isVideo: boolean, prefer?: 'call' | 'space') => {
      if (!roomId) {
        Alert.alert('Not Ready', 'Room not loaded yet. Please try again.');
        return;
      }
      if (isInCallRef.current) {
        maximizeCall();
        setRoomTab('call');
        return;
      }
      if (callState.isActive) {
        Alert.alert('Already in a call', 'Leave your current call before starting another one.');
        return;
      }
      // Nothing is running yet: ask whether to start a call or an audio space (or just join what is running).
      const choice = await askHowToStart('discussion', roomId, prefer);
      if (!choice) return;
      const asSpace = choice.kind === 'space';
      startCall({
        roomId,
        roomType: 'discussion',
        roomName: currentRoomTitle || roomTitle || 'Discussion Room',
        isVideo: asSpace ? false : isVideo,
      });
      setRoomTab('call');
      try {
        await beginCallSession({
          roomType: 'discussion',
          roomId,
          roomName: currentRoomTitle || roomTitle || 'Discussion Room',
          isVideo: asSpace ? false : isVideo,
          mode: asSpace ? 'audio_space' : undefined,
          speakingMode: choice.kind === 'space' ? choice.speakingMode : undefined,
          startMuted: !!settings.call_mute_mic_on_join,
          videoOffOnJoin: !!settings.call_video_off_on_join,
        });
      } catch (e: any) {
        Alert.alert('Call could not start', e?.message || 'Please try again.');
      }
    },
    [roomId, roomTitle, callState.isActive, startCall, maximizeCall, settings.call_mute_mic_on_join, settings.call_video_off_on_join]
  );

  // Message rows are memoised and ignore callback identity, so hand them a stable function that always calls the
  // latest startInlineCall.
  const startInlineCallRef = useRef(startInlineCall);
  startInlineCallRef.current = startInlineCall;
  const joinCallStable = useCallback(() => {
    void startInlineCallRef.current(true);
  }, []);

  // A call or audio space somebody has already started in this room: the header offers Join instead of Start.
  const [activeRoomCall, setActiveRoomCall] = useState<{ mode: 'call' | 'audio_space' } | null>(null);
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const check = async () => {
      const r = await findActiveCall(roomId);
      if (!cancelled) setActiveRoomCall(r);
    };
    check();
    const timer = setInterval(check, 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomId, callState.isActive]);

  const decryptFallback = useCallback((raw: string) => {
    if (!raw) return '';
    if ((raw.startsWith('{') && (raw.includes('"type":"group"') || raw.includes('__e2ee_group'))) || raw.includes('__e2ee')) {
      return '🔒 Encrypted message';
    }
    return raw;
  }, []);

  const initialCached = roomId ? getCacheSync<any[]>(`room_messages_${roomId}`) : null;
  const initialUserId = getCurrentUserIdSync();
  const initialProfile = initialUserId ? getCacheSync<any>(`profile_${initialUserId}`) : null;
  const [messages, setMessages] = useState<any[]>(() => initialCached || []);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const msgChannelRef = useRef<any>(null);
  const profileCacheRef = useRef<Map<string, any>>(new Map());
  const e2eeDecryptedRef = useRef(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => !initialCached || initialCached.length === 0);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => initialUserId || null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(() => initialProfile || null);
  const [memberCount, setMemberCount] = useState(0);
  const [roomCategory, setRoomCategory] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [availableRoomsForForward, setAvailableRoomsForForward] = useState<any[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [currentRoomTitle, setCurrentRoomTitle] = useState(roomTitle || 'Discussion Room');
  const [currentRoomDesc, setCurrentRoomDesc] = useState(roomDescription || '');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ uri: string; name: string; type: string }>>([]);
  const [lightboxState, setLightboxState] = useState<{ visible: boolean; images: string[]; currentIndex: number }>({ visible: false, images: [], currentIndex: 0 });
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  const allMediaUrls = useMemo(() => {
    const urls: string[] = [];
    messages.forEach((m: any) => {
      const raw = m.media_url || m.attachment_url;
      if (raw && typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const u = typeof item === 'string' ? item : item?.url;
                if (u && (/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(u) || !u.match(/\.(mp4|mov|pdf|doc)$/i))) {
                  urls.push(u);
                }
              });
            }
          } catch {
            urls.push(trimmed);
          }
        } else if (/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(trimmed) || !trimmed.match(/\.(mp4|mov|pdf|doc)$/i)) {
          urls.push(trimmed);
        }
      }
    });
    return urls;
  }, [messages]);

  const setSelectedImageModal = useCallback((url: string) => {
    const idx = Math.max(0, allMediaUrls.indexOf(url));
    setLightboxState({
      visible: true,
      images: allMediaUrls.length > 0 ? allMediaUrls : [url],
      currentIndex: idx >= 0 ? idx : 0,
    });
  }, [allMediaUrls]);

  const handleToggleSelectMsg = useCallback((id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPressMsg = useCallback((id: string) => {
    triggerHaptic?.(25);
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [triggerHaptic]);

  const handleSwipeReply = useCallback(
    (msg: any) => {
      triggerHaptic?.(20);
      setReplyTo(msg);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    },
    [triggerHaptic]
  );

  const attachReactions = useCallback(async (fetchedMessages: any[]): Promise<any[]> => {
    if (!fetchedMessages || !fetchedMessages.length || !roomId) return fetchedMessages;
    try {
      const supabase = getSupabaseClient();
      const msgIds = fetchedMessages.map((m) => m.id);
      const { data: rxData } = await supabase
        .from('room_message_reactions' as any)
        .select('id, message_id, user_id, emoji')
        .in('message_id', msgIds);

      if (!rxData) return fetchedMessages;
      const rxMap: Record<string, any[]> = {};
      rxData.forEach((r: any) => {
        if (!rxMap[r.message_id]) rxMap[r.message_id] = [];
        rxMap[r.message_id].push(r);
      });

      return fetchedMessages.map((m) => ({
        ...m,
        reactions: rxMap[m.id] || [],
      }));
    } catch {
      return fetchedMessages;
    }
  }, [roomId]);

  // Re-reads the reactions of the messages on screen from the database (the source of truth). Used to repair the
  // local view after a failed write or a delete event that does not say which message it belonged to.
  const syncVisibleReactions = useCallback(async () => {
    const current = messagesRef.current;
    if (!current.length) return;
    const refreshed = await attachReactions(current.slice(-60));
    const byId = new Map<string, any[]>();
    refreshed.forEach((m: any) => {
      if (m.reactions) byId.set(m.id, m.reactions);
    });
    if (byId.size === 0) return;
    setMessages((prev) => prev.map((m) => (byId.has(m.id) ? { ...m, reactions: byId.get(m.id) } : m)));
  }, [attachReactions]);

  const syncVisibleReactionsRef = useRef<() => Promise<void>>();
  syncVisibleReactionsRef.current = syncVisibleReactions;

  const handleToggleReaction = useCallback(
    async (msgId: string, emoji: string) => {
      const uid = currentUserId || currentUserIdRef.current || getCurrentUserIdSync();
      if (!uid || !msgId) return;
      triggerHaptic?.(15);
      // Clear selection so reaction floating bar closes
      setSelectedMsgIds(new Set());

      // Work out the new state from what is on screen RIGHT NOW. This used to happen inside the setMessages updater
      // callback, which React runs later: the broadcast and the "insert or delete?" decision below read the
      // variables before they were set, so every tap was treated as "add" (a reaction could never be removed) and
      // an empty list was broadcast, wiping everyone else's reactions on that message.
      const targetMsg = messagesRef.current.find((m) => m.id === msgId);
      const currentReactions: any[] = targetMsg?.reactions || [];
      const existingReaction = currentReactions.find((r: any) => r.user_id === uid);
      const isTogglingOff = !!(existingReaction && existingReaction.emoji === emoji);
      const tempId = `temp-${Date.now()}`;

      const updatedReactions = isTogglingOff
        ? currentReactions.filter((r: any) => r.user_id !== uid)
        : [
            ...currentReactions.filter((r: any) => r.user_id !== uid),
            { id: tempId, user_id: uid, emoji, message_id: msgId },
          ];

      // Instant optimistic UI (one reaction per person per message)
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: updatedReactions } : m)));

      // Tell the other people in the room straight away
      try {
        msgChannelRef.current?.send({
          type: 'broadcast',
          event: 'room_reaction_toggle',
          payload: { msgId, reactions: updatedReactions },
        });
        msgChannelRef.current?.send({
          type: 'broadcast',
          event: 'reaction_update',
          payload: {
            eventType: isTogglingOff ? 'DELETE' : 'INSERT',
            message_id: msgId,
            user_id: uid,
            emoji,
            [isTogglingOff ? 'old' : 'new']: { message_id: msgId, user_id: uid, emoji },
          },
        });
      } catch { }

      try {
        const supabase = getSupabaseClient();
        const { error: delErr } = await supabase
          .from('room_message_reactions' as any)
          .delete()
          .eq('message_id', msgId)
          .eq('user_id', uid);
        if (delErr) throw delErr;

        if (!isTogglingOff) {
          const { data: inserted, error: insErr } = await supabase
            .from('room_message_reactions' as any)
            .insert({ message_id: msgId, user_id: uid, emoji })
            .select('id')
            .maybeSingle();
          if (insErr) throw insErr;
          // Swap the temporary id for the real row id, so the later realtime "delete" event can find it.
          const realId = (inserted as any)?.id;
          if (realId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, reactions: (m.reactions || []).map((r: any) => (r.id === tempId ? { ...r, id: realId } : r)) }
                  : m
              )
            );
          }
        }
      } catch (e) {
        console.warn('Toggle reaction error:', e);
        // The write failed: put the screen back in line with the database instead of showing a reaction that is not saved.
        void syncVisibleReactions();
      }
    },
    [triggerHaptic, syncVisibleReactions]
  );

  const handleForwardToRoom = async (targetRoom: any) => {
    const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
    if (!selectedList.length) return;
    setForwarding(true);
    try {
      const supabase = getSupabaseClient();
      let senderId = currentUserId;
      if (!senderId) {
        const { data: { user } } = await supabase.auth.getUser();
        senderId = user?.id || null;
      }
      if (!senderId) throw new Error('Please sign in to forward messages.');

      for (const msg of selectedList) {
        const textToForward = decryptFallback(msg.content);
        await supabase.from('room_messages' as any).insert({
          room_id: targetRoom.id,
          user_id: senderId,
          content: textToForward,
          media_url: msg.media_url || null,
          media_type: msg.media_type || null,
        });
      }
      setForwardModalVisible(false);
      setSelectedMsgIds(new Set());
      Alert.alert('Forwarded! 🚀', `Message(s) forwarded to ${targetRoom.title}.`);
    } catch (err: any) {
      Alert.alert('Forward Failed', err.message || 'Could not forward message.');
    } finally {
      setForwarding(false);
    }
  };
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('smileys');
  const [infoModalMessage, setInfoModalMessage] = useState<any | null>(null);
  const [readStatuses, setReadStatuses] = useState<any[]>([]);
  const inputRef = useRef<TextInput>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  // Active room settings (synced in real-time)
  const [roomSettings, setRoomSettings] = useState<any>(null);
  const [isRoomMuted, setIsRoomMuted] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const roomSettingsRef = useRef<any>(null);
  const currentUserProfileRef = useRef<any>(null);

  // Load Starred Messages for this room
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`@starred_msgs_${roomId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setStarredMsgIds(new Set(parsed));
          }
        }
      } catch (err) {
        console.warn('[DiscussionRoom] Failed to load starred messages:', err);
      }
    })();
  }, [roomId]);

  const saveStarredMessages = async (nextSet: Set<string>) => {
    setStarredMsgIds(nextSet);
    if (!roomId) return;
    try {
      await AsyncStorage.setItem(`@starred_msgs_${roomId}`, JSON.stringify(Array.from(nextSet)));
    } catch { }
  };

  // Load Room Mute State
  const loadRoomMuteState = useCallback(async () => {
    if (!roomId) return;
    try {
      const uId = currentUserIdRef.current || currentUserId || 'anonymous';
      const raw = await AsyncStorage.getItem(`@room_notif_${roomId}_${uId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setIsRoomMuted(Boolean(parsed.muteRoom));
      } else {
        const fallback = await AsyncStorage.getItem(`@room_notif_${roomId}`);
        if (fallback) {
          const parsed = JSON.parse(fallback);
          setIsRoomMuted(Boolean(parsed.muteRoom));
        }
      }
    } catch (err) {
      console.warn('[DiscussionRoom] Error loading mute state:', err);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoomMuteState();
  }, [loadRoomMuteState]);

  const toggleMuteRoom = async () => {
    if (!roomId) return;
    const newMuted = !isRoomMuted;
    setIsRoomMuted(newMuted);
    triggerHaptic();
    try {
      const uId = currentUserId || 'anonymous';
      let currentPrefs: any = {};
      try {
        const raw = await AsyncStorage.getItem(`@room_notif_${roomId}_${uId}`);
        if (raw) currentPrefs = JSON.parse(raw);
      } catch { }
      const payload = JSON.stringify({
        ...currentPrefs,
        muteRoom: newMuted,
      });
      await AsyncStorage.setItem(`@room_notif_${roomId}_${uId}`, payload);
      await AsyncStorage.setItem(`@room_notif_${roomId}`, payload);
      Alert.alert(
        newMuted ? 'Room Muted' : 'Room Unmuted',
        newMuted
          ? 'Push notifications for this discussion room have been silenced.'
          : 'You will now receive push notifications from this room.'
      );
    } catch (err) {
      console.warn('[DiscussionRoom] Error saving mute state:', err);
    }
  };

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    roomSettingsRef.current = roomSettings;
  }, [roomSettings]);

  useEffect(() => {
    currentUserProfileRef.current = currentUserProfile;
  }, [currentUserProfile]);

  // Slow mode state
  const [slowModeCooldown, setSlowModeCooldown] = useState(0);
  const slowModeTimerRef = useRef<any>(null);
  // Admin role state (based on room_members)
  const [isAdmin, setIsAdmin] = useState(false);

  // Derived permission checks based on roomSettings
  const isSendRestrictedToAdmins = roomSettings?.onlyAdminsSend === true || roomSettings?.onlyAdminsSend === 'admins';
  const canSendMessages = !isSendRestrictedToAdmins || isAdmin;
  const canShareMedia = roomSettings?.allowMediaSharing !== false;
  const canShareLinks = roomSettings?.allowLinks !== false;

  const flatRef = useRef<FlashList<any>>(null);
  const shouldScrollToEndRef = useRef<boolean>(true);

  // Fast O(1) message lookup map for reply references
  const messageMap = useMemo(() => {
    const map = new Map<string, any>();
    (messages || []).forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    return map;
  }, [messages]);
  const messageMapRef = useRef(messageMap);
  messageMapRef.current = messageMap;

  // Auto-scroll to bottom only when a genuinely new message arrives
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current && messages.length > 0) {
      const timer = setTimeout(() => {
        flatRef.current?.scrollToEnd({ animated: true });
      }, 250);
      prevMsgCountRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  const fetchMessages = useCallback(async (force = false) => {
    if (!roomId) return;
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 3000) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    // Fast check for L2 AsyncStorage cache if memory was empty
    const cached = await getCache<any[]>(`room_messages_${roomId}`);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    }

    try {
      const supabase = getSupabaseClient();
      // Fetch the 15 most recent messages (descending), reverse to chronological
      const { data } = await supabase
        .from('room_messages' as any)
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_url,
            craft
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (data) {
        const chronological = [...data].reverse();
        setHasMoreOlder(data.length === 15);
        const decrypted = await Promise.all(
          chronological.map(async (m: any) => {
            if (m.user_id && m.profiles) {
              const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              if (prof) profileCacheRef.current.set(m.user_id, prof);
            }
            m.rawContent = m.content;
            const isEncryptedPayload = m.content && ((m.content.startsWith('{') && m.content.includes('"type":"group"')) || m.content.includes('__e2ee_group') || m.content.includes('__e2ee'));
            if (isPrivateRoom && isEncryptedPayload) {
              m.content = await decryptGroupMessage(m.content);
            }
            return m;
          })
        );
        // Paint the messages first; reactions are a separate round trip and are merged in when they arrive.
        const reactionsPromise = attachReactions(decrypted).catch(() => null);
        // Painting the fetched messages must not wipe reactions that are already on screen (they would vanish and
        // pop back a moment later): carry over what we know until the fresh ones arrive.
        const knownReactions = new Map<string, any[]>();
        messagesRef.current.forEach((m: any) => m?.reactions?.length && knownReactions.set(m.id, m.reactions));
        const painted = decrypted.map((m: any) => (m.reactions ? m : { ...m, reactions: knownReactions.get(m.id) || [] }));
        setMessages(painted);
        setLoading(false);
        saveCache(`room_messages_${roomId}`, decrypted).catch(() => { });
        reactionsPromise.then((withReactions) => {
          if (!withReactions) return;
          const byId = new Map<string, any[]>();
          withReactions.forEach((m: any) => { if (m.reactions) byId.set(m.id, m.reactions); });
          setMessages((prev) => {
            const next = prev.map((m: any) => (byId.has(m.id) ? { ...m, reactions: byId.get(m.id) } : m));
            saveCache(`room_messages_${roomId}`, next).catch(() => { });
            return next;
          });
        });
      }
    } catch (e) {
      console.warn('[DiscussionRoom] Fetch messages error:', e);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [roomId, attachReactions, decryptGroupMessage, isPrivateRoom]);

  const fetchReadStatuses = useCallback(async () => {
    if (!roomId) return;
    try {
      const supabase = getSupabaseClient();
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
            const finalProf = prof || profMap[rs.user_id] || null;
            if (finalProf && rs.user_id) profileCacheRef.current.set(rs.user_id, finalProf);
            return {
              ...rs,
              profiles: finalProf,
            };
          });
          setReadStatuses(merged);
          return;
        }

        const normalized = data.map((rs: any) => {
          const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
          if (prof && rs.user_id) profileCacheRef.current.set(rs.user_id, prof);
          return {
            ...rs,
            profiles: prof,
          };
        });
        setReadStatuses(normalized);
      } else if (data) {
        setReadStatuses(data);
      }
    } catch (err) {
      console.warn('Error fetching discussion room read statuses:', err);
    }
  }, [roomId]);

  const markAsRead = useCallback(
    async (explicitUid?: string) => {
      if (!roomId) return;
      const uid = explicitUid || currentUserIdRef.current || currentUserId || getCurrentUserIdSync();
      if (!uid) return;
      try {
        const supabase = getSupabaseClient();
        const nowIso = new Date().toISOString();

        // Optimistically update local readStatuses
        setReadStatuses((prev) => {
          const existingIdx = prev.findIndex((rs) => rs.user_id === uid);
          const myProfile = currentUserProfileRef.current || currentUserProfile;
          const newEntry = {
            room_id: roomId,
            user_id: uid,
            last_read_at: nowIso,
            profiles: myProfile,
          };
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx] = {
              ...copy[existingIdx],
              last_read_at: nowIso,
              profiles: copy[existingIdx].profiles || myProfile,
            };
            return copy;
          }
          return [...prev, newEntry];
        });

        await supabase
          .from('room_message_read_status' as any)
          .upsert(
            {
              room_id: roomId,
              user_id: uid,
              last_read_at: nowIso,
            },
            { onConflict: 'room_id,user_id' }
          );

        // Broadcast read update so Web and other clients update seen status in real time
        try {
          msgChannelRef.current?.send({
            type: 'broadcast',
            event: 'read_update',
            payload: {
              userId: uid,
              user_id: uid,
              last_read_at: nowIso,
              profile: currentUserProfileRef.current || currentUserProfile,
            },
          });
        } catch { }
      } catch {
        // Ignore
      }
    },
    [roomId, currentUserId, currentUserProfile]
  );

  const readStatusDebounceTimerRef = useRef<any>(null);
  const debouncedFetchReadStatuses = useCallback(() => {
    if (readStatusDebounceTimerRef.current) clearTimeout(readStatusDebounceTimerRef.current);
    readStatusDebounceTimerRef.current = setTimeout(() => {
      fetchReadStatuses();
    }, 100);
  }, [fetchReadStatuses]);

  const markAsReadDebounceTimerRef = useRef<any>(null);
  const debouncedMarkAsRead = useCallback((explicitUid?: string) => {
    if (markAsReadDebounceTimerRef.current) clearTimeout(markAsReadDebounceTimerRef.current);
    markAsReadDebounceTimerRef.current = setTimeout(() => {
      markAsRead(explicitUid);
    }, 100);
  }, [markAsRead]);

  useEffect(() => {
    return () => {
      if (readStatusDebounceTimerRef.current) clearTimeout(readStatusDebounceTimerRef.current);
      if (markAsReadDebounceTimerRef.current) clearTimeout(markAsReadDebounceTimerRef.current);
    };
  }, []);

  const fetchOlderMessages = useCallback(async () => {
    const currentMsgs = messagesRef.current;
    if (!roomId || loadingOlder || !hasMoreOlder || currentMsgs.length === 0) return;
    setLoadingOlder(true);
    try {
      const supabase = getSupabaseClient();
      const oldestTimestamp = currentMsgs[0].created_at;
      const { data } = await supabase
        .from('room_messages' as any)
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_url,
            craft
          )
        `)
        .eq('room_id', roomId)
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(15);

      if (data && data.length > 0) {
        const older = [...data].reverse();
        setHasMoreOlder(data.length === 15);
        const decrypted = await Promise.all(
          older.map(async (m: any) => {
            m.rawContent = m.content;
            const isEncryptedPayload = m.content && ((m.content.startsWith('{') && m.content.includes('"type":"group"')) || m.content.includes('__e2ee_group') || m.content.includes('__e2ee'));
            if (isPrivateRoom && isEncryptedPayload) {
              m.content = await decryptGroupMessage(m.content);
            }
            return m;
          })
        );
        const withReactions = await attachReactions(decrypted);
        setMessages((prev) => [...withReactions, ...prev]);
      } else {
        setHasMoreOlder(false);
      }
    } catch (e) {
      console.warn('[DiscussionRoom] Fetch older messages error:', e);
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, loadingOlder, hasMoreOlder, attachReactions, decryptGroupMessage, isPrivateRoom]);

  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  useFocusEffect(
    useCallback(() => {
      if (roomId) {
        setActiveChatContext({ screen: 'DiscussionRoomDetail', roomId });
        try {
          const { NativeModules } = require('react-native');
          NativeModules.NotificationBridge?.dismissNotification?.(`DiscussionRoomDetail_${roomId}`);
        } catch { }
      }
      return () => {
        clearActiveChatContext();
      };
    }, [roomId])
  );

  // Refresh messages and read statuses whenever returning from a call or refocusing
  useFocusEffect(
    useCallback(() => {
      if (!roomId) return;
      // Start the message fetch right away: it is network-bound, so waiting for the open animation to finish
      // (runAfterInteractions) and for getSession() only delayed the first messages.
      fetchMessages(true);
      fetchReadStatuses();
      markAsRead();
      const task = InteractionManager.runAfterInteractions(async () => {
        try {
          const supabase = getSupabaseClient();
          const { data: sessData } = await supabase.auth.getSession();
          if (sessData?.session?.access_token && (supabase.realtime as any)?.setAuth) {
            (supabase.realtime as any).setAuth(sessData.session.access_token);
          }
        } catch { }
        if (msgChannelRef.current && msgChannelRef.current.state !== 'joined') {
          try {
            msgChannelRef.current.subscribe();
          } catch { }
        }
      });
      return () => {
        task.cancel();
      };
    }, [roomId, fetchMessages, fetchReadStatuses, markAsRead])
  );

  // AppState change listener: refetch & resubscribe when returning from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && roomId) {
        try {
          const supabase = getSupabaseClient();
          const { data: sessData } = await supabase.auth.getSession();
          if (sessData?.session?.access_token && (supabase.realtime as any)?.setAuth) {
            (supabase.realtime as any).setAuth(sessData.session.access_token);
          }
        } catch { }
        fetchMessages(true);
        fetchReadStatuses();
        markAsRead();
        if (msgChannelRef.current && msgChannelRef.current.state !== 'joined') {
          try {
            msgChannelRef.current.subscribe();
          } catch { }
        }
      }
    });
    return () => sub.remove();
  }, [roomId, fetchMessages, fetchReadStatuses, markAsRead]);

  // Periodic Background Liveness Heartbeat & Delta Message Sync (every 4 seconds while screen is open)
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
      try {
        if (msgChannelRef.current && msgChannelRef.current.state !== 'joined') {
          try {
            msgChannelRef.current.subscribe();
          } catch { }
        }

        const currentMsgs = messagesRef.current;
        const confirmedMsgs = (currentMsgs || []).filter((m) => !m.isOptimistic && m.created_at);
        const lastMsg = confirmedMsgs.length > 0 ? confirmedMsgs[confirmedMsgs.length - 1] : null;

        const supabase = getSupabaseClient();
        let query = supabase
          .from('room_messages' as any)
          .select(`
            *,
            profiles:user_id (
              full_name,
              username,
              avatar_url,
              craft
            )
          `)
          .eq('room_id', roomId);

        if (lastMsg?.created_at) {
          query = query.gt('created_at', lastMsg.created_at).order('created_at', { ascending: true }).limit(25);
        } else {
          query = query.order('created_at', { ascending: false }).limit(20);
        }

        const { data: newMsgs } = await query;

        if (newMsgs && newMsgs.length > 0) {
          const chronological = lastMsg?.created_at ? newMsgs : [...newMsgs].reverse();
          const decrypted = await Promise.all(
            chronological.map(async (m: any) => {
              m.rawContent = m.content;
              const isEncryptedPayload = m.content && ((m.content.startsWith('{') && m.content.includes('"type":"group"')) || m.content.includes('__e2ee_group') || m.content.includes('__e2ee'));
              if (isPrivateRoom && isEncryptedPayload && decryptGroupMessageRef.current) {
                try {
                  m.content = await Promise.race([
                    decryptGroupMessageRef.current(m.content),
                    new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
                  ]);
                } catch {
                  m.content = decryptFallback(m.content);
                }
              }
              return m;
            })
          );
          const withReactions = await attachReactions(decrypted);
          setMessages((prev) => {
            const currentMap = new Map(prev.map((m) => [m.id, m]));
            const updated = [...prev];
            let changed = false;

            withReactions.forEach((newM) => {
              const optIdx = updated.findIndex(
                (m) =>
                  (m.isOptimistic || (typeof m.id === 'string' && m.id.startsWith('temp-')) || m.status === 'pending') &&
                  m.user_id === newM.user_id &&
                  ((typeof m.id === 'string' && m.id.startsWith('temp-')) || m.content === newM.content || m.rawContent === newM.content)
              );
              if (optIdx >= 0) {
                updated[optIdx] = newM;
                changed = true;
              } else {
                const isDup = updated.some(
                  (m) =>
                    m.id === newM.id ||
                    (m.user_id === newM.user_id &&
                      !String(m.id).startsWith('temp-') &&
                      (m.content === newM.content || m.rawContent === newM.content) &&
                      Math.abs(new Date(m.created_at).getTime() - new Date(newM.created_at).getTime()) < 4000)
                );
                if (!isDup) {
                  updated.push(newM);
                  changed = true;
                }
              }
            });

            if (!changed) return prev;
            if (roomId) saveCache(`room_messages_${roomId}`, updated).catch(() => { });
            return updated;
          });
        }
      } catch { }
    }, 4000);

    return () => clearInterval(interval);
  }, [roomId, isPrivateRoom, decryptFallback, attachReactions]);

  // Re-decrypt messages when E2EE keys become ready
  useEffect(() => {
    if (!isPrivateRoom || !isE2EEReady || e2eeDecryptedRef.current) return;
    const redecrypt = async () => {
      const currentMsgs = messagesRef.current;
      if (!currentMsgs.length) return;
      const needsDecryption = currentMsgs.some(
        (m) =>
        ((m.rawContent &&
          ((m.rawContent.startsWith('{') && m.rawContent.includes('"type":"group"')) || m.rawContent.includes('__e2ee_group') || m.rawContent.includes('__e2ee')) &&
          (m.content === m.rawContent ||
            m.content.startsWith('🔒') ||
            m.content.includes('Unable') ||
            m.content.includes('loading') ||
            m.content.includes('view in web app'))) ||
          // Also handle messages that were never rawContent-assigned but are still encrypted
          (m.content &&
            ((m.content.startsWith('{') && m.content.includes('"type":"group"')) || m.content.includes('__e2ee_group') || m.content.includes('__e2ee'))))
      );
      if (needsDecryption) {
        const decrypted = await Promise.all(
          currentMsgs.map(async (m: any) => {
            const srcContent = m.rawContent || m.content;
            if (srcContent && ((srcContent.startsWith('{') && srcContent.includes('"type":"group"')) || srcContent.includes('__e2ee_group') || srcContent.includes('__e2ee'))) {
              const dec = await decryptGroupMessage(srcContent);
              return { ...m, rawContent: srcContent, content: dec };
            }
            return m;
          })
        );
        setMessages(decrypted);
        saveCache(`room_messages_${roomId}`, decrypted).catch(() => { });
        // Only mark done after successful decryption
        e2eeDecryptedRef.current = true;
      }
      // If no decryption needed yet (keys may not be ready), do NOT mark done
      // so we retry when isE2EEReady transitions again
    };
    redecrypt();
  }, [isE2EEReady, decryptGroupMessage, roomId]);

  // Stable refs for callbacks inside real-time subscription
  const debouncedMarkAsReadRef = useRef(debouncedMarkAsRead);
  debouncedMarkAsReadRef.current = debouncedMarkAsRead;
  const debouncedFetchReadStatusesRef = useRef(debouncedFetchReadStatuses);
  debouncedFetchReadStatusesRef.current = debouncedFetchReadStatuses;
  const decryptGroupMessageRef = useRef(decryptGroupMessage);
  decryptGroupMessageRef.current = decryptGroupMessage;
  const triggerHapticRef = useRef(triggerHaptic);
  triggerHapticRef.current = triggerHaptic;

  // 1. Room metadata, membership & admin status initialization (runs strictly once per roomId)
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;

    const initRoom = async () => {
      const supabase = getSupabaseClient();
      let userId = currentUserIdRef.current || getCurrentUserIdSync();
      if (!userId) {
        const { data: sessData } = await supabase.auth.getSession();
        userId = sessData?.session?.user?.id || null;
      }
      if (!userId) {
        userId = await resolveCurrentUserId();
      }
      if (isCancelled) return;

      if (userId) {
        currentUserIdRef.current = userId;
        setCurrentUserId(userId);
        markAsRead(userId);
        fetchReadStatuses();
        const cachedProf = await getCache<any>(`profile_${userId}`);
        if (cachedProf && !isCancelled) {
          currentUserProfileRef.current = cachedProf;
          setCurrentUserProfile(cachedProf);
        }

        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, username, avatar_url')
            .eq('id', userId)
            .single();
          if (prof && !isCancelled) {
            currentUserProfileRef.current = prof;
            setCurrentUserProfile(prof);
          }
        } catch {
          // Offline fallback
        }
      }

      // Count members and get room metadata + settings
      try {
        const { count } = await supabase
          .from('room_members' as any)
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId);
        if (count !== null && count !== undefined && !isCancelled) setMemberCount(count);

        const { data: roomData } = (await supabase
          .from('discussion_rooms' as any)
          .select('*, room_categories(name)')
          .eq('id', roomId)
          .single()) as any;
        if (roomData?.room_type && !isCancelled) {
          setCurrentRoomType(roomData.room_type);
        }
        if (roomData?.room_categories?.name && !isCancelled) {
          setRoomCategory(roomData.room_categories.name);
        }
        if (roomData?.settings && !isCancelled) {
          roomSettingsRef.current = roomData.settings;
          setRoomSettings(roomData.settings);
        }

        // Auto-enroll user into room_members if they are not already a member
        if (userId) {
          let memberRow: any = null;
          const { data: existingRow } = await supabase
            .from('room_members' as any)
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .maybeSingle();

          memberRow = existingRow;

          if (!memberRow) {
            const { error: joinErr } = await supabase
              .from('room_members' as any)
              .insert({ room_id: roomId, user_id: userId, role: 'member' });
            if (!joinErr) {
              memberRow = { role: 'member' };
            }
          }

          const isCreator = roomData?.creator_id === userId || roomData?.created_by === userId;
          if (!isCancelled) {
            setIsAdmin(isCreator || memberRow?.role === 'admin');
          }
        }
      } catch (e) {
        console.warn('[DiscussionRoom] initRoom error:', e);
      }
    };

    initRoom();

    return () => {
      isCancelled = true;
    };
  }, [roomId, markAsRead, fetchReadStatuses]);

  // 2. Real-time message, reaction, read status & settings subscription (runs strictly once per roomId)
  useEffect(() => {
    if (!roomId) return;

    let isCleanedUp = false;
    const supabase = getSupabaseClient();
    const channelName = `discussion-room-msgs:${roomId}`;

    // Clean up any stale or lingering channels for this topic to avoid reused closed/unhooked instances
    const existingChannels = supabase.getChannels().filter(
      (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );
    existingChannels.forEach((c) => {
      try {
        c.unsubscribe();
        supabase.removeChannel(c);
      } catch { }
    });

    // Ensure Realtime client carries user JWT authentication for Postgres RLS evaluation
    supabase.auth.getSession().then(({ data: sessData }) => {
      const token = sessData?.session?.access_token;
      if (token && (supabase.realtime as any)?.setAuth) {
        try {
          (supabase.realtime as any).setAuth(token);
        } catch { }
      }
    }).catch(() => { });

    const msgChannel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: currentUserIdRef.current || 'user' },
      },
    });
    msgChannelRef.current = msgChannel;

    const handleIncomingMessage = async (newMsg: any) => {
      if (!newMsg?.id || isCleanedUp) return;

      const myUid = currentUserIdRef.current;
      const isOwnMsg = Boolean(myUid && newMsg.user_id === myUid);

      let profile = isOwnMsg
        ? currentUserProfileRef.current
        : (newMsg.profiles || profileCacheRef.current.get(newMsg.user_id));

      const isEncryptedPayload = Boolean(
        newMsg.content &&
        ((newMsg.content.startsWith('{') && newMsg.content.includes('"type":"group"')) ||
          newMsg.content.includes('__e2ee_group') ||
          newMsg.content.includes('__e2ee'))
      );

      let finalContent = newMsg.content;
      if (isEncryptedPayload) {
        try {
          if (decryptGroupMessageRef.current) {
            finalContent = await Promise.race([
              decryptGroupMessageRef.current(newMsg.content),
              new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1200)),
            ]);
          } else {
            finalContent = decryptFallback(newMsg.content);
          }
        } catch {
          finalContent = decryptFallback(newMsg.content);
        }
      }

      const enriched = {
        ...newMsg,
        rawContent: newMsg.content,
        content: finalContent,
        profiles: profile || null,
        reactions: newMsg.reactions || [],
      };

      setMessages((prev) => {
        // 1. If already exists with authoritative ID, update in place
        const existingIdx = prev.findIndex((m) => m.id === newMsg.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...enriched };
          return updated;
        }

        const isIncomingTemp = typeof newMsg.id === 'string' && newMsg.id.startsWith('temp-');

        // 2. If the incoming message is a temp broadcast message, check if we ALREADY have the real message
        if (isIncomingTemp) {
          const hasRealAlready = prev.some(
            (m) =>
              m.user_id === newMsg.user_id &&
              typeof m.id === 'string' &&
              !m.id.startsWith('temp-') &&
              (m.content === finalContent || m.rawContent === newMsg.content || (newMsg.media_url && m.media_url === newMsg.media_url)) &&
              Math.abs(new Date(m.created_at || Date.now()).getTime() - new Date(newMsg.created_at || Date.now()).getTime()) < 15000
          );
          if (hasRealAlready) {
            return prev;
          }
        }

        // 3. Find if we have an existing optimistic or temp message from this sender that matches content or media
        const tempIdx = prev.findIndex(
          (m) =>
            m.user_id === newMsg.user_id &&
            (m.isOptimistic || (typeof m.id === 'string' && m.id.startsWith('temp-')) || m.status === 'pending') &&
            ((typeof m.id === 'string' && m.id.startsWith('temp-')) ||
              m.content === finalContent ||
              m.rawContent === newMsg.content ||
              m.content === newMsg.content ||
              (newMsg.media_url && m.media_url === newMsg.media_url))
        );

        if (tempIdx >= 0) {
          const updated = [...prev];
          updated[tempIdx] = enriched;
          if (roomId) saveCache(`room_messages_${roomId}`, updated).catch(() => { });
          return updated;
        }

        // 4. Duplicate check: if a non-temp message from this user with identical content/media already exists within 5 seconds, ignore
        const isDuplicate = prev.some(
          (m) =>
            m.id === newMsg.id ||
            (m.user_id === newMsg.user_id &&
              typeof m.id === 'string' &&
              !m.id.startsWith('temp-') &&
              !isIncomingTemp &&
              (m.content === finalContent || m.rawContent === newMsg.content) &&
              Math.abs(new Date(m.created_at || Date.now()).getTime() - new Date(newMsg.created_at || Date.now()).getTime()) < 5000)
        );
        if (isDuplicate) {
          return prev;
        }

        const next = [...prev, enriched];
        if (roomId) saveCache(`room_messages_${roomId}`, next).catch(() => { });
        return next;
      });

      // Background profile resolution if profile is not attached
      if (!profile && !isOwnMsg && newMsg.user_id) {
        (async () => {
          try {
            const { data: fetchedProfile } = await supabase
              .from('profiles')
              .select('full_name, username, avatar_url, craft')
              .eq('id', newMsg.user_id)
              .maybeSingle();
            if (fetchedProfile && !isCleanedUp) {
              profileCacheRef.current.set(newMsg.user_id, fetchedProfile);
              setMessages((prev) =>
                prev.map((m) => (m.user_id === newMsg.user_id && !m.profiles ? { ...m, profiles: fetchedProfile } : m))
              );
            }
          } catch { }
        })();
      }

      debouncedMarkAsReadRef.current?.();
      debouncedFetchReadStatusesRef.current?.();

      if (myUid && newMsg.user_id !== myUid) {
        triggerHapticRef.current?.(30);
      }

      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleIncomingReaction = (payload: any) => {
      if (isCleanedUp) return;
      const reaction = payload?.new || payload?.old || payload;
      if (!reaction) return;
      const msgId = reaction.message_id;
      if (!msgId) return;

      const isDelete = payload?.eventType === 'DELETE' || (!payload?.new && payload?.old);

      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.id !== msgId) return m;
          changed = true;
          const currentReactions: any[] = m.reactions || [];
          if (isDelete) {
            const filtered = currentReactions.filter((r: any) => {
              if (reaction.id && r.id === reaction.id) return false;
              if (reaction.user_id && r.user_id === reaction.user_id) return false;
              return true;
            });
            return { ...m, reactions: filtered };
          } else {
            const filtered = currentReactions.filter((r: any) => r.user_id !== reaction.user_id);
            filtered.push({
              id: reaction.id || `temp-${Date.now()}`,
              message_id: msgId,
              user_id: reaction.user_id,
              emoji: reaction.emoji,
              user_profile: reaction.user_profile || profileCacheRef.current.get(reaction.user_id),
            });
            return { ...m, reactions: filtered };
          }
        });
        return changed ? next : prev;
      });
    };

    msgChannel
      // Postgres changes: INSERT, UPDATE, DELETE on room_messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          handleIncomingMessage(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const updatedMsg = payload.new as any;
          if (!updatedMsg?.id) return;
          const isEncryptedPayload = Boolean(
            updatedMsg.content &&
            ((updatedMsg.content.startsWith('{') && updatedMsg.content.includes('"type":"group"')) ||
              updatedMsg.content.includes('__e2ee_group') ||
              updatedMsg.content.includes('__e2ee'))
          );
          let finalContent = updatedMsg.content;
          if (isEncryptedPayload) {
            try {
              if (decryptGroupMessageRef.current) {
                finalContent = await Promise.race([
                  decryptGroupMessageRef.current(updatedMsg.content),
                  new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1200)),
                ]);
              } else {
                finalContent = decryptFallback(updatedMsg.content);
              }
            } catch {
              finalContent = decryptFallback(updatedMsg.content);
            }
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMsg.id
                ? {
                  ...m,
                  ...updatedMsg,
                  rawContent: updatedMsg.content,
                  content: finalContent,
                }
                : m
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const next = prev.filter((m) => m.id !== payload.old.id);
            if (roomId) saveCache(`room_messages_${roomId}`, next).catch(() => { });
            return next;
          });
        }
      )
      // Broadcast events from Web and Mobile
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload?.payload;
        if (!msg) return;
        const myUid = currentUserIdRef.current;
        if (myUid && msg.user_id === myUid) return;
        handleIncomingMessage(msg);
      })
      .on('broadcast', { event: 'new_room_message' }, (payload) => {
        const msg = payload?.payload;
        if (!msg) return;
        const myUid = currentUserIdRef.current;
        if (myUid && msg.user_id === myUid) return;
        handleIncomingMessage(msg);
      })
      .on('broadcast', { event: 'reaction_update' }, (payload) => {
        if (payload?.payload) handleIncomingReaction(payload.payload);
      })
      .on('broadcast', { event: 'room_reaction_toggle' }, (payload) => {
        const data = payload?.payload || payload || {};
        const msgId = data.msgId || data.messageId;
        const reactions = data.reactions;
        if (!msgId || !reactions) return;
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions } : m)));
      })
      .on('broadcast', { event: 'read_update' }, (payload) => {
        const data = payload?.payload || payload || {};
        const readUid = data.userId || data.user_id;
        const readTime = data.last_read_at || data.lastReadAt || new Date().toISOString();

        if (readUid && readUid !== (currentUserIdRef.current || currentUserId)) {
          if (data.profile) {
            profileCacheRef.current.set(readUid, data.profile);
          }
          setReadStatuses((prev) => {
            const existingIdx = prev.findIndex((rs) => rs.user_id === readUid);
            const cachedProf =
              data.profile ||
              profileCacheRef.current.get(readUid) ||
              (existingIdx >= 0 ? prev[existingIdx].profiles : null) ||
              messagesRef.current.find((m) => m.user_id === readUid && m.profiles)?.profiles;

            if (existingIdx >= 0) {
              const copy = [...prev];
              copy[existingIdx] = {
                ...copy[existingIdx],
                last_read_at: readTime,
                profiles: copy[existingIdx].profiles || cachedProf || null,
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
        debouncedFetchReadStatusesRef.current?.();
      })
      .on('broadcast', { event: 'history_cleared' }, () => {
        setMessages([]);
        if (roomId) saveCache(`room_messages_${roomId}`, []).catch(() => { });
      })
      .on('broadcast', { event: 'room_settings_update' }, (payload) => {
        const updated = payload.payload;
        if (updated) {
          if (updated.title) setCurrentRoomTitle(updated.title);
          if (updated.description !== undefined) setCurrentRoomDesc(updated.description || '');
          if (updated.settings) {
            roomSettingsRef.current = updated.settings;
            setRoomSettings(updated.settings);
          }
        }
      })
      // Postgres changes: room_message_reactions
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_message_reactions',
        },
        async (payload) => {
          let msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
          if (!msgId && (payload.old as any)?.id) {
            const matchingMsg = messagesRef.current.find((m) =>
              m.reactions?.some((r: any) => r.id === (payload.old as any).id)
            );
            if (matchingMsg) msgId = matchingMsg.id;
          }
          if (!msgId) {
            // A removed reaction whose row we do not recognise (e.g. another person's, or ours after a restart):
            // the event does not say which message it was on, so re-read the visible reactions.
            if ((payload as any).eventType === 'DELETE') void syncVisibleReactionsRef.current?.();
            return;
          }
          if (!messagesRef.current.some((m) => m.id === msgId)) return;

          handleIncomingReaction(payload);

          // Authoritative DB sync
          try {
            const { data: freshRx } = await supabase
              .from('room_message_reactions' as any)
              .select('id, message_id, user_id, emoji')
              .eq('message_id', msgId);

            if (freshRx) {
              setMessages((prev) =>
                prev.map((m) => (m.id === msgId ? { ...m, reactions: freshRx } : m))
              );
            }
          } catch { }
        }
      )
      // Postgres changes: room_message_read_status
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_message_read_status',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newRow = payload?.new as any;
          if (newRow && newRow.user_id && newRow.user_id !== (currentUserIdRef.current || currentUserId)) {
            setReadStatuses((prev) => {
              const existingIdx = prev.findIndex((rs) => rs.user_id === newRow.user_id);
              const cachedProf =
                profileCacheRef.current.get(newRow.user_id) ||
                (existingIdx >= 0 ? prev[existingIdx].profiles : null) ||
                messagesRef.current.find((m) => m.user_id === newRow.user_id && m.profiles)?.profiles;

              if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = {
                  ...copy[existingIdx],
                  last_read_at: newRow.last_read_at,
                  profiles: copy[existingIdx].profiles || cachedProf || null,
                };
                return copy;
              }
              return [
                ...prev,
                {
                  room_id: roomId,
                  user_id: newRow.user_id,
                  last_read_at: newRow.last_read_at,
                  profiles: cachedProf || null,
                },
              ];
            });
          }
          debouncedFetchReadStatusesRef.current?.();
        }
      )
      // Postgres changes: discussion_rooms
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'discussion_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.title) setCurrentRoomTitle(updated.title);
          if (updated.description !== undefined) setCurrentRoomDesc(updated.description || '');
          if (updated.settings) {
            roomSettingsRef.current = updated.settings;
            setRoomSettings(updated.settings);
          }
        }
      )
      // Postgres changes: room_members
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const uid = currentUserIdRef.current;
          if (uid && roomId) {
            const { data: memberRow } = await supabase
              .from('room_members' as any)
              .select('role')
              .eq('room_id', roomId)
              .eq('user_id', uid)
              .maybeSingle();
            const { data: roomData } = await supabase
              .from('discussion_rooms' as any)
              .select('creator_id, created_by')
              .eq('id', roomId)
              .maybeSingle();
            const isCreator = (roomData as any)?.creator_id === uid || (roomData as any)?.created_by === uid;
            setIsAdmin(isCreator || (memberRow as any)?.role === 'admin');
          }
        }
      )
      // Typing presence
      .on('presence', { event: 'sync' }, () => {
        const state = msgChannel.presenceState();
        const names = Object.values(state)
          .flat()
          .map((p: any) => p.name)
          .filter(Boolean);
        setTypingUsers(names);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[DiscussionRoom] Connected to room channel: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[DiscussionRoom] Channel status: ${status}`, err);
        }
      });

    return () => {
      isCleanedUp = true;
      try {
        msgChannel.unsubscribe();
        supabase.removeChannel(msgChannel);
      } catch { }
    };
  }, [roomId, decryptFallback]);

  const handlePickDocument = async () => {
    try {
      const res = await pickAttachments();
      if (res && res.length > 0) {
        const newFiles = res.map((file) => {
          const isVid = Boolean(file.name?.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/i) || file.type?.startsWith('video/'));
          const isImg = Boolean(file.name?.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || file.type?.startsWith('image/'));
          return {
            uri: file.uri,
            name: file.name || `file_${Date.now()}`,
            type: file.type || (isVid ? 'video/mp4' : isImg ? 'image/jpeg' : 'application/octet-stream'),
          };
        });
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        console.warn('Document picker error:', e);
      }
    }
  };

  const uploadMediaFile = async (file: { uri: string; name: string; type: string }): Promise<string | null> => {
    try {
      const uploaded = await uploadMediaPipeline(
        file,
        {
          bucket: 'post-media',
          folder: `discussion-media/${roomId}`,
        }
      );
      return uploaded.url;
    } catch (e) {
      console.warn('[DiscussionRoom] Upload media error:', e);
      return null;
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || !roomId) return;
    shouldScrollToEndRef.current = true;

    // Enforce onlyAdminsSend
    if (!canSendMessages) {
      Alert.alert('Restricted', 'Only admins can send messages in this room.');
      return;
    }

    // Enforce allowLinks
    if (!canShareLinks && containsURL(inputText)) {
      Alert.alert('Links Blocked', 'Sharing links is not allowed in this room.');
      return;
    }

    // Enforce allowMediaSharing
    if (!canShareMedia && attachedFiles.length > 0) {
      Alert.alert('Media Blocked', 'Media sharing is disabled in this room.');
      setAttachedFiles([]);
      return;
    }

    // Enforce slowMode
    if (roomSettings?.slowMode && !isAdmin && slowModeCooldown > 0) {
      Alert.alert('Slow Mode', `Please wait ${slowModeCooldown}s before sending another message.`);
      return;
    }

    let text = inputText.trim();

    // Apply profanity filter
    if (roomSettings?.profanityFilter && text) {
      text = applyProfanityFilter(text);
    }

    const currFiles = [...attachedFiles];
    const currReplyTo = replyTo;

    // Immediately clear inputs for zero-lag UI response
    setInputText('');
    setAttachedFiles([]);
    setReplyTo(null);

    // Start slow mode cooldown
    if (roomSettings?.slowMode && !isAdmin && roomSettings?.slowModeInterval) {
      setSlowModeCooldown(roomSettings.slowModeInterval);
      if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current);
      slowModeTimerRef.current = setInterval(() => {
        setSlowModeCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(slowModeTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    const uid = currentUserId || currentUserIdRef.current || getCurrentUserIdSync();
    const myProfile = currentUserProfile || currentUserProfileRef.current;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (text) {
      const optimisticMsg = {
        id: tempId,
        room_id: roomId,
        user_id: uid,
        content: text,
        rawContent: text,
        media_url: null,
        media_type: 'text',
        reply_to_id: currReplyTo?.id || null,
        created_at: new Date().toISOString(),
        profiles: myProfile,
        reactions: [],
        isOptimistic: true,
      };

      setMessages((prev) => {
        const next = [...prev, optimisticMsg];
        if (roomId) saveCache(`room_messages_${roomId}`, next).catch(() => { });
        return next;
      });

      triggerHaptic?.(35);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    }

    (async () => {
      try {
        if (currFiles.length > 0) {
          setSending(true);
          const uploadedList: Array<{ url: string; type: string }> = [];

          for (const file of currFiles) {
            const mediaUrl = await uploadMediaFile(file);
            if (mediaUrl) {
              const isVid = Boolean(file.type?.startsWith('video/') || file.name?.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/i));
              const isImg = Boolean(file.type?.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i));
              const mediaType = isVid ? 'video' : isImg ? 'image' : 'file';
              uploadedList.push({ url: mediaUrl, type: mediaType });
            }
          }

          if (uploadedList.length > 0) {
            const allImages = uploadedList.every((u) => u.type === 'image');
            const allVideos = uploadedList.every((u) => u.type === 'video');
            const finalType = uploadedList.length === 1
              ? uploadedList[0].type
              : (allImages ? 'image' : 'multi_media');

            const finalUrl = uploadedList.length === 1
              ? uploadedList[0].url
              : JSON.stringify(uploadedList.map((u) => u.url));

            const defaultContent = uploadedList.length > 1
              ? `Shared ${uploadedList.length} photos`
              : allImages
                ? 'Shared an image'
                : allVideos
                  ? 'Shared a video'
                  : 'Shared an attachment';

            const supabase = getSupabaseClient();
            const { data: insertedMedia } = await supabase.from('room_messages' as any).insert({
              room_id: roomId,
              user_id: uid,
              content: defaultContent,
              media_url: finalUrl,
              media_type: finalType,
              reply_to_id: currReplyTo?.id || null,
            }).select().single() as any;

            if (insertedMedia) {
              const mediaRecord = insertedMedia as any;
              setMessages((prev) => {
                const enriched = {
                  ...mediaRecord,
                  rawContent: defaultContent,
                  content: defaultContent,
                  profiles: myProfile,
                  reactions: [],
                };
                const tempIdx = prev.findIndex(
                  (m) => m.isOptimistic && m.user_id === uid && m.media_url === finalUrl
                );
                if (tempIdx >= 0) {
                  const updated = [...prev];
                  updated[tempIdx] = enriched;
                  if (roomId) saveCache(`room_messages_${roomId}`, updated).catch(() => { });
                  return updated;
                }
                if (!prev.some((m) => m.id === mediaRecord.id)) {
                  const next = [...prev, enriched];
                  if (roomId) saveCache(`room_messages_${roomId}`, next).catch(() => { });
                  return next;
                }
                return prev;
              });

              try {
                const payload = Object.assign({}, mediaRecord, { profiles: myProfile });
                msgChannelRef.current?.send({
                  type: 'broadcast',
                  event: 'new_room_message',
                  payload,
                });
              } catch { }
            }
          }
          setSending(false);
        }

        if (text) {
          let encryptedText = text;
          try {
            if (text && isPrivateRoom) {
              encryptedText = await encryptGroupMessage(text);
            }
          } catch (err) {
            console.warn('E2EE encryption failed:', err);
          }

          const supabase = getSupabaseClient();
          const { data: insertedMsg } = await supabase.from('room_messages' as any).insert({
            room_id: roomId,
            user_id: uid,
            content: encryptedText,
            media_url: null,
            media_type: 'text',
            reply_to_id: currReplyTo?.id || null,
          }).select().single() as any;

          if (insertedMsg) {
            const msgRecord = insertedMsg as any;
            setMessages((prev) => {
              const enriched = {
                ...msgRecord,
                rawContent: text,
                content: text,
                profiles: myProfile,
                reactions: [],
              };
              const tempIdx = prev.findIndex(
                (m) =>
                  (m.isOptimistic || (typeof m.id === 'string' && m.id.startsWith('temp-'))) &&
                  m.user_id === uid &&
                  (m.id === tempId || m.content === text || m.rawContent === text)
              );
              if (tempIdx >= 0) {
                const updated = [...prev];
                updated[tempIdx] = enriched;
                if (roomId) saveCache(`room_messages_${roomId}`, updated).catch(() => { });
                return updated;
              }
              if (!prev.some((m) => m.id === msgRecord.id)) {
                const next = [...prev, enriched];
                if (roomId) saveCache(`room_messages_${roomId}`, next).catch(() => { });
                return next;
              }
              return prev;
            });

            try {
              const payload = Object.assign({}, msgRecord, { content: text, profiles: myProfile });
              msgChannelRef.current?.send({
                type: 'broadcast',
                event: 'new_room_message',
                payload,
              });
            } catch { }
          }
        }
      } catch (e: any) {
        console.warn('Send message error:', e);
      } finally {
        setSending(false);
      }
    })();


  };

  const handleDeleteMessage = async (msgId: string, userId: string) => {
    if (userId !== currentUserId && !isAdmin) {
      Alert.alert('Permission denied', 'You can only delete your own messages.');
      return;
    }
    Alert.alert('Delete Message', 'This message will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            await supabase.from('room_messages' as any).update({ reply_to_id: null }).eq('reply_to_id', msgId);
            await supabase.from('room_messages' as any).delete().eq('id', msgId);
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Delete failed.');
          }
        },
      },
    ]);
  };



  // Memoized user activity map: computes the latest timestamp each other user was active
  // Only depends on readStatuses (the authoritative source for seen status)
  const userLatestSeenTimestamps = useMemo(() => {
    const map = new Map<string, { name: string; timestampMs: number }>();
    const myUid = currentUserIdRef.current || currentUserId;

    // Read statuses are the authoritative source for "seen by" info
    (readStatuses || []).forEach((rs: any) => {
      if (!rs.user_id || rs.user_id === myUid || !rs.last_read_at) return;
      let prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
      if (!prof) {
        prof = profileCacheRef.current.get(rs.user_id) || messagesRef.current.find((m) => m.user_id === rs.user_id && m.profiles)?.profiles;
      }
      const name = prof?.full_name?.split(' ')[0] || prof?.username || 'Member';
      const ts = new Date(rs.last_read_at).getTime();
      const existing = map.get(rs.user_id);
      if (!existing || ts > existing.timestampMs) {
        map.set(rs.user_id, { name, timestampMs: ts });
      }
    });

    return Array.from(map.values());
  }, [readStatuses, currentUserId]);

  const messageSeenUsersMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const myUid = currentUserIdRef.current || currentUserId;
    if (!userLatestSeenTimestamps.length || !messages.length || !myUid) return map;

    const ownMessages = messages.filter((m) => m.user_id === myUid && m.created_at);

    for (const u of userLatestSeenTimestamps) {
      let lastSeenMsgId: string | null = null;
      for (let i = ownMessages.length - 1; i >= 0; i--) {
        const m = ownMessages[i];
        const msgTs = new Date(m.created_at).getTime();
        if (u.timestampMs >= msgTs - 1000) {
          lastSeenMsgId = m.id;
          break;
        }
      }

      if (lastSeenMsgId) {
        if (!map.has(lastSeenMsgId)) {
          map.set(lastSeenMsgId, []);
        }
        map.get(lastSeenMsgId)!.push(u.name);
      }
    }

    return map;
  }, [userLatestSeenTimestamps, messages, currentUserId]);

  const getSeenStatusLabel = useCallback((item: any, isOwn: boolean) => {
    if (!isOwn || !item?.id) return '';
    const seenUsers = messageSeenUsersMap.get(item.id);
    if (!seenUsers || seenUsers.length === 0) return '';
    if (seenUsers.length === 1) return `Seen by ${seenUsers[0]}`;
    return `Seen by ${seenUsers[0]} +${seenUsers.length - 1}`;
  }, [messageSeenUsersMap]);

  // Keep messagesRef in sync so renderMessage reads fresh data without depending on messages
  messagesRef.current = messages;

  const keyExtractor = useCallback((item: any, index: number) => item?.id || index.toString(), []);

  const renderMessage = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const msgs = messagesRef.current;
      const author = item.profiles || null;
      const isOwn = item.user_id === currentUserId;
      const userColor = getUserColor(item.user_id);

      const currentDateLabel = formatDateLabel(item.created_at);
      const prevDateLabel = index > 0 ? formatDateLabel(msgs[index - 1]?.created_at) : null;
      const showDateHeader = index === 0 || currentDateLabel !== prevDateLabel;

      const prevMsg = index > 0 ? msgs[index - 1] : null;
      const nextMsg = index < msgs.length - 1 ? msgs[index + 1] : null;

      const isSameSenderAsPrev = !!prevMsg && prevMsg.user_id === item.user_id && !showDateHeader;
      const isSameSenderAsNext =
        !!nextMsg &&
        nextMsg.user_id === item.user_id &&
        formatDateLabel(nextMsg?.created_at) === currentDateLabel;

      const timeStr = item.created_at
        ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        : '';

      const isStarred = starredMsgIds.has(item.id);
      const seenStatusLabel = getSeenStatusLabel(item, isOwn);

      return (
        <DiscussionMessageRow
          key={item.id}
          item={item}
          index={index}
          isOwn={isOwn}
          showDateHeader={showDateHeader}
          currentDateLabel={currentDateLabel}
          isSameSenderAsPrev={isSameSenderAsPrev}
          isSameSenderAsNext={isSameSenderAsNext}
          author={author}
          userColor={userColor}
          timeStr={timeStr}
          replyMsg={item.reply_to_message || (item.reply_to_id ? messageMapRef.current.get(item.reply_to_id) : null)}
          shareInfo={item.share_info}
          isStarred={isStarred}
          seenStatusLabel={seenStatusLabel}
          themeColors={themeColors}
          isDark={isDark}
          currentUserId={currentUserId}
          currentUserProfile={currentUserProfile}
          roomId={roomId}
          roomTitle={roomTitle}
          navigation={navigation}
          decryptFallback={decryptFallback}
          setSelectedImageModal={setSelectedImageModal}
          isSelected={selectedMsgIds.has(item.id)}
          isSingleSelected={selectedMsgIds.size === 1 && selectedMsgIds.has(item.id)}
          isSelectionMode={selectedMsgIds.size > 0}
          onToggleSelectMsg={handleToggleSelectMsg}
          onLongPress={handleLongPressMsg}
          onSwipeReply={handleSwipeReply}
          onToggleReaction={handleToggleReaction}
          onJoinCall={joinCallStable}
        />
      );
    },
    [
      joinCallStable,
      currentUserId,
      starredMsgIds,
      getSeenStatusLabel,
      themeColors,
      isDark,
      currentUserProfile,
      roomId,
      roomTitle,
      navigation,
      decryptFallback,
      selectedMsgIds,
      handleToggleSelectMsg,
      handleLongPressMsg,
      handleToggleReaction,
      handleSwipeReply,
    ]
  );

  const flashListExtraData = useMemo(
    () => ({
      selectedMsgIds,
      messageSeenUsersMap,
      readStatuses,
    }),
    [selectedMsgIds, messageSeenUsersMap, readStatuses]
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      {/* Contextual WhatsApp Selection Action Bar Header OR Normal Header */}
      {selectedMsgIds.size > 0 ? (
        <View style={[styles.selectionHeader, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <View style={styles.selectionHeaderLeft}>
            <TouchableOpacity
              style={styles.selectionCloseBtn}
              onPress={() => setSelectedMsgIds(new Set())}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="x" size={20} color={themeColors.textPrimary} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={[styles.selectionCountText, { color: themeColors.textPrimary }]}>{selectedMsgIds.size}</Text>
          </View>

          <View style={styles.selectionHeaderActions}>
            {/* Reply - Only when 1 message is selected */}
            {selectedMsgIds.size === 1 && (
              <TouchableOpacity
                style={styles.selectionActionBtn}
                onPress={() => {
                  triggerHaptic?.(25);
                  const singleMsg = messages.find((m) => selectedMsgIds.has(m.id));
                  if (singleMsg) {
                    setReplyTo(singleMsg);
                  }
                  setSelectedMsgIds(new Set());
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Icon name="corner-up-left" size={19} color={themeColors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Info - Only when 1 message is selected */}
            {selectedMsgIds.size === 1 && (
              <TouchableOpacity
                style={styles.selectionActionBtn}
                onPress={() => {
                  triggerHaptic?.(25);
                  const singleMsg = messages.find((m) => selectedMsgIds.has(m.id));
                  if (singleMsg) {
                    fetchReadStatuses();
                    setInfoModalMessage(singleMsg);
                  }
                  setSelectedMsgIds(new Set());
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Icon name="info" size={19} color={themeColors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Star / Unstar all selected messages */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => {
                triggerHaptic?.(25);
                const selectedArray = Array.from(selectedMsgIds);
                const allStarred = selectedArray.every((id) => starredMsgIds.has(id));
                const next = new Set(starredMsgIds);
                if (allStarred) {
                  selectedArray.forEach((id) => next.delete(id));
                  Alert.alert('Unstarred', `Unstarred ${selectedArray.length} message${selectedArray.length > 1 ? 's' : ''}.`);
                } else {
                  selectedArray.forEach((id) => next.add(id));
                  Alert.alert('Starred', `Starred ${selectedArray.length} message${selectedArray.length > 1 ? 's' : ''}.`);
                }
                saveStarredMessages(next);
                setSelectedMsgIds(new Set());
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Icon
                name="star"
                size={19}
                color={Array.from(selectedMsgIds).every((id) => starredMsgIds.has(id)) ? '#F59E0B' : themeColors.textPrimary}
              />
            </TouchableOpacity>

            {/* Copy all selected messages */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => {
                triggerHaptic?.(25);
                const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
                if (selectedList.length === 1) {
                  Clipboard.setString(decryptFallback(selectedList[0].content));
                } else {
                  const combined = selectedList
                    .map((m) => {
                      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const sender = m.profiles?.username || m.profiles?.full_name || 'User';
                      return `[${time}] ${sender}: ${decryptFallback(m.content)}`;
                    })
                    .join('\n');
                  Clipboard.setString(combined);
                }
                Alert.alert('Copied', `Copied ${selectedList.length} message${selectedList.length > 1 ? 's' : ''} to clipboard.`);
                setSelectedMsgIds(new Set());
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Icon name="copy" size={19} color={themeColors.textPrimary} />
            </TouchableOpacity>

            {/* Forward all selected messages */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={async () => {
                triggerHaptic?.(25);
                try {
                  const supabase = getSupabaseClient();
                  const { data: otherRooms } = await supabase
                    .from('discussion_rooms' as any)
                    .select('id, title, room_type')
                    .neq('id', roomId)
                    .limit(20);
                  const cachedRooms = (await getCache<any[]>('discussion_rooms')) || [];
                  const filteredCached = cachedRooms.filter((r) => r.id !== roomId);
                  const combinedRooms = otherRooms && otherRooms.length > 0 ? otherRooms : filteredCached;
                  setAvailableRoomsForForward(combinedRooms);
                } catch {
                  // Fallback
                }
                setForwardModalVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Icon name="share" size={19} color={themeColors.textPrimary} />
            </TouchableOpacity>

            {/* Delete (if any selected message belongs to user or user is admin) */}
            {Array.from(selectedMsgIds).some((id) => {
              const msg = messages.find((m) => m.id === id);
              return msg && (msg.user_id === currentUserId || isAdmin);
            }) && (
                <TouchableOpacity
                  style={styles.selectionActionBtn}
                  onPress={() => {
                    triggerHaptic?.(25);
                    const deletableIds = Array.from(selectedMsgIds).filter((id) => {
                      const msg = messages.find((m) => m.id === id);
                      return msg && (msg.user_id === currentUserId || isAdmin);
                    });
                    Alert.alert(
                      'Delete Messages',
                      `Permanently delete ${deletableIds.length} message${deletableIds.length > 1 ? 's' : ''}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const supabase = getSupabaseClient();
                              await supabase.from('room_messages' as any).update({ reply_to_id: null }).in('reply_to_id', deletableIds);
                              await supabase.from('room_messages' as any).delete().in('id', deletableIds);
                              setMessages((prev) => {
                                const updated = prev.filter((m) => !deletableIds.includes(m.id));
                                if (roomId) saveCache(`room_messages_${roomId}`, updated).catch(() => { });
                                return updated;
                              });
                              setSelectedMsgIds(new Set());
                            } catch (e: any) {
                              Alert.alert('Error', e.message || 'Delete failed.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Icon name="trash-2" size={19} color="#EF4444" />
                </TouchableOpacity>
              )}
          </View>
        </View>
      ) : (
        /* Normal Header matching Web screenshot */
        <View style={[styles.webHeader, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => handleSmartBack(navigation, 'Discussions')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.webHeaderTitleArea} onPress={() => setShowRoomSettings(true)}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.webHeaderTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {roomSettings?.roomEmoji ? `${roomSettings.roomEmoji} ` : ''}{currentRoomTitle}
              </Text>
              {isInCall && (
                <View style={styles.headerLiveBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.headerLiveText}>LIVE</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Video call: a small round icon button (green when a call/space is already live here) */}
          <TouchableOpacity
            style={[styles.headerIconBtn, (isInCall || activeRoomCall) && styles.headerIconBtnLive]}
            onPress={() => {
              void startInlineCall(callState.isVideo || true, 'call');
            }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Icon
              name={activeRoomCall?.mode === 'audio_space' ? 'mic' : 'video'}
              size={18}
              color={isInCall || activeRoomCall ? '#10B981' : themeColors.textSecondary}
            />
          </TouchableOpacity>

          {/* Audio space (listeners + speakers): only offered when nothing is running yet */}
          {!isInCall && !activeRoomCall && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                void startInlineCall(false, 'space');
              }}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Icon name="mic" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.webSettingsBtn} onPress={() => setShowRoomSettings(true)}>
            <Icon name="settings" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Call / Chat Tab Switcher (Matching Web Discussion Room) */}
      {isInCall && (
        <View style={[styles.callChatTabBar, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.callChatTab, styles.callChatTabDiscussion]}
            onPress={() => setRoomTab('call')}
            activeOpacity={0.8}
          >
            <View style={styles.livePulseDot} />
            <Icon name="radio" size={14} color="#EF4444" />
            <Text style={styles.callChatTabDiscussionText}>Discussion (Live)</Text>
            {roomTab === 'call' && <View style={styles.callChatActiveIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.callChatTab, styles.callChatTabChat, { backgroundColor: themeColors.bgCard }]}
            onPress={() => setRoomTab('chat')}
            activeOpacity={0.8}
          >
            <Icon name="message-square" size={14} color={ORANGE} />
            <Text style={styles.callChatTabChatText}>Chat</Text>
            {roomTab === 'chat' && <View style={styles.callChatActiveIndicator} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Call tab: the live call fills the room (the chat below stays mounted so nothing is lost when switching) */}
      {showInlineCall && (
        <InlineCallPanel
          roomId={roomId}
          roomName={currentRoomTitle || roomTitle}
          onExpand={() => {
            maximizeCall();
            navigation.navigate('Call', {
              roomId,
              roomName: currentRoomTitle || 'Discussion Room',
              roomType: 'discussion',
              isVideo: callState.isVideo || false,
            });
          }}
        />
      )}

      {/* High-Performance FlashList Message Stream */}
      <View style={showInlineCall ? { height: 0, overflow: 'hidden' } : { flex: 1 }}>
      {loading ? (
        <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false}>
          <ChatMessagesSkeleton showAvatars={true} showAuthorNames={true} />
        </ScrollView>
      ) : (
        <FlashList
          ref={flatRef}
          data={messages}
          extraData={flashListExtraData}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          estimatedItemSize={78}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            shouldScrollToEndRef.current = false;
            if (showComposerEmojiPicker) setShowComposerEmojiPicker(false);
          }}
          onContentSizeChange={() => {
            if (shouldScrollToEndRef.current && messages && messages.length > 0) {
              try {
                flatRef.current?.scrollToEnd({ animated: false });
              } catch { }
            }
          }}
          ListHeaderComponent={
            hasMoreOlder ? (
              <TouchableOpacity
                style={[styles.loadOlderBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                onPress={fetchOlderMessages}
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
            <View style={styles.emptyState}>
              <Icon name="message-square" size={40} color={themeColors.textMuted} />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Messages Yet</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>Be the first to start the conversation.</Text>
            </View>
          }
        />
      )}

      </View>

      {/* Banners, composer and emoji keyboard belong to the chat: hidden while the Call tab is showing */}
      {!showInlineCall && (
      <>
      {/* Pinned Message Banner */}
      {roomSettings?.pinnedMessage ? (
        <View style={[styles.pinnedBanner, { backgroundColor: themeColors.chipBg, borderBottomColor: themeColors.border }]}>
          <Icon name="pin" size={13} color={ORANGE} />
          <Text style={[styles.pinnedBannerText, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {roomSettings.pinnedMessage}
          </Text>
        </View>
      ) : null}

      {/* Welcome Message (shown when no messages exist) */}
      {messages.length === 0 && roomSettings?.welcomeMessage ? (
        <View style={[styles.welcomeCard, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
          <Icon name="message-square" size={16} color={ORANGE} />
          <Text style={[styles.welcomeCardText, { color: themeColors.textSecondary }]}>
            {roomSettings.welcomeMessage}
          </Text>
        </View>
      ) : null}

      {/* Reply Context Banner */}
      {replyTo && (() => {
        const repThumb = getReplyThumbnail(replyTo);
        const repAuthor = replyTo.profiles?.username || replyTo.profiles?.full_name || 'User';
        const rawSnippet = decryptFallback(replyTo.content);
        const snippet = getReplySnippet(replyTo, rawSnippet);

        return (
          <View style={[styles.replyBanner, { backgroundColor: themeColors.chipBg, borderTopColor: themeColors.border }]}>
            <Icon name="corner-up-left" size={14} color={ORANGE} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyBannerText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  Replying to <Text style={{ fontWeight: '800', color: themeColors.textPrimary }}>{repAuthor}</Text>:{' '}
                  {snippet}
                </Text>
              </View>
              {repThumb ? (
                <CachedImage
                  uri={repThumb}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={14} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Attached File Preview Bar List */}
      {attachedFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 60, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: themeColors.chipBg }}
        >
          {attachedFiles.map((file, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginRight: 8,
                borderWidth: 1,
                borderColor: themeColors.border,
                gap: 6,
              }}
            >
              {file.type.startsWith('image/') ? (
                <CachedImage uri={file.uri} style={{ width: 22, height: 22, borderRadius: 5 }} />
              ) : (
                <Icon name="paperclip" size={14} color={ORANGE} />
              )}
              <Text style={{ fontSize: 11, fontWeight: '600', color: themeColors.textPrimary, maxWidth: 110 }} numberOfLines={1}>
                {file.name}
              </Text>
              <TouchableOpacity onPress={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}>
                <Icon name="x" size={14} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Web Parity Input Toolbar at Bottom */}
      {!canSendMessages ? (
        <View style={[styles.adminOnlyBanner, { backgroundColor: themeColors.chipBg, borderTopColor: themeColors.border }]}>
          <Icon name="lock" size={14} color={themeColors.textSecondary} />
          <Text style={[styles.adminOnlyText, { color: themeColors.textSecondary }]}>
            Only admins can send messages in this room
          </Text>
        </View>
      ) : (
        <View style={[styles.webInputToolbar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
          {canShareMedia ? (
            <TouchableOpacity style={styles.webIconBtn} onPress={handlePickDocument}>
              <Icon name="paperclip" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.webIconBtn,
              showComposerEmojiPicker && {
                backgroundColor: isDark ? 'rgba(255, 75, 51, 0.2)' : '#FFE5DF',
                borderRadius: 10,
              },
            ]}
            onPress={() => {
              if (showComposerEmojiPicker) {
                setShowComposerEmojiPicker(false);
                setTimeout(() => inputRef.current?.focus(), 60);
              } else {
                Keyboard.dismiss();
                setShowComposerEmojiPicker(true);
              }
            }}
          >
            <Icon
              name={showComposerEmojiPicker ? 'type' : 'smile'}
              size={20}
              color={showComposerEmojiPicker ? ORANGE : themeColors.textSecondary}
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.webInputPill, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]}
            placeholder="Message..."
            placeholderTextColor={themeColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              if (showComposerEmojiPicker) {
                setShowComposerEmojiPicker(false);
              }
            }}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.webSendCircle,
              ((!inputText.trim() && attachedFiles.length === 0) || sending || slowModeCooldown > 0) && styles.webSendCircleDisabled
            ]}
            onPress={handleSend}
            disabled={(!inputText.trim() && attachedFiles.length === 0) || sending || slowModeCooldown > 0}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : slowModeCooldown > 0 ? (
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{slowModeCooldown}s</Text>
            ) : (
              <Icon name="send" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Google / Gboard / WhatsApp Style Emoji Keyboard in place of keyboard */}
      {showComposerEmojiPicker && (() => {
        const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory) || EMOJI_CATEGORIES[0];
        return (
          <View style={[styles.googleEmojiKeyboard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderTopColor: themeColors.border }]}>
            {/* Top Category Tabs Bar */}
            <View style={[styles.googleEmojiTabBar, { backgroundColor: isDark ? '#27272A' : '#EEF2F6', borderBottomColor: themeColors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.googleEmojiTabScroll}>
                {EMOJI_CATEGORIES.map((cat) => {
                  const isActive = activeEmojiCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.googleEmojiTabBtn,
                        isActive && [
                          styles.googleEmojiTabBtnActive,
                          { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
                        ],
                      ]}
                      onPress={() => {
                        triggerHaptic?.(10);
                        setActiveEmojiCategory(cat.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.googleEmojiTabIcon}>{cat.iconEmoji}</Text>
                      <Text
                        style={[
                          styles.googleEmojiTabLabel,
                          { color: isActive ? (isDark ? '#FFFFFF' : INK) : themeColors.textMuted },
                          isActive && { fontWeight: '700' },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Quick Backspace button on tab header */}
              <TouchableOpacity
                style={[styles.googleEmojiBackspaceBtn, { backgroundColor: isDark ? '#3F3F46' : '#E2E8F0' }]}
                onPress={() => {
                  triggerHaptic?.(15);
                  setInputText((prev) => Array.from(prev).slice(0, -1).join(''));
                }}
                activeOpacity={0.6}
              >
                <Icon name="x" size={15} color={themeColors.textPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Emoji Grid Area */}
            <ScrollView
              style={styles.googleEmojiGridScroll}
              contentContainerStyle={styles.googleEmojiGridContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.googleEmojiGridWrap}>
                {currentCategory.emojis.map((emoji, index) => (
                  <TouchableOpacity
                    key={`${emoji}-${index}`}
                    style={styles.googleEmojiCell}
                    onPress={() => {
                      triggerHaptic?.(8);
                      setInputText((prev) => prev + emoji);
                    }}
                    activeOpacity={0.5}
                  >
                    <Text style={styles.googleEmojiGlyph}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Bottom Bar: Switch to Keyboard / Clear / Category count */}
            <View style={[styles.googleEmojiBottomBar, { backgroundColor: isDark ? '#27272A' : '#EEF2F6', borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.googleEmojiSwitchKbBtn, { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' }]}
                onPress={() => {
                  setShowComposerEmojiPicker(false);
                  setTimeout(() => inputRef.current?.focus(), 60);
                }}
                activeOpacity={0.7}
              >
                <Icon name="type" size={15} color={themeColors.textPrimary} />
                <Text style={[styles.googleEmojiSwitchKbText, { color: themeColors.textPrimary }]}>ABC</Text>
              </TouchableOpacity>

              <Text style={[styles.googleEmojiCategoryHint, { color: themeColors.textMuted }]}>
                {currentCategory.name} ({currentCategory.emojis.length})
              </Text>

              <TouchableOpacity
                style={[styles.googleEmojiDelBtn, { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' }]}
                onPress={() => {
                  triggerHaptic?.(15);
                  setInputText((prev) => Array.from(prev).slice(0, -1).join(''));
                }}
                onLongPress={() => {
                  triggerHaptic?.(30);
                  setInputText('');
                }}
                activeOpacity={0.6}
              >
                <Text style={[styles.googleEmojiDelText, { color: themeColors.textPrimary }]}>⌫</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}
      </>
      )}

      {/* Forward Messages Modal */}
      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setForwardModalVisible(false)}>
          <View style={styles.forwardOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.forwardCard, { backgroundColor: themeColors.bgCard }]}>
                <View style={[styles.forwardHeader, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.forwardTitle, { color: themeColors.textPrimary }]}>
                    Forward {selectedMsgIds.size} Message{selectedMsgIds.size > 1 ? 's' : ''} to...
                  </Text>
                  <TouchableOpacity onPress={() => setForwardModalVisible(false)}>
                    <Icon name="x" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.forwardList} showsVerticalScrollIndicator={false}>
                  {availableRoomsForForward.length > 0 ? (
                    availableRoomsForForward.map((room) => (
                      <TouchableOpacity
                        key={room.id}
                        style={[styles.forwardRoomItem, { borderBottomColor: themeColors.border }]}
                        onPress={() => handleForwardToRoom(room)}
                        disabled={forwarding}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.forwardRoomIcon, { backgroundColor: isDark ? 'rgba(255, 87, 51, 0.2)' : '#FFEBE8' }]}>
                          <Icon name="message-square" size={18} color={ORANGE} />
                        </View>
                        <View style={styles.forwardRoomMeta}>
                          <Text style={[styles.forwardRoomName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                            {room.title || 'Discussion Room'}
                          </Text>
                          <Text style={[styles.forwardRoomType, { color: themeColors.textMuted }]}>
                            {room.room_type || 'public'} stage
                          </Text>
                        </View>
                        <Icon name="arrow-right" size={16} color={themeColors.textMuted} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.forwardEmpty}>
                      <Icon name="message-square" size={32} color={themeColors.textMuted} />
                      <Text style={[styles.forwardEmptyText, { color: themeColors.textSecondary }]}>
                        No other discussion rooms found
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {forwarding && (
                  <View style={styles.forwardLoadingOverlay}>
                    <ActivityIndicator size="large" color={ORANGE} />
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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

      {/* Message Info Modal */}
      <Modal
        visible={!!infoModalMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModalMessage(null)}
      >
        <View style={styles.messageInfoOverlay}>
          <View style={[styles.messageInfoCard, { backgroundColor: themeColors.bgCard }]}>
            <View style={[styles.messageInfoHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.messageInfoTitle, { color: themeColors.textPrimary }]}>Message Info</Text>
              <TouchableOpacity
                onPress={() => setInfoModalMessage(null)}
                style={styles.messageInfoCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.messageInfoScroll} showsVerticalScrollIndicator={false}>
              {/* Message Bubble Preview */}
              {infoModalMessage && (
                <View style={[styles.messageInfoBubbleWrap, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC' }]}>
                  <View style={styles.messageInfoBubbleHeader}>
                    <Text style={[styles.messageInfoSenderName, { color: ORANGE }]}>
                      {infoModalMessage.profiles?.full_name || infoModalMessage.profiles?.username || 'User'}
                    </Text>
                    <Text style={[styles.messageInfoTimeText, { color: themeColors.textMuted }]}>
                      {new Date(infoModalMessage.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {/* If attachment */}
                  {infoModalMessage.media_url && (
                    <View style={styles.messageInfoMediaPreview}>
                      <Icon name="paperclip" size={14} color={ORANGE} />
                      <Text style={[styles.messageInfoMediaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        Attached {(infoModalMessage.media_type || 'file').toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.messageInfoContentText, { color: themeColors.textPrimary }]}>
                    {decryptFallback(infoModalMessage.content)}
                  </Text>

                  {isPrivateRoom ? (
                    <View style={styles.messageInfoSecurityRow}>
                      <Icon name="lock" size={11} color="#10B981" />
                      <Text style={styles.messageInfoSecurityText}>End-to-end encrypted</Text>
                    </View>
                  ) : (
                    <View style={styles.messageInfoSecurityRow}>
                      <Icon name="globe" size={11} color="#3B82F6" />
                      <Text style={[styles.messageInfoSecurityText, { color: '#3B82F6' }]}>Public message</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Read Receipts Section */}
              {(() => {
                if (!infoModalMessage) return null;
                const msgCreatedAtMs = new Date(infoModalMessage.created_at || Date.now()).getTime();
                const msgSenderId = infoModalMessage.user_id;

                const seenMap = new Map<string, { userId: string; name: string; avatarUrl?: string; readAt: string; readAtMs: number }>();

                // 1. Check from room_message_read_status
                (readStatuses || []).forEach((rs: any) => {
                  if (!rs.user_id || rs.user_id === msgSenderId) return;
                  if (!rs.last_read_at) return;
                  const readAtMs = new Date(rs.last_read_at).getTime();
                  if (readAtMs >= msgCreatedAtMs - 1000) {
                    const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
                    const name = prof?.full_name || prof?.username || 'Room Member';
                    seenMap.set(rs.user_id, {
                      userId: rs.user_id,
                      name,
                      avatarUrl: prof?.avatar_url,
                      readAt: rs.last_read_at,
                      readAtMs,
                    });
                  }
                });

                // 2. Check from message reactions (if someone reacted to this message, they definitely read it!)
                (infoModalMessage.reactions || []).forEach((rx: any) => {
                  const rxUserId = rx.user_id;
                  if (!rxUserId || rxUserId === msgSenderId) return;
                  const rxTime = rx.created_at || infoModalMessage.created_at;
                  const rxTimeMs = new Date(rxTime).getTime();
                  const prof = Array.isArray(rx.profiles) ? rx.profiles[0] : rx.profiles;
                  const name = prof?.full_name || prof?.username || rx.user_name || 'Room Member';
                  const existing = seenMap.get(rxUserId);
                  if (!existing || rxTimeMs < existing.readAtMs) {
                    seenMap.set(rxUserId, {
                      userId: rxUserId,
                      name: existing?.name && existing.name !== 'Room Member' ? existing.name : name,
                      avatarUrl: existing?.avatarUrl || prof?.avatar_url,
                      readAt: rxTime,
                      readAtMs: rxTimeMs,
                    });
                  }
                });

                // 3. Check subsequent messages in the room from other members (if someone sent a message after this, they saw the room)
                const msgIndex = messages.findIndex((m) => m.id === infoModalMessage.id);
                if (msgIndex >= 0) {
                  for (let i = msgIndex + 1; i < messages.length; i++) {
                    const nextMsg = messages[i];
                    if (nextMsg.user_id && nextMsg.user_id !== msgSenderId) {
                      const nextMsgTimeMs = new Date(nextMsg.created_at).getTime();
                      const prof = Array.isArray(nextMsg.profiles) ? nextMsg.profiles[0] : nextMsg.profiles;
                      const name = prof?.full_name || prof?.username || 'Room Member';
                      const existing = seenMap.get(nextMsg.user_id);
                      if (!existing) {
                        seenMap.set(nextMsg.user_id, {
                          userId: nextMsg.user_id,
                          name,
                          avatarUrl: prof?.avatar_url,
                          readAt: nextMsg.created_at,
                          readAtMs: nextMsgTimeMs,
                        });
                      }
                    }
                  }
                }

                // Format time nicely
                const formatReadTime = (isoString: string) => {
                  if (!isoString) return '';
                  const d = new Date(isoString);
                  const now = new Date();
                  const isToday = d.toDateString() === now.toDateString();
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return isToday ? `Today at ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
                };

                const readersList = Array.from(seenMap.values()).map((r) => ({
                  ...r,
                  readAtFormatted: formatReadTime(r.readAt),
                }));

                return (
                  <View style={styles.messageInfoSection}>
                    <View style={styles.messageInfoSectionHeader}>
                      <View style={styles.messageInfoSectionTitleRow}>
                        <Icon name="check-circle" size={16} color="#10B981" />
                        <Text style={[styles.messageInfoSectionTitle, { color: themeColors.textPrimary }]}>
                          Read by ({readersList.length})
                        </Text>
                      </View>
                    </View>

                    {readersList.length > 0 ? (
                      readersList.map((r, idx) => (
                        <View key={idx} style={[styles.messageInfoMemberRow, { borderBottomColor: themeColors.border }]}>
                          {r.avatarUrl ? (
                            <Image source={{ uri: r.avatarUrl, cache: 'force-cache' }} style={styles.messageInfoAvatarImage} />
                          ) : (
                            <View style={styles.messageInfoAvatarCircle}>
                              <Text style={styles.messageInfoAvatarInitial}>
                                {(r.name?.charAt(0) || 'U').toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.messageInfoMemberInfo}>
                            <Text style={[styles.messageInfoMemberName, { color: themeColors.textPrimary }]}>
                              {r.name}
                            </Text>
                            <Text style={[styles.messageInfoReadTime, { color: themeColors.textMuted }]}>
                              Read {r.readAtFormatted}
                            </Text>
                          </View>
                          <Icon name="check" size={16} color="#10B981" />
                        </View>
                      ))
                    ) : (
                      <View style={styles.messageInfoEmptyRow}>
                        <Text style={[styles.messageInfoEmptyText, { color: themeColors.textMuted }]}>
                          Not read by other members yet
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Delivered Section */}
              <View style={styles.messageInfoSection}>
                <View style={styles.messageInfoSectionHeader}>
                  <View style={styles.messageInfoSectionTitleRow}>
                    <Icon name="send" size={15} color={ORANGE} />
                    <Text style={[styles.messageInfoSectionTitle, { color: themeColors.textPrimary }]}>Delivered</Text>
                  </View>
                </View>
                <View style={[styles.messageInfoMemberRow, { borderBottomColor: 'transparent' }]}>
                  <Text style={[styles.messageInfoDeliveredText, { color: themeColors.textSecondary }]}>
                    Sent on {new Date(infoModalMessage?.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(infoModalMessage?.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>

              {/* Reactions Breakdown Section */}
              {infoModalMessage?.reactions && infoModalMessage.reactions.length > 0 && (
                <View style={styles.messageInfoSection}>
                  <View style={styles.messageInfoSectionHeader}>
                    <View style={styles.messageInfoSectionTitleRow}>
                      <Text style={{ fontSize: 15 }}>✨</Text>
                      <Text style={[styles.messageInfoSectionTitle, { color: themeColors.textPrimary }]}>
                        Reactions ({infoModalMessage.reactions.length})
                      </Text>
                    </View>
                  </View>
                  <View style={styles.messageInfoReactionsWrap}>
                    {infoModalMessage.reactions.map((rc: any, idx: number) => (
                      <View key={idx} style={[styles.messageInfoReactionPill, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                        <Text style={{ fontSize: 18 }}>{rc.emoji}</Text>
                        <Text style={[styles.messageInfoReactionName, { color: themeColors.textPrimary }]}>
                          {rc.profiles?.full_name || rc.profiles?.username || 'Member'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Room Details Modal */}
      <Modal visible={showRoomInfo} transparent animationType="slide" onRequestClose={() => setShowRoomInfo(false)}>
        <TouchableWithoutFeedback onPress={() => setShowRoomInfo(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.roomInfoCard, { backgroundColor: themeColors.bgCard }]}>
                <View style={styles.roomInfoHeader}>
                  <Text style={[styles.roomInfoTitle, { color: themeColors.textPrimary }]}>💬 {roomTitle || 'Test- private'}</Text>
                  <TouchableOpacity onPress={() => setShowRoomInfo(false)}>
                    <Icon name="x" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {roomDescription && <Text style={[styles.roomInfoDesc, { color: themeColors.textSecondary }]}>{roomDescription}</Text>}

                <View style={styles.roomInfoMetaRow}>
                  <View style={[styles.roomInfoBadge, { backgroundColor: themeColors.chipBg }]}>
                    <Icon name="users" size={13} color={themeColors.textSecondary} />
                    <Text style={[styles.roomInfoBadgeText, { color: themeColors.textSecondary }]}>{memberCount} Members</Text>
                  </View>

                  {roomCategory && (
                    <View style={[styles.roomInfoBadge, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }]}>
                      <Icon name="tag" size={13} color="#3B82F6" />
                      <Text style={[styles.roomInfoBadgeText, { color: '#3B82F6' }]}>{roomCategory}</Text>
                    </View>
                  )}
                </View>

                {isPrivateRoom ? (
                  <View style={[styles.roomInfoSecurity, { backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5' }]}>
                    <Icon name="shield" size={14} color="#059669" />
                    <Text style={styles.roomInfoSecurityText}>End-to-End Encrypted Room</Text>
                  </View>
                ) : (
                  <View style={[styles.roomInfoSecurity, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                    <Icon name="globe" size={14} color="#3B82F6" />
                    <Text style={[styles.roomInfoSecurityText, { color: '#3B82F6' }]}>Public Discussion Room</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.roomInfoCallBtn}
                  onPress={() => {
                    setShowRoomInfo(false);
                    void startInlineCall(false);
                  }}
                >
                  <Icon name="phone" size={16} color="#FFFFFF" />
                  <Text style={styles.roomInfoCallBtnText}>Join Live Voice Discussion</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Full Web Parity Discussion Room Settings Modal */}
      <RoomSettingsModal
        visible={showRoomSettings}
        roomId={roomId}
        roomTitle={currentRoomTitle}
        roomDescription={currentRoomDesc}
        currentUserId={currentUserId}
        onClose={() => {
          setShowRoomSettings(false);
          loadRoomMuteState();
        }}
        onRoomUpdated={(newTitle, newDesc, newSettings) => {
          if (newTitle) setCurrentRoomTitle(newTitle);
          if (newDesc !== undefined) setCurrentRoomDesc(newDesc);
          if (newSettings) setRoomSettings(newSettings);
        }}
        onRoomDeleted={() => navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  selectionHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectionCloseBtn: {
    padding: 4,
  },
  selectionCountText: {
    fontSize: 17,
    fontWeight: '700',
  },
  selectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  selectionActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webHeaderTitleArea: {
    flex: 1,
    marginLeft: 4,
  },
  webHeaderTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  webRadioBtn: {
    marginRight: 4,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  headerIconBtnLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  webRadioPulseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C026D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSettingsBtn: {
    padding: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  headerLiveText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  webRadioPulseCircleActive: {
    backgroundColor: '#10B981',
  },
  callChatTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  callChatTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    position: 'relative',
  },
  callChatTabDiscussion: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  callChatTabDiscussionText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  callChatTabChat: {
    backgroundColor: '#FFFFFF',
  },
  callChatTabChatText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  callChatActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: ORANGE,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 110, // <--- 110px padding bottom so newest messages are never cut off by input composer!
    gap: 4,
  },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
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
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateHeaderText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  webCallEventRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  webCallEventPill: {
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
  webCallIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCallIconCircleGreen: {
    backgroundColor: '#DCFCE7',
  },
  webCallIconCircleRed: {
    backgroundColor: '#FEE2E2',
  },
  webCallEventText: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '700',
  },
  webCallActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
  },
  webCallJoinBadge: {
    backgroundColor: '#ECFDF5',
  },
  webCallBackBadge: {
    backgroundColor: '#F1F5F9',
  },
  webCallActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  webCallJoinText: {
    color: '#059669',
  },
  webCallBackText: {
    color: '#64748B',
  },

  msgRowWrapper: {
    width: '100%',
    position: 'relative',
    marginVertical: 2,
  },
  msgRow: {
    width: '100%',
  },
  msgRowOwn: {
    alignItems: 'flex-end',
  },
  msgRowOther: {
    alignItems: 'flex-start',
  },
  msgInnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  msgInnerRowOwn: {
    justifyContent: 'flex-end',
  },
  msgInnerRowOther: {
    justifyContent: 'flex-start',
  },
  avatarWrapper: {
    marginRight: 8,
    marginTop: 2,
  },
  avatarWrapperRight: {
    marginLeft: 8,
    marginTop: 2,
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  msgSmileyBtnLeft: {
    marginRight: 6,
    alignSelf: 'center',
    padding: 4,
  },
  bubbleColWrap: {
    maxWidth: '78%',
    position: 'relative',
  },
  bubbleColWrapOwn: {
    alignItems: 'flex-end',
  },
  bubbleColWrapOther: {
    alignItems: 'flex-start',
  },
  floatingReactionPicker: {
    position: 'absolute',
    top: -42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 9999,
    gap: 8,
  },
  reactionPickerRight: {
    right: 12,
  },
  reactionPickerLeft: {
    left: 48,
  },
  reactionEmojiBtn: {
    padding: 4,
  },
  reactionEmojiText: {
    fontSize: 22,
  },
  unifiedReactionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 3,
    marginTop: -8,
    marginBottom: 2,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 4,
  },
  unifiedReactionsPillOwn: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  unifiedReactionsPillOther: {
    alignSelf: 'flex-start',
    marginLeft: 8,
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
  },
  touchableBubbleWrap: {
    maxWidth: '100%',
    position: 'relative',
  },
  touchableBubbleWrapOwn: {
    alignItems: 'flex-end',
  },
  touchableBubbleWrapOther: {
    alignItems: 'flex-start',
  },
  msgBubbleWrapper: {
    maxWidth: '75%',
    position: 'relative',
  },
  msgBubbleWrapperOwn: {
    alignItems: 'flex-end',
  },
  msgBubbleWrapperOther: {
    alignItems: 'flex-start',
  },
  transparentMediaWrapper: {
    padding: 0,
    marginVertical: 2,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  msgBubbleOwn: {
    backgroundColor: ORANGE,
    borderTopRightRadius: 6,
  },
  msgBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderTopLeftRadius: 6,
  },
  webMsgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  msgAuthor: {
    fontSize: 13,
    fontWeight: '800',
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
  },
  inlineTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    paddingBottom: 1,
  },
  msgBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgBodyOwn: {
    color: '#FFFFFF',
  },
  msgBodyOther: {
    color: INK,
  },
  inlineTime: {
    fontSize: 10.5,
  },
  inlineTimeOwn: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inlineTimeOther: {
    color: '#64748B',
  },
  seenByText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  sentStatusText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleWrap: {
    position: 'relative',
    maxWidth: '100%',
  },
  bubbleWrapOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  mediaAttachmentBox: {
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaVideoAttachmentBox: {
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    width: 220,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaVideoPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 75, 51, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaVideoText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 14,
  },
  shareCardContainer: {
    marginVertical: 4,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderTopWidth: 1,
    borderTopColor: '#FFE5DF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  replyBannerText: {
    flex: 1,
    color: '#6B7280',
    fontSize: 11,
  },
  attachedFileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  attachedFileName: {
    flex: 1,
    color: INK,
    fontSize: 11.5,
    fontWeight: '600',
  },
  googleEmojiKeyboard: {
    height: 275,
    borderTopWidth: 1,
    flexDirection: 'column',
  },
  googleEmojiTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  googleEmojiTabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  googleEmojiTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
  },
  googleEmojiTabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleEmojiTabIcon: {
    fontSize: 16,
  },
  googleEmojiTabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  googleEmojiBackspaceBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  googleEmojiGridScroll: {
    flex: 1,
  },
  googleEmojiGridContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  googleEmojiGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  googleEmojiCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  googleEmojiGlyph: {
    fontSize: 28,
  },
  googleEmojiBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  googleEmojiSwitchKbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  googleEmojiSwitchKbText: {
    fontSize: 12,
    fontWeight: '700',
  },
  googleEmojiCategoryHint: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  googleEmojiDelBtn: {
    width: 44,
    height: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  googleEmojiDelText: {
    fontSize: 17,
    fontWeight: '700',
  },
  webInputToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  webIconBtn: {
    padding: 4,
  },
  webInputPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
  },
  webSendCircle: {
    backgroundColor: ORANGE,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSendCircleDisabled: {
    backgroundColor: '#CBD5E1',
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  pinnedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  welcomeCardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  adminOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 8,
  },
  adminOnlyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webDropdownCard: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  webDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  webDropdownText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },

  lightboxOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  roomInfoCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  roomInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomInfoTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: '800',
  },
  roomInfoDesc: {
    color: '#4B5563',
    fontSize: 13.5,
    lineHeight: 20,
  },
  roomInfoMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roomInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  roomInfoBadgeText: {
    color: '#4B5563',
    fontSize: 11.5,
    fontWeight: '700',
  },
  roomInfoSecurity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  roomInfoSecurityText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  roomInfoCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    marginTop: 4,
  },
  roomInfoCallBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  forwardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  forwardCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '65%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  forwardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  forwardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  forwardList: {
    maxHeight: 340,
  },
  forwardRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.8,
    gap: 12,
  },
  forwardRoomIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardRoomMeta: {
    flex: 1,
  },
  forwardRoomName: {
    fontSize: 14,
    fontWeight: '700',
  },
  forwardRoomType: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  forwardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  forwardEmptyText: {
    fontSize: 13,
  },
  forwardLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  // ── Message Info Modal Styles ─────────────────────────────────────────────
  messageInfoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  messageInfoCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  messageInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  messageInfoTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  messageInfoCloseBtn: {
    padding: 4,
  },
  messageInfoScroll: {
    maxHeight: 480,
  },
  messageInfoBubbleWrap: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  messageInfoBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  messageInfoSenderName: {
    fontSize: 13,
    fontWeight: '800',
  },
  messageInfoTimeText: {
    fontSize: 11,
  },
  messageInfoMediaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
  },
  messageInfoMediaText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  messageInfoContentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  messageInfoSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  messageInfoSecurityText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#10B981',
  },
  messageInfoSection: {
    marginBottom: 18,
  },
  messageInfoSectionHeader: {
    marginBottom: 8,
  },
  messageInfoSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageInfoSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageInfoMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.7,
    gap: 12,
  },
  messageInfoAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 75, 51, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageInfoAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  messageInfoAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: ORANGE,
  },
  messageInfoMemberInfo: {
    flex: 1,
  },
  messageInfoMemberName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  messageInfoReadTime: {
    fontSize: 11,
    marginTop: 2,
  },
  messageInfoEmptyRow: {
    paddingVertical: 12,
  },
  messageInfoEmptyText: {
    fontSize: 12.5,
    fontStyle: 'italic',
  },
  messageInfoDeliveredText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  messageInfoReactionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  messageInfoReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  messageInfoReactionName: {
    fontSize: 12,
    fontWeight: '600',
  },
  readReceiptMeRow: {
    marginTop: 2,
    alignSelf: 'flex-end',
    paddingRight: 2,
  },
  readReceiptMeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: ORANGE,
  },
});

export default DiscussionRoomDetailScreen;
