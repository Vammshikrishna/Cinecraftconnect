import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Clipboard,
  Animated,
  PanResponder,
  Switch,
  Dimensions,
  Linking,
  Keyboard,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { pickAttachments } from '../../services/attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { Icon } from '../../components/common/Icon';
import { Card } from '../../components/Card';
import { ChatMessagesSkeleton } from '../../components/common/Skeleton';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../../config/env';
import { getCache, saveCache, getCacheSync, getCurrentUserIdSync, resolveCurrentUserId, setCachedCurrentUserId } from '../../services/offlineCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGroupEncryption } from '../../hooks/useGroupEncryption';
import { ShareCard, ShareCardData } from '../../components/chat/ShareCard';
import LinearGradient from 'react-native-linear-gradient';
import { useGlobalCall } from '../../contexts/CallContext';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { CachedImage } from '../../components/common/CachedImage';
import { MediaCollageGrid } from '../../components/chat/MediaCollageGrid';
import { getReplyThumbnail, getReplySnippet } from '../../components/chat/chatUtils';
import { setActiveChatContext, clearActiveChatContext } from '../../services/activeScreenTracker';
import { handleSmartBack } from '../../services/navigationUtils';
import { uploadMediaPipeline } from '../../services/mediaPipeline';

const ORANGE = '#FF4B33';
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// ── Swipeable Message Component ──────────────────────────────────────────────
interface SwipeableMessageProps {
  children: React.ReactNode;
  onPress?: () => void;
  onSwipeReply: () => void;
  onDoubleTap?: () => void;
  onLongPress: () => void;
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
        if (gestureState.dx > 42) {
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
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={280}
          style={{
            maxWidth: '82%',
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
          }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// ── Share Card Data Parser ───────────────────────────────────────────────────
const parseShareData = (
  content: string
): { isShare: boolean; data: ShareCardData | null; caption?: string } => {
  if (!content || typeof content !== 'string') return { isShare: false, data: null };
  const clean = content.replace(/^FORWARDED::/, '').trim();

  const prefixes = [
    { prefix: 'PROJECT_SHARE::', type: 'project' },
    { prefix: 'POST_SHARE::', type: 'post' },
    { prefix: 'JOB_SHARE::', type: 'job' },
    { prefix: 'PROFILE_SHARE::', type: 'profile' },
    { prefix: 'PITCH_SHARE::', type: 'pitch' },
    { prefix: 'MARKETPLACE_SHARE::', type: 'marketplace' },
    { prefix: 'ANNOUNCEMENT_SHARE::', type: 'announcement' },
    { prefix: 'VENDOR_SHARE::', type: 'vendor' },
    { prefix: 'COMPANY_SHARE::', type: 'company' },
    { prefix: 'DISCUSSION_SHARE::', type: 'room' },
    { prefix: 'ROOM_SHARE::', type: 'room' },
    { prefix: 'CONTENT_SHARE::', type: 'post' },
  ];

  for (const item of prefixes) {
    if (clean.includes(item.prefix)) {
      try {
        const parts = clean.split(item.prefix);
        const caption = parts[0].trim();
        const jsonStr = parts[parts.length - 1].trim();
        const rawData = JSON.parse(jsonStr);
        const mappedData: ShareCardData = {
          type: item.type as any,
          id: rawData.id || rawData.projectId || rawData.postId || rawData.jobId || rawData.listingId,
          title:
            rawData.title ||
            rawData.jobTitle ||
            rawData.name ||
            rawData.caption ||
            'Shared item',
          subtitle:
            rawData.subtitle ||
            rawData.description ||
            rawData.logline,
          imageUrl:
            rawData.imageUrl ||
            rawData.banner_url ||
            rawData.cover_image ||
            rawData.previewUrl ||
            rawData.poster_path,
          avatarUrl: rawData.avatarUrl || rawData.authorAvatar || rawData.avatar,
          badge:
            rawData.badge ||
            rawData.category ||
            rawData.genre ||
            rawData.genre_display ||
            rawData.type,
          priceOrSalary: rawData.priceOrSalary || rawData.budget || rawData.salary || rawData.price,
          location: rawData.location,
          author: rawData.author,
          description: rawData.description || rawData.logline,
          status: rawData.status,
          genre: rawData.genre || rawData.genre_display,
          craft: rawData.craft,
          bio: rawData.bio,
          salary: rawData.salary,
          company: rawData.company,
          logoUrl: rawData.logoUrl,
          category: rawData.category,
        };
        return { isShare: true, data: mappedData, caption: caption || undefined };
      } catch (err) {
        console.warn('Failed to parse share data:', err);
      }
    }
  }
  return { isShare: false, data: null };
};

const getDateLabel = (date: Date) => {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return 'TODAY';
  if (isYesterday) return 'YESTERDAY';

  const months = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const formatTime = (iso: string | Date) => {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const isValidUUID = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

const SAMPLE_SPACE_MESSAGES = [
  {
    id: 'sample-msg-1',
    content: 'Welcome to your ProjectSpace! 🎬 Collaborate with your crew, track tasks, and share production updates in real time.',
    user_id: 'system',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    is_deleted: false,
    reply_to_id: null,
    attachment_url: null,
    attachment_type: null,
    profiles: {
      username: 'Director',
      full_name: 'Production Lead',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&fit=crop&crop=faces',
    },
    reactions: [],
  },
  {
    id: 'sample-msg-2',
    content: 'All call sheets and shot lists are synced. Feel free to leave notes and discuss scenes here.',
    user_id: 'system-2',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    is_deleted: false,
    reply_to_id: null,
    attachment_url: null,
    attachment_type: null,
    profiles: {
      username: 'AD',
      full_name: 'Assistant Director',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&fit=crop&crop=faces',
    },
    reactions: [],
  },
];

interface ProjectMessageRowProps {
  item: any;
  index: number;
  isOwn?: boolean;
  showDateSeparator: boolean;
  messageDate: Date;
  senderName: string;
  senderCraft?: string;
  senderAvatar?: string | null;
  senderInitial: string;
  isSelected: boolean;
  isSingleSelected: boolean;
  isSelectionMode: boolean;
  isStarred: boolean;
  shareInfo: any;
  readByNames: string[];
  isSeen: boolean;
  themeColors: any;
  isDark: boolean;
  navigation: any;
  stTitle?: string;
  projectTitle?: string;
  resolvedSpaceId?: string;
  projectId?: string;
  onPress: (msgId: string) => void;
  currentUserId?: string;
  replyMsg?: any;
  onSwipeReply: (item: any) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onLongPress: (item: any) => void;
  onDoubleTap: (messageId: string, emoji: string) => void;
  onOpenImageModal?: (url: string) => void;
  onOpenFile?: (url: string) => void;
}

const ProjectMessageRow = React.memo<ProjectMessageRowProps>(({
  item,
  index,
  isOwn: isOwnProp,
  showDateSeparator,
  messageDate,
  senderName,
  senderCraft,
  senderAvatar,
  senderInitial,
  isSelected,
  isSingleSelected,
  isSelectionMode,
  isStarred,
  shareInfo,
  readByNames,
  isSeen,
  themeColors,
  isDark,
  navigation,
  stTitle,
  projectTitle,
  resolvedSpaceId,
  projectId,
  currentUserId,
  replyMsg,
  onPress,
  onSwipeReply,
  onToggleReaction,
  onLongPress,
  onDoubleTap,
  onOpenImageModal,
  onOpenFile,
}: ProjectMessageRowProps) => {
  const isCallEvent = item.attachment_type === 'call_event' || (item.content && item.content.startsWith('📞'));
  const effectiveUserId = currentUserId || getCurrentUserIdSync();
  const itemUserId = item?.user_id || item?.sender_id || item?.senderId;
  const isOwn = Boolean(
    isOwnProp ||
    (effectiveUserId && itemUserId && itemUserId === effectiveUserId) ||
    item?.is_own === true ||
    item?.isOwn === true
  );
  const mediaUrl = item.attachment_url || item.media_url;
  const mediaType = item.attachment_type || item.media_type;
  const hasMedia = Boolean(mediaUrl);
  const isMediaOrShare = Boolean(shareInfo.isShare || hasMedia);
  const rawContent = (item.content || '').trim();
  const isDefaultMediaContent =
    !rawContent ||
    rawContent === 'Shared an image' ||
    rawContent === 'Shared a video' ||
    rawContent === 'Shared an attachment' ||
    (rawContent.startsWith('Shared ') && rawContent.endsWith(' photos'));
  const hasCaption = Boolean(rawContent && !isDefaultMediaContent);

  const renderProjectReplyQuoteBlock = (
    rMsg: any,
    isMe: boolean
  ) => {
    if (!rMsg) return null;
    const repThumb = getReplyThumbnail(rMsg);
    const prof = Array.isArray(rMsg.profiles) ? rMsg.profiles[0] : rMsg.profiles;
    const repAuthor = prof?.full_name || prof?.username || 'Crew Member';
    const snippet = getReplySnippet(rMsg, rMsg.content);

    return (
      <View
        style={{
          backgroundColor: isMe ? 'rgba(0, 0, 0, 0.18)' : (isDark ? 'rgba(255, 75, 51, 0.15)' : 'rgba(255, 75, 51, 0.1)'),
          borderLeftWidth: 3,
          borderLeftColor: isMe ? '#FFFFFF' : ORANGE,
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
              color: isMe ? '#FFFFFF' : ORANGE,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            Replying to {repAuthor}
          </Text>
          <Text
            style={{
              fontSize: 11.5,
              color: isMe ? 'rgba(255, 255, 255, 0.9)' : themeColors.textSecondary,
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

  return (
    <View
      style={[
        styles.msgWrapper,
        item.reactions && item.reactions.length > 0 && { marginBottom: 22 },
        isSelected && {
          backgroundColor: isDark ? 'rgba(255, 75, 51, 0.20)' : 'rgba(255, 75, 51, 0.12)',
          borderRadius: 14,
          paddingVertical: 4,
          paddingHorizontal: 6,
          marginTop: isSingleSelected ? 38 : 0,
        },
      ]}
    >
      {showDateSeparator && (
        <View style={styles.dateSeparatorContainer}>
          <View style={[styles.dateBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB' }]}>
            <Text style={[styles.dateBadgeText, { color: isDark ? '#E2E8F0' : '#4B5563' }]}>{getDateLabel(messageDate)}</Text>
          </View>
        </View>
      )}

      {isCallEvent ? (
        <View style={styles.callEventRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              const spaceId = resolvedSpaceId || projectId;
              if (!spaceId) {
                Alert.alert('Not Ready', 'Project space is still loading. Please try again.');
                return;
              }
              navigation.navigate('Call', {
                roomId: spaceId,
                roomName: stTitle || projectTitle || 'Project Space',
                roomType: 'project',
                isVideo: true,
              });
            }}
            style={[styles.callEventPill, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
          >
            <View
              style={[
                styles.callEventIconWrap,
                item.content?.includes('started') || item.content?.includes('Video call started')
                  ? styles.callIconGreen
                  : styles.callIconRed,
              ]}
            >
              <Icon
                name="phone"
                size={12}
                color={
                  item.content?.includes('started') || item.content?.includes('Video call started')
                    ? '#10B981'
                    : '#EF4444'
                }
              />
            </View>
            <Text style={[styles.callEventText, { color: themeColors.textPrimary }]}>
              {(item.content || '').replace('CALL::', '').replace(/^📞\s*/, '')}
            </Text>
            <Text style={[styles.callEventTime, { color: themeColors.textMuted }]}>{formatTime(messageDate)}</Text>
            <View
              style={[
                styles.callActionBadge,
                item.content?.includes('started') || item.content?.includes('Video call started')
                  ? styles.callJoinBadge
                  : [styles.callBackBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9' }],
              ]}
            >
              <Text
                style={[
                  styles.callActionText,
                  item.content?.includes('started') || item.content?.includes('Video call started')
                    ? styles.callJoinText
                    : [styles.callBackText, { color: themeColors.textSecondary }],
                ]}
              >
                {item.content?.includes('started') || item.content?.includes('Video call started')
                  ? 'Join'
                  : 'Call'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : isOwn ? (
        <SwipeableMessage
          isOwn={true}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          onPress={() => onPress(item.id)}
          onSwipeReply={() => onSwipeReply(item)}
          onDoubleTap={() => onDoubleTap(item.id, '❤️')}
          onLongPress={() => onLongPress(item)}
        >
          <View style={styles.msgRowMe}>
            {isSingleSelected && (
              <View style={[styles.floatingReactionPicker, styles.reactionPickerRight, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => onToggleReaction(item.id, emoji)}
                    style={styles.reactionEmojiBtn}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.msgColMe}>
              {isMediaOrShare ? (
                <View style={styles.transparentMediaWrapper}>
                  {replyMsg && (
                    <View style={{ marginBottom: 4, width: '100%' }}>
                      {renderProjectReplyQuoteBlock(replyMsg, true)}
                    </View>
                  )}
                  {hasMedia && (
                    <View style={{ marginBottom: 4 }}>
                      <MediaCollageGrid
                        mediaUrl={mediaUrl}
                        mediaType={mediaType}
                        onOpenImage={(url) => onOpenImageModal?.(url)}
                        onOpenFile={(url) => onOpenFile?.(url)}
                        onLongPress={() => onLongPress(item)}
                        isOwn={true}
                        overlayMeta={
                          !hasCaption ? (
                            <View style={styles.floatingMetaContent}>
                              {isStarred && <Icon name="star" size={10} color="#FBBF24" fill="#FBBF24" />}
                              <Text style={styles.floatingMetaTimeText}>
                                {formatTime(messageDate)}
                              </Text>
                            </View>
                          ) : undefined
                        }
                      />
                    </View>
                  )}
                  {shareInfo.isShare && shareInfo.data && (
                    <View style={styles.shareCardContainer}>
                      {shareInfo.caption ? (
                        <Text style={[styles.msgTextMe, { marginBottom: 6 }]}>
                          {shareInfo.caption}
                        </Text>
                      ) : null}
                      <ShareCard data={shareInfo.data} navigation={navigation} />
                      <View style={[styles.msgMetaMe, { alignSelf: 'flex-end', marginTop: 4 }]}>
                        {isStarred && <Icon name="star" size={10} color="#FBBF24" fill="#FBBF24" />}
                        <Text style={[styles.msgTimeMe, { color: '#9CA3AF' }]}>
                          {formatTime(messageDate)}
                        </Text>
                      </View>
                    </View>
                  )}
                  {hasCaption && (
                    <View
                      style={[
                        styles.bubbleMe,
                        { backgroundColor: ORANGE, marginTop: 4 },
                      ]}
                    >
                      <Text style={styles.msgTextMe}>{rawContent}</Text>
                      <View style={[styles.msgMetaMe, { alignSelf: 'flex-end', marginTop: 4 }]}>
                        {isStarred && <Icon name="star" size={10} color="#FBBF24" fill="#FBBF24" />}
                        <Text style={styles.msgTimeMe}>{formatTime(messageDate)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={[
                    styles.bubbleMe,
                    { backgroundColor: ORANGE },
                  ]}
                >
                  {replyMsg && renderProjectReplyQuoteBlock(replyMsg, true)}
                  <View style={styles.msgContentRowMe}>
                    <Text style={styles.msgTextMe}>{rawContent}</Text>
                    <View style={styles.msgMetaMe}>
                      {isStarred && <Icon name="star" size={10} color="#FBBF24" fill="#FBBF24" />}
                      <Text style={styles.msgTimeMe}>
                        {formatTime(messageDate)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Unified Reactions Pill Container - positioned cleanly below message */}
              {item.reactions && item.reactions.length > 0 && (() => {
                const reactionsList = item.reactions || [];
                const totalCount = reactionsList.length;
                if (totalCount === 0) return null;

                const uniqueEmojis: string[] = [];
                reactionsList.forEach((r: any) => {
                  if (r.emoji && !uniqueEmojis.includes(r.emoji)) {
                    uniqueEmojis.push(r.emoji);
                  }
                });

                const myReaction = reactionsList.find((r: any) => r.user_id === currentUserId);

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.unifiedReactionsPill,
                      styles.unifiedReactionsPillOwn,
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
                        onToggleReaction(item.id, myReaction.emoji);
                      } else {
                        onPress(item);
                      }
                    }}
                    onLongPress={() => onLongPress(item)}
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

              <View style={[styles.readReceiptMeRow, item.reactions && item.reactions.length > 0 && { marginTop: 4 }]}>
                <Text style={styles.readReceiptMeText}>
                  {isSeen ? `Seen by ${readByNames.slice(0, 2).join(', ')}` : 'Sent'}
                </Text>
              </View>
            </View>
          </View>
        </SwipeableMessage>
      ) : (
        <SwipeableMessage
          isOwn={false}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
          onPress={() => onPress(item.id)}
          onSwipeReply={() => onSwipeReply(item)}
          onDoubleTap={() => onDoubleTap(item.id, '❤️')}
          onLongPress={() => onLongPress(item)}
        >
          <View style={styles.msgRowOther}>
            {senderAvatar ? (
              <CachedImage source={{ uri: senderAvatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{senderInitial}</Text>
              </View>
            )}

            {isSingleSelected && (
              <View style={[styles.floatingReactionPicker, styles.reactionPickerLeft, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {QUICK_REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => onToggleReaction(item.id, emoji)}
                    style={styles.reactionEmojiBtn}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.msgColOther}>
              {isMediaOrShare ? (
                <View style={styles.transparentMediaWrapper}>
                  {replyMsg && (
                    <View style={{ marginBottom: 4, width: '100%' }}>
                      {renderProjectReplyQuoteBlock(replyMsg, false)}
                    </View>
                  )}
                  {/* Sender Name Header above media for others */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 }}>
                    <Text style={[styles.senderNameText, { color: ORANGE, fontWeight: '700', fontSize: 12 }]} numberOfLines={1}>
                      {senderName}
                    </Text>
                    {Boolean(senderCraft) && (
                      <Text style={{ fontSize: 10, color: themeColors.textMuted, marginLeft: 6 }}>
                        • {senderCraft}
                      </Text>
                    )}
                  </View>
                  {hasMedia && (
                    <View style={{ marginBottom: 4 }}>
                      <MediaCollageGrid
                        mediaUrl={mediaUrl}
                        mediaType={mediaType}
                        onOpenImage={(url) => onOpenImageModal?.(url)}
                        onOpenFile={(url) => onOpenFile?.(url)}
                        onLongPress={() => onLongPress(item)}
                        isOwn={false}
                        overlayMeta={
                          !hasCaption ? (
                            <View style={styles.floatingMetaContent}>
                              {isStarred && <Icon name="star" size={10} color="#F59E0B" fill="#F59E0B" />}
                              <Text style={styles.floatingMetaTimeText}>
                                {formatTime(messageDate)}
                              </Text>
                            </View>
                          ) : undefined
                        }
                      />
                    </View>
                  )}
                  {shareInfo.isShare && shareInfo.data && (
                    <View style={styles.shareCardContainer}>
                      {shareInfo.caption ? (
                        <Text style={[styles.msgTextOther, { color: themeColors.textPrimary, marginBottom: 6 }]}>
                          {shareInfo.caption}
                        </Text>
                      ) : null}
                      <ShareCard data={shareInfo.data} navigation={navigation} />
                    </View>
                  )}
                  {hasCaption && (
                    <View
                      style={[
                        styles.bubbleOther,
                        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, marginTop: 4 },
                      ]}
                    >
                      <Text style={[styles.msgTextOther, { color: themeColors.textPrimary }]}>{rawContent}</Text>
                      <View style={[styles.msgMetaOther, { alignSelf: 'flex-end', marginTop: 4 }]}>
                        {isStarred && <Icon name="star" size={10} color="#F59E0B" fill="#F59E0B" />}
                        <Text style={[styles.msgTimeOther, { color: themeColors.textMuted }]}>{formatTime(messageDate)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={[
                    styles.bubbleOther,
                    { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                  ]}
                >
                  {replyMsg && renderProjectReplyQuoteBlock(replyMsg, false)}
                  <View style={styles.bubbleOtherHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <View style={{ flexDirection: 'column', flexShrink: 1 }}>
                        <Text style={[styles.senderNameText, { lineHeight: 16 }]} numberOfLines={1}>
                          {senderName}
                        </Text>
                        {Boolean(senderCraft) && (
                          <Text style={{ fontSize: 9.5, color: themeColors.textMuted, marginTop: 1, lineHeight: 12 }}>
                            {senderCraft}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => onLongPress(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ opacity: 0.65, paddingTop: 1 }}
                      >
                        <Icon name="chevron-down" size={13} color={themeColors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.msgContentRowOther}>
                    <Text style={[styles.msgTextOther, { color: themeColors.textPrimary }]}>{rawContent}</Text>
                    <View style={styles.msgMetaOther}>
                      {isStarred && <Icon name="star" size={10} color="#F59E0B" fill="#F59E0B" />}
                      <Text style={[styles.msgTimeOther, { color: themeColors.textMuted }]}>{formatTime(messageDate)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Unified Reactions Pill Container - positioned cleanly below message */}
              {item.reactions && item.reactions.length > 0 && (() => {
                const reactionsList = item.reactions || [];
                const totalCount = reactionsList.length;
                if (totalCount === 0) return null;

                const uniqueEmojis: string[] = [];
                reactionsList.forEach((r: any) => {
                  if (r.emoji && !uniqueEmojis.includes(r.emoji)) {
                    uniqueEmojis.push(r.emoji);
                  }
                });

                const myReaction = reactionsList.find((r: any) => r.user_id === currentUserId);

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.unifiedReactionsPill,
                      styles.unifiedReactionsPillOther,
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
                        onToggleReaction(item.id, myReaction.emoji);
                      } else {
                        onPress(item);
                      }
                    }}
                    onLongPress={() => onLongPress(item)}
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
          </View>
        </SwipeableMessage>
      )}
    </View>
  );
}, (prev, next) => {
  if (prev.item?.id !== next.item?.id) return false;
  if (prev.item?.content !== next.item?.content) return false;
  if (prev.item?.is_deleted !== next.item?.is_deleted) return false;
  if (prev.item?.attachment_url !== next.item?.attachment_url || (prev.item as any)?.media_url !== (next.item as any)?.media_url) return false;
  if (
    prev.replyMsg?.id !== next.replyMsg?.id ||
    prev.replyMsg?.content !== next.replyMsg?.content ||
    prev.replyMsg?.attachment_url !== next.replyMsg?.attachment_url ||
    (prev.replyMsg as any)?.media_url !== (next.replyMsg as any)?.media_url
  ) {
    return false;
  }
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isSingleSelected !== next.isSingleSelected) return false;
  if (prev.isSelectionMode !== next.isSelectionMode) return false;
  if (prev.isStarred !== next.isStarred) return false;
  if (prev.showDateSeparator !== next.showDateSeparator) return false;
  if (prev.isDark !== next.isDark) return false;
  if (prev.themeColors !== next.themeColors) return false;
  if (prev.isSeen !== next.isSeen) return false;
  if (prev.senderCraft !== next.senderCraft) return false;
  if (prev.senderName !== next.senderName) return false;
  if (prev.senderAvatar !== next.senderAvatar) return false;
  if ((prev.readByNames?.length || 0) !== (next.readByNames?.length || 0)) return false;
  // Reactions: compare by length + content
  const prevRx = prev.item?.reactions;
  const nextRx = next.item?.reactions;
  if ((prevRx?.length || 0) !== (nextRx?.length || 0)) return false;
  if (prevRx?.length && nextRx?.length) {
    for (let i = 0; i < prevRx.length; i++) {
      if (prevRx[i]?.id !== nextRx[i]?.id || prevRx[i]?.emoji !== nextRx[i]?.emoji) return false;
    }
  }
  return true;
});

// ── Main Project Space Screen ────────────────────────────────────────────────
export const ProjectSpaceScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const rawProjectId = route.params?.projectId || route.params?.project_id || route.params?.spaceId || route.params?.space_id || route.params?.project_space_id || route.params?.relatedId || route.params?.id;
  const rawSpaceId = route.params?.spaceId || route.params?.space_id || route.params?.project_space_id;
  const { projectTitle, projectDescription } = route.params || {};
  const projectId = rawProjectId;
  const supabase = getSupabaseClient();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (isFan && !isInternal) {
      Alert.alert(
        'ProjectSpace Restricted',
        'Production workspace collaboration, call sheets, and budgets are reserved for verified Creator and Studio team members.',
        [{ text: 'Back to Projects', onPress: () => navigation.goBack() }]
      );
    }
  }, [isFan, isInternal, navigation]);

  // Active Sub-Tab
  type SubTabType =
    | 'Live Call'
    | 'Chat'
    | 'Tasks'
    | 'Files'
    | 'Team'
    | 'Call Sheet'
    | 'Shot List'
    | 'Script Reader'
    | 'Legal Docs'
    | 'Budget'
    | 'Applicants'
    | 'Settings';

  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('Chat');

  // Space Resolution & Auth
  const syncSpaceId = rawSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null);
  const [resolvedSpaceId, setResolvedSpaceId] = useState<string>(rawSpaceId || syncSpaceId || '');
  const initialUserId = getCurrentUserIdSync() || getCacheSync<any>('user_session')?.user?.id || null;
  const initialUserSession = getCacheSync<any>('user_session')?.user || (initialUserId ? { id: initialUserId } : null);
  const [currentUser, setCurrentUser] = useState<any>(() => initialUserSession);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => initialUserId);
  const currentUserIdRef = useRef<string | null>(initialUserId);
  const [projectData, setProjectData] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(() => {
    const cachedMap = getCacheSync<Record<string, boolean>>('projects_bookmarked_map') || {};
    return !!(projectId && (cachedMap[projectId] || (resolvedSpaceId && cachedMap[resolvedSpaceId])));
  });

  // Verify bookmark from Supabase project_space_bookmarks
  useEffect(() => {
    let active = true;
    const checkBookmark = async () => {
      try {
        const uid = currentUserId || currentUser?.id || (await resolveCurrentUserId()) || getCurrentUserIdSync();
        if (!uid || (!projectId && !resolvedSpaceId)) return;

        let effectiveSpaceId = resolvedSpaceId || syncSpaceId;
        if (!effectiveSpaceId && projectId) {
          const { data: space } = await (supabase as any)
            .from('project_spaces')
            .select('id')
            .or(`project_id.eq.${projectId},id.eq.${projectId}`)
            .limit(1)
            .maybeSingle();
          if (space?.id) effectiveSpaceId = space.id;
        }
        if (!effectiveSpaceId) return;

        const { data } = await (supabase as any)
          .from('project_space_bookmarks')
          .select('id')
          .eq('project_space_id', effectiveSpaceId)
          .eq('user_id', uid)
          .maybeSingle();

        if (active) {
          const bookmarkedNow = !!data;
          setIsBookmarked(bookmarkedNow);
          const cachedMap = getCacheSync<Record<string, boolean>>('projects_bookmarked_map') || {};
          saveCache('projects_bookmarked_map', {
            ...cachedMap,
            [projectId]: bookmarkedNow,
            [effectiveSpaceId]: bookmarkedNow,
          });
        }
      } catch (e) {
        console.warn('[ProjectSpaceScreen] Check bookmark error:', e);
      }
    };
    checkBookmark();
    return () => {
      active = false;
    };
  }, [projectId, resolvedSpaceId, syncSpaceId, currentUser?.id]);

  // Listen to cross-screen changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('projectBookmarkChanged', (event) => {
      if (event?.projectId === projectId || (resolvedSpaceId && event?.projectId === resolvedSpaceId)) {
        setIsBookmarked(!!event.isBookmarked);
      }
    });
    return () => sub.remove();
  }, [projectId, resolvedSpaceId]);

  // Realtime subscription for project_space_bookmarks
  useEffect(() => {
    const channel = supabase
      .channel(`ps_bookmark_${projectId || 'general'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_space_bookmarks' }, async () => {
        const uid = currentUserId || currentUser?.id || (await resolveCurrentUserId()) || getCurrentUserIdSync();
        if (!uid) return;
        let effectiveSpaceId = resolvedSpaceId || syncSpaceId;
        if (!effectiveSpaceId && projectId) {
          const { data: space } = await (supabase as any)
            .from('project_spaces')
            .select('id')
            .or(`project_id.eq.${projectId},id.eq.${projectId}`)
            .limit(1)
            .maybeSingle();
          if (space?.id) effectiveSpaceId = space.id;
        }
        if (!effectiveSpaceId) return;
        const { data } = await (supabase as any)
          .from('project_space_bookmarks')
          .select('id')
          .eq('project_space_id', effectiveSpaceId)
          .eq('user_id', uid)
          .maybeSingle();
        setIsBookmarked(!!data);
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch { }
    };
  }, [projectId, resolvedSpaceId, syncSpaceId, currentUser?.id, currentUserId]);

  const handleToggleBookmark = async () => {
    const uid = currentUserId || currentUser?.id || (await resolveCurrentUserId()) || getCurrentUserIdSync();
    if (!uid) {
      Alert.alert('Sign in Required', 'Please sign in to bookmark this project space.');
      return;
    }

    const nextState = !isBookmarked;
    setIsBookmarked(nextState);

    const cachedMap = getCacheSync<Record<string, boolean>>('projects_bookmarked_map') || {};
    saveCache('projects_bookmarked_map', {
      ...cachedMap,
      [projectId]: nextState,
      ...(resolvedSpaceId ? { [resolvedSpaceId]: nextState } : {}),
    });

    DeviceEventEmitter.emit('projectBookmarkChanged', { projectId, isBookmarked: nextState });

    try {
      let spaceIdToUse = resolvedSpaceId || syncSpaceId;
      if (!spaceIdToUse) {
        const { data: space } = await (supabase as any)
          .from('project_spaces')
          .select('id')
          .or(`project_id.eq.${projectId},id.eq.${projectId}`)
          .limit(1)
          .maybeSingle();
        spaceIdToUse = space?.id;
      }

      if (!spaceIdToUse) {
        // Auto-create space
        const { data: newSpace, error: createError } = await (supabase as any)
          .from('project_spaces')
          .insert({
            project_id: projectId,
            name: `${projectTitle || 'Project'} Workspace`,
            creator_id: uid,
          })
          .select('id')
          .maybeSingle();
        if (!createError && newSpace?.id) spaceIdToUse = newSpace.id;
      }

      if (!spaceIdToUse) throw new Error("Workspace not resolved");

      if (!nextState) {
        await (supabase as any)
          .from('project_space_bookmarks')
          .delete()
          .eq('project_space_id', spaceIdToUse)
          .eq('user_id', uid);
      } else {
        await (supabase as any)
          .from('project_space_bookmarks')
          .upsert(
            { project_space_id: spaceIdToUse, user_id: uid },
            { onConflict: 'user_id,project_space_id' }
          );
      }
    } catch (e) {
      console.warn('[ProjectSpaceScreen] Toggle bookmark error:', e);
      setIsBookmarked(!nextState);
      DeviceEventEmitter.emit('projectBookmarkChanged', { projectId, isBookmarked: !nextState });
    }
  };

  useFocusEffect(
    useCallback(() => {
      setActiveChatContext({
        screen: 'ProjectSpace',
        projectId,
        spaceId: resolvedSpaceId || rawSpaceId,
      });
      try {
        const { NativeModules } = require('react-native');
        if (projectId) NativeModules.NotificationBridge?.dismissNotification?.(`ProjectSpace_${projectId}`);
        if (resolvedSpaceId) NativeModules.NotificationBridge?.dismissNotification?.(`ProjectSpace_${resolvedSpaceId}`);
      } catch { }
      return () => {
        clearActiveChatContext();
      };
    }, [projectId, resolvedSpaceId, rawSpaceId])
  );

  // Global Call State for seamless Call/Chat switching
  const { callState, minimizeCall, maximizeCall } = useGlobalCall();
  const isInCall =
    callState.isActive &&
    (callState.roomId === resolvedSpaceId ||
      callState.roomId === projectId ||
      (resolvedSpaceId && callState.roomId?.includes(resolvedSpaceId)) ||
      (projectId && callState.roomId?.includes(projectId)));

  const handleSelectSubTab = useCallback(
    (tab: SubTabType) => {
      if (tab === 'Live Call') {
        maximizeCall();
        const spaceId = resolvedSpaceId || syncSpaceId || projectId;
        navigation.navigate('Call', {
          roomId: spaceId,
          roomName: projectData?.title || projectTitle || 'Project Space',
          roomType: 'project',
          isVideo: callState.isVideo || false,
        });
      } else {
        if (isInCall) {
          minimizeCall();
        }
        setActiveSubTab(tab);
      }
    },
    [maximizeCall, minimizeCall, isInCall, resolvedSpaceId, syncSpaceId, projectId, projectData?.title, projectTitle, callState.isVideo, navigation]
  );

  const handleCallPress = useCallback(() => {
    const spaceId = resolvedSpaceId || syncSpaceId || projectId;
    if (!spaceId) {
      Alert.alert('Not Ready', 'Project space is still loading.');
      return;
    }
    Alert.alert(
      `Call Crew — ${projectData?.title || projectTitle || 'Project Space'}`,
      'Choose call mode to connect with the team:',
      [
        {
          text: 'Voice Call 📞',
          onPress: () => {
            navigation.navigate('Call', {
              roomId: spaceId,
              roomName: projectData?.title || projectTitle || 'Project Space',
              roomType: 'project',
              isVideo: false,
            });
          },
        },
        {
          text: 'Video Call 📹',
          onPress: () => {
            navigation.navigate('Call', {
              roomId: spaceId,
              roomName: projectData?.title || projectTitle || 'Project Space',
              roomType: 'project',
              isVideo: true,
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, [resolvedSpaceId, syncSpaceId, projectId, projectData?.title, projectTitle, navigation]);

  // Group Encryption Hook
  const targetSpaceId = resolvedSpaceId || syncSpaceId || (isValidUUID(projectId) ? projectId : null);
  const {
    encryptGroupMessage,
    decryptGroupMessage,
    isReady,
  } = useGroupEncryption('project_space', targetSpaceId);

  // ── Chat State ─────────────────────────────────────────────────────────────
  const initialCachedMsgs = (resolvedSpaceId || syncSpaceId || projectId)
    ? (getCacheSync<any[]>(`ps_messages_${resolvedSpaceId || syncSpaceId || projectId}`) ||
      (projectId ? getCacheSync<any[]>(`ps_messages_${projectId}`) : null))
    : null;
  const [messages, setMessages] = useState<any[]>(() => initialCachedMsgs || []);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const messageMapRef = useRef<Map<string, any>>(new Map());
  useEffect(() => {
    const map = new Map<string, any>();
    messages.forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    messageMapRef.current = map;
  }, [messages]);
  const msgChannelRef = useRef<any>(null);
  const webChannelRef = useRef<any>(null);
  const lastMarkAsReadTimeRef = useRef<number>(0);
  const lastFetchReadTimeRef = useRef<number>(0);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [readStatuses, setReadStatuses] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('smileys');
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [availableDestinationsForForward, setAvailableDestinationsForForward] = useState<any[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ uri: string; name: string; type: string }>>([]);
  const [lightboxState, setLightboxState] = useState<{ visible: boolean; images: string[]; currentIndex: number }>({ visible: false, images: [], currentIndex: 0 });
  const [infoModalMessage, setInfoModalMessage] = useState<any | null>(null);

  const allImageUrls = useMemo(() => {
    const urls: string[] = [];
    messages.forEach((m: any) => {
      if (m.attachment_url && typeof m.attachment_url === 'string') {
        const trimmed = m.attachment_url.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const url = typeof item === 'string' ? item : item?.url;
                if (url && (/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(url) || (!url.match(/\.(mp4|mov|pdf|doc)$/i)))) {
                  urls.push(url);
                }
              });
            }
          } catch {
            if (/\.(jpg|jpeg|png|webp|gif)$/i.test(trimmed)) urls.push(trimmed);
          }
        } else if (m.attachment_type === 'image' || /\.(jpg|jpeg|png|webp|gif|heic)$/i.test(trimmed)) {
          urls.push(trimmed);
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
  const inputRef = useRef<TextInput>(null);
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(() => !initialCachedMsgs || initialCachedMsgs.length === 0);
  const isFetchingMsgsRef = useRef<boolean>(false);
  const lastFetchMsgsTimeRef = useRef<number>(0);
  const lastFetchedSpaceIdRef = useRef<string>('');
  const shouldScrollToEndRef = useRef<boolean>(true);

  // ── Tasks State ────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // ── Files State ────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<any[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocModalVisible, setNewDocModalVisible] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('Lookbook');

  // ── Team State ─────────────────────────────────────────────────────────────
  const initialCachedTeam = (resolvedSpaceId || syncSpaceId || projectId)
    ? (getCacheSync<any[]>(`ps_team_${resolvedSpaceId || syncSpaceId || projectId}`) ||
      (projectId ? getCacheSync<any[]>(`ps_team_${projectId}`) : null))
    : null;
  const [teamMembers, setTeamMembers] = useState<any[]>(() => initialCachedTeam || []);
  const teamMemberMap = useMemo(() => {
    const map = new Map<string, any>();
    (teamMembers || []).forEach((m: any) => {
      if (m.id) map.set(m.id, m);
      if (m.user_id) map.set(m.user_id, m);
    });
    return map;
  }, [teamMembers]);
  const [teamSearch, setTeamSearch] = useState('');
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [tempCrewRole, setTempCrewRole] = useState<string>('');

  // ── Call Sheet State ───────────────────────────────────────────────────────
  const [callSheets, setCallSheets] = useState<any[]>([]);
  const [newCallSheetModalVisible, setNewCallSheetModalVisible] = useState(false);
  const [csDate, setCsDate] = useState(new Date().toISOString().split('T')[0]);
  const [csCallTime, setCsCallTime] = useState('06:00 AM');
  const [csLocation, setCsLocation] = useState('Stage 4, Central Studios');
  const [csDirector, setCsDirector] = useState('Director Lead');
  const [csProducer, setCsProducer] = useState('Lead Producer');
  const [csNotes, setCsNotes] = useState('Principal Photography - Scene 14 & 15');
  const [creatingCallSheet, setCreatingCallSheet] = useState(false);

  // ── Shot List State ────────────────────────────────────────────────────────
  const [shots, setShots] = useState<any[]>([]);
  const [newScene, setNewScene] = useState('1');
  const [newShot, setNewShot] = useState('1');
  const [newShotDesc, setNewShotDesc] = useState('');
  const [addingShot, setAddingShot] = useState(false);

  // ── Script Reader State ────────────────────────────────────────────────────
  const [currentSceneIdx, setCurrentSceneIdx] = useState(14);
  const totalScriptScenes = 42;

  // ── Legal Docs State ───────────────────────────────────────────────────────
  const [legalDocs, setLegalDocs] = useState<any[]>([]);
  const [newLegalDocModalVisible, setNewLegalDocModalVisible] = useState(false);
  const [ldTitle, setLdTitle] = useState('');
  const [ldType, setLdType] = useState('NDA');
  const [ldDescription, setLdDescription] = useState('');
  const [creatingLegalDoc, setCreatingLegalDoc] = useState(false);

  // ── Budget State ───────────────────────────────────────────────────────────
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [newBudgetItemName, setNewBudgetItemName] = useState('');
  const [newBudgetCost, setNewBudgetCost] = useState('');
  const [newBudgetCategory, setNewBudgetCategory] = useState('Production');
  const [addingBudgetItem, setAddingBudgetItem] = useState(false);

  // ── Applicants State ───────────────────────────────────────────────────────
  const [applicants, setApplicants] = useState<any[]>([]);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);

  // ── Settings State ─────────────────────────────────────────────────────────
  const [isSettingsMenu, setIsSettingsMenu] = useState(true);
  const [settingsStep, setSettingsStep] = useState<'basis' | 'financials' | 'privacy' | 'danger'>('basis');
  const [stTitle, setStTitle] = useState(projectTitle || '');
  const [stDescription, setStDescription] = useState(projectDescription || '');
  const [stStatus, setStStatus] = useState('active');
  const [stOriginalStatus, setStOriginalStatus] = useState('active');
  const [stLocation, setStLocation] = useState('');
  const [stGenre, setStGenre] = useState('');
  const [stRequiredRoles, setStRequiredRoles] = useState<string[]>([]);
  const [stStartDate, setStStartDate] = useState('');
  const [stEndDate, setStEndDate] = useState('');
  const [stBudgetMin, setStBudgetMin] = useState('');
  const [stBudgetMax, setStBudgetMax] = useState('');
  const [stIsPublic, setStIsPublic] = useState(false);
  const [stImageUrl, setStImageUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showWrapDialog, setShowWrapDialog] = useState(false);
  const [wrapCrewList, setWrapCrewList] = useState<any[]>([]);

  // ── Per-Space Notification Preferences ────────────────────────────────────
  const [spaceNotifMute, setSpaceNotifMute] = useState(false);
  const [spaceNotifMentionsOnly, setSpaceNotifMentionsOnly] = useState(false);
  const [spaceNotifSoundAlerts, setSpaceNotifSoundAlerts] = useState(true);

  const availableRoles = [
    'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
    'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
    'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
  ];

  const handleRoleToggle = (role: string) => {
    setStRequiredRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Load per-space notification preferences from AsyncStorage
  useEffect(() => {
    if (!targetSpaceId) return;
    (async () => {
      try {
        const uid = currentUser?.id || getCurrentUserIdSync() || 'anonymous';
        const raw = await AsyncStorage.getItem(`@space_notif_${targetSpaceId}_${uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.muteSpace !== undefined) setSpaceNotifMute(parsed.muteSpace);
          if (parsed.mentionsOnly !== undefined) setSpaceNotifMentionsOnly(parsed.mentionsOnly);
          if (parsed.soundAlerts !== undefined) setSpaceNotifSoundAlerts(parsed.soundAlerts);
        }
      } catch { }
    })();
  }, [targetSpaceId, currentUser?.id]);

  const saveSpaceNotifPrefs = async (newMute: boolean, newMentions: boolean, newSound: boolean) => {
    if (!targetSpaceId) return;
    try {
      const uid = currentUser?.id || getCurrentUserIdSync() || 'anonymous';
      const payload = JSON.stringify({
        muteSpace: newMute,
        mentionsOnly: newMentions,
        soundAlerts: newSound,
      });
      await AsyncStorage.setItem(`@space_notif_${targetSpaceId}_${uid}`, payload);
      await AsyncStorage.setItem(`@space_notif_${targetSpaceId}`, payload);
    } catch (err) {
      console.warn('Error saving space notification preferences:', err);
    }
  };

  const fetchTeamImpl = useCallback(async (explicitSpaceId?: string) => {
    let spaceId = explicitSpaceId || resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null);
    if (!spaceId && projectId && isValidUUID(projectId)) {
      try {
        const { data: space } = await supabase
          .from('project_spaces')
          .select('id')
          .or(`project_id.eq.${projectId},id.eq.${projectId}`)
          .limit(1)
          .maybeSingle();
        if (space?.id) {
          spaceId = space.id;
          saveCache(`ps_space_id_${projectId}`, space.id).catch(() => {});
        }
      } catch {}
    }
    if (!spaceId) spaceId = projectId;
    if (!spaceId) return;

    try {
      const validSpace = isValidUUID(spaceId);
      const validProj = isValidUUID(projectId);

      // 1. Query project_space_members with profiles
      let query = supabase
        .from('project_space_members' as any)
        .select(`
          project_space_id,
          user_id,
          role,
          created_at,
          profiles!user_id (
            id,
            full_name,
            username,
            avatar_url,
            craft,
            is_verified
          )
        `);

      if (validSpace && validProj && spaceId !== projectId) {
        query = query.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
      } else if (validSpace) {
        query = query.eq('project_space_id', spaceId);
      } else if (validProj) {
        query = query.eq('project_space_id', projectId);
      }

      const queryRes: any = await query;
      let memberRows: any[] = Array.isArray(queryRes?.data) ? [...queryRes.data] : [];

      // Fallback: If PostgREST join failed, query project_space_members without join
      if (queryRes?.error || memberRows.length === 0) {
        let rawQuery = supabase
          .from('project_space_members' as any)
          .select('project_space_id, user_id, role, created_at');

        if (validSpace && validProj && spaceId !== projectId) {
          rawQuery = rawQuery.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
        } else if (validSpace) {
          rawQuery = rawQuery.eq('project_space_id', spaceId);
        } else if (validProj) {
          rawQuery = rawQuery.eq('project_space_id', projectId);
        }

        const rawRes: any = await rawQuery;
        if (rawRes?.data && rawRes.data.length > 0) {
          const uids = rawRes.data.map((r: any) => r.user_id).filter(Boolean);
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, is_verified')
            .in('id', uids);

          const profMap = new Map<string, any>();
          (profs || []).forEach((p: any) => profMap.set(p.id, p));

          memberRows = rawRes.data.map((r: any) => ({
            ...r,
            profiles: profMap.get(r.user_id) || null,
          }));
        }
      }

      // Also ensure profiles are populated if any were null in joined result
      if (memberRows.length > 0) {
        const missingUserIds = memberRows
          .filter((m: any) => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return !p || !p.full_name;
          })
          .map((m: any) => m.user_id)
          .filter(Boolean);

        if (missingUserIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, is_verified')
            .in('id', missingUserIds);

          if (profs && profs.length > 0) {
            const profMap = new Map<string, any>();
            profs.forEach((p: any) => profMap.set(p.id, p));
            memberRows = memberRows.map((m: any) => {
              const existingProf = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return {
                ...m,
                profiles: existingProf || profMap.get(m.user_id) || null,
              };
            });
          }
        }

        // Also fetch project creator if not already present
        let creatorId = projectData?.creator_id;
        if (!creatorId && validProj) {
          const { data: projRow } = await supabase
            .from('projects')
            .select('creator_id')
            .eq('id', projectId)
            .maybeSingle();
          creatorId = projRow?.creator_id;
        }

        const memberUserIds = new Set(memberRows.map((m: any) => m.user_id));
        if (creatorId && !memberUserIds.has(creatorId)) {
          const { data: creatorProf } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, is_verified')
            .eq('id', creatorId)
            .maybeSingle();

          if (creatorProf) {
            memberRows.unshift({
              project_space_id: spaceId,
              user_id: creatorId,
              role: 'Director',
              profiles: creatorProf,
            });
          }
        }

        const mapped = memberRows.map((m: any) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const effectiveCraft =
            (m.role && m.role !== 'Crew' && m.role !== 'member' && m.role !== 'Leader' ? m.role : null) ||
            p?.craft ||
            (m.role ? m.role : 'Filmmaker');
          if (m.user_id && effectiveCraft) {
            saveCache(`user_craft_${m.user_id}`, effectiveCraft).catch(() => {});
          }
          return {
            id: m.user_id,
            user_id: m.user_id,
            role: m.role || 'Crew',
            full_name: p?.full_name || p?.username || 'Crew Member',
            username: p?.username || '',
            avatar_url: p?.avatar_url || '',
            craft: effectiveCraft || 'Filmmaker',
            is_verified: p?.is_verified || false,
          };
        });

        setTeamMembers(mapped);
        saveCache(`ps_team_${spaceId}`, mapped).catch(() => {});
        if (projectId && projectId !== spaceId) {
          saveCache(`ps_team_${projectId}`, mapped).catch(() => {});
        }
      } else if (currentUser) {
        const myCraft = (currentUser as any)?.craft || currentUser.user_metadata?.craft || 'Director';
        const defaultTeam = [
          {
            id: currentUser.id,
            user_id: currentUser.id,
            role: 'Leader',
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Project Leader',
            username: currentUser.email?.split('@')[0] || 'leader',
            avatar_url: currentUser.user_metadata?.avatar_url || '',
            craft: myCraft || 'Director',
            is_verified: true,
          },
        ];
        if (currentUser.id && myCraft) {
          saveCache(`user_craft_${currentUser.id}`, myCraft).catch(() => {});
        }
        setTeamMembers(defaultTeam);
        saveCache(`ps_team_${spaceId}`, defaultTeam).catch(() => {});
      }
    } catch (err) {
      console.warn('Error fetching team members:', err);
    }
  }, [resolvedSpaceId, projectId, currentUser, projectData?.creator_id]);

  // Several mount effects (initialize, focus, space-resolved) all ask for the team within the same tick.
  // Share one in-flight request instead of running the multi-query chain 3-4 times.
  const teamInflightRef = useRef<{ key: string; promise: Promise<void> | null }>({ key: '', promise: null });
  const fetchTeam = useCallback(
    (explicitSpaceId?: string): Promise<void> => {
      const key = explicitSpaceId || resolvedSpaceId || projectId || '';
      const current = teamInflightRef.current;
      if (current.promise && current.key === key) return current.promise;
      const promise: Promise<void> = fetchTeamImpl(explicitSpaceId).finally(() => {
        if (teamInflightRef.current.promise === promise) teamInflightRef.current = { key, promise: null };
      });
      teamInflightRef.current = { key, promise };
      return promise;
    },
    [fetchTeamImpl, resolvedSpaceId, projectId]
  );

  // ── Initial Setup & Automatic Space Resolution ──────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        let userObj: any = null;
        const { data: sessData } = await supabase.auth.getSession();
        userObj = sessData?.session?.user || null;
        if (!userObj) {
          const cachedSession = await getCache<any>('user_session');
          userObj = cachedSession?.user || null;
        }
        const resolvedUid = userObj?.id || (await resolveCurrentUserId()) || getCurrentUserIdSync();
        if (resolvedUid) {
          setCachedCurrentUserId(resolvedUid);
          currentUserIdRef.current = resolvedUid;
          if (isMounted) {
            setCurrentUserId(resolvedUid);
          }
        }
        if (userObj && isMounted) {
          setCurrentUser(userObj);
        }

        if (projectId) {
          // Check cached project data first for instant offline rendering
          const cachedProj = await getCache<any>(`project_${projectId}`);
          if (cachedProj && isMounted) {
            setProjectData(cachedProj);
            setStTitle(cachedProj.title || '');
            setStDescription(cachedProj.description || '');
            setStRequiredRoles(cachedProj.required_roles || []);
          }

          // 1. Fetch project details in parallel with space resolution (it was blocking the chat fetch)
          const projectPromise = (async () => {
          if (isValidUUID(projectId)) {
            const { data: proj } = await supabase
              .from('projects')
              .select('*')
              .eq('id', projectId)
              .maybeSingle();

            if (proj && isMounted) {
              saveCache(`project_${projectId}`, proj).catch(() => { });
              setProjectData(proj);
              setStTitle(proj.title || '');
              setStDescription(proj.description || '');
              setStStatus(proj.status || 'active');
              setStOriginalStatus(proj.status || 'active');
              setStLocation(proj.location || '');
              setStGenre(proj.genre ? (Array.isArray(proj.genre) ? proj.genre.join(', ') : proj.genre) : '');
              setStRequiredRoles(proj.required_roles || []);
              setStStartDate(proj.start_date || '');
              setStEndDate(proj.end_date || '');
              setStBudgetMin(proj.budget_min ? proj.budget_min.toString() : '');
              setStBudgetMax(proj.budget_max ? proj.budget_max.toString() : '');
              setStIsPublic(proj.is_public || false);
              setStImageUrl(proj.image_url || null);
            }
          } else if (projectTitle) {
            const { data: proj } = await supabase
              .from('projects')
              .select('*')
              .ilike('title', `%${projectTitle}%`)
              .maybeSingle();

            if (proj && isMounted) {
              saveCache(`project_${projectId}`, proj).catch(() => { });
              setProjectData(proj);
              setStTitle(proj.title || '');
              setStDescription(proj.description || '');
              setStRequiredRoles(proj.required_roles || []);
              setStStatus(proj.status || 'active');
              setStOriginalStatus(proj.status || 'active');
            }
          }
          })().catch((e) => console.warn('ProjectSpace project load error:', e));

          // 2. Resolve or auto-create project space ID (0ms cached lookup)
          let finalSpaceId: string = syncSpaceId || '';
          if (!finalSpaceId && projectId) {
            const cachedSpaceId = await getCache<string>(`ps_space_id_${projectId}`);
            if (cachedSpaceId) {
              finalSpaceId = cachedSpaceId;
            }
          }

          let earlyFetchStarted = false;
          if (finalSpaceId) {
            if (isMounted) setResolvedSpaceId(finalSpaceId);
            // Space already known (cached): start loading chat/team now, don't wait on project + membership.
            if (isMounted) {
              earlyFetchStarted = true;
              fetchMessagesRef.current(true, finalSpaceId);
              fetchReadStatusesRef.current(finalSpaceId);
              fetchTeamRef.current(finalSpaceId);
            }
          } else if (isValidUUID(projectId)) {
            const { data: space } = await supabase
              .from('project_spaces')
              .select('id')
              .or(`project_id.eq.${projectId},id.eq.${projectId}`)
              .maybeSingle();

            if (space?.id) {
              finalSpaceId = space.id;
              saveCache(`ps_space_id_${projectId}`, finalSpaceId).catch(() => { });
            } else {
              // Auto-create space
              const { data: newSpace } = await supabase
                .from('project_spaces')
                .insert({
                  project_id: projectId,
                  name: 'General',
                  creator_id: userObj?.id || null,
                })
                .select('id')
                .maybeSingle();

              if (newSpace?.id) {
                finalSpaceId = newSpace.id;
                saveCache(`ps_space_id_${projectId}`, finalSpaceId).catch(() => { });
              }
            }

            if (isMounted && finalSpaceId) {
              setResolvedSpaceId(finalSpaceId);
            }
          }

          // 3. Ensure current user has membership in project_space_members
          let membershipGranted = false;
          if (userObj?.id && finalSpaceId && isValidUUID(finalSpaceId)) {
            const { data: member } = await supabase
              .from('project_space_members' as any)
              .select('user_id')
              .eq('project_space_id', finalSpaceId)
              .eq('user_id', userObj.id)
              .maybeSingle();

            if (!member) {
              await supabase.from('project_space_members' as any).upsert(
                {
                  project_space_id: finalSpaceId,
                  user_id: userObj.id,
                  role: 'Leader',
                },
                { onConflict: 'project_space_id,user_id', ignoreDuplicates: true }
              );
              membershipGranted = true;
            }
          }

          // 4. Trigger message fetch if it has not started yet, or re-run it if membership was just granted
          //    (an earlier fetch would have been blocked by RLS).
          if (isMounted && (!earlyFetchStarted || membershipGranted)) {
            fetchMessagesRef.current(true, finalSpaceId);
            fetchReadStatusesRef.current(finalSpaceId);
            fetchTeamRef.current(finalSpaceId);
          }
          await projectPromise;
        }
      } catch (err) {
        console.warn('ProjectSpace initialize error:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    initialize();
    return () => {
      isMounted = false;
    };
  }, [projectId, projectTitle]);

  // Ensure team members (and their craft/roles) are loaded for the chat message header
  useEffect(() => {
    if (resolvedSpaceId || projectId) {
      fetchTeamRef.current(resolvedSpaceId || projectId);
    }
  }, [resolvedSpaceId, projectId]);

  // ── Fetch & Subscribe: Chat Messages (WhatsApp-style 15-msg pagination) ────
  const PAGE_SIZE = 15;

  const decryptMessages = useCallback(async (raw: any[]): Promise<any[]> => {
    return Promise.all(
      raw.map(async (m: any) => {
        let content = m.content;
        const isCallMsg = m.attachment_type === 'call_event' || (m.content && m.content.startsWith('📞'));
        const isShareCard = content && (
          content.startsWith('POST_SHARE::') ||
          content.startsWith('JOB_SHARE::') ||
          content.startsWith('PROJECT_SHARE::') ||
          content.startsWith('PROFILE_SHARE::') ||
          content.startsWith('MARKETPLACE_SHARE::')
        );
        if (!isCallMsg && !isShareCard && content) {
          try {
            const dec = await decryptGroupMessage(m.content);
            if (dec && !dec.startsWith('🔒 Encrypted message (key loading')) {
              content = dec;
            }
          } catch { /* fallback */ }
        }
        return { ...m, content: content || m.content || '', reactions: m.reactions || [] };
      })
    );
  }, [decryptGroupMessage]);

  const attachReactions = useCallback(async (fetchedMessages: any[]): Promise<any[]> => {
    const messageIds = fetchedMessages.map((m: any) => m.id);
    let reactionsMap: Record<string, any[]> = {};
    if (messageIds.length > 0) {
      const { data: reactionsData } = await supabase
        .from('project_space_message_reactions' as any)
        .select('id, message_id, emoji, user_id')
        .in('message_id', messageIds);
      if (reactionsData) {
        reactionsData.forEach((r: any) => {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          reactionsMap[r.message_id].push(r);
        });
      }
    }
    return fetchedMessages.map((m: any) => ({ ...m, reactions: reactionsMap[m.id] || [] }));
  }, []);

  const fetchMessages = useCallback(async (force = false, explicitSpaceId?: string) => {
    let spaceId = explicitSpaceId || resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null);

    // If spaceId not resolved yet, quickly resolve it so we don't query with the wrong ID
    if (!spaceId && projectId && isValidUUID(projectId)) {
      try {
        const { data: space } = await supabase
          .from('project_spaces')
          .select('id')
          .or(`project_id.eq.${projectId},id.eq.${projectId}`)
          .limit(1)
          .maybeSingle();
        if (space?.id) {
          spaceId = space.id;
          saveCache(`ps_space_id_${projectId}`, space.id).catch(() => {});
          setResolvedSpaceId(space.id);
        }
      } catch {}
    }
    if (!spaceId) spaceId = projectId;
    if (!spaceId) {
      setLoadingMessages(false);
      return;
    }

    const now = Date.now();
    const spaceChanged = lastFetchedSpaceIdRef.current !== spaceId;
    if (!force && !spaceChanged && now - lastFetchMsgsTimeRef.current < 2500) return;
    if (isFetchingMsgsRef.current && !force && !spaceChanged) return;
    isFetchingMsgsRef.current = true;
    lastFetchMsgsTimeRef.current = now;
    lastFetchedSpaceIdRef.current = spaceId;

    // Fast check for L2 AsyncStorage cache if memory was empty or space changed
    const cached = (await getCache<any[]>(`ps_messages_${spaceId}`)) ||
      (projectId && spaceId !== projectId ? await getCache<any[]>(`ps_messages_${projectId}`) : null);
    if (cached && cached.length > 0 && (messages.length === 0 || spaceChanged)) {
      setMessages(cached);
      setLoadingMessages(false);
    }

    try {
      const validSpace = isValidUUID(spaceId);
      const validProj = isValidUUID(projectId);

      if (!validSpace && !validProj) {
        // Fallback for demo/sample projects without database records
        if (!cached || cached.length === 0) {
          setMessages(SAMPLE_SPACE_MESSAGES);
          saveCache(`ps_messages_${spaceId}`, SAMPLE_SPACE_MESSAGES).catch(() => { });
        }
        setLoadingMessages(false);
        return;
      }

      let query = supabase
        .from('project_space_messages')
        .select(`
          id, content, user_id, created_at, is_deleted, reply_to_id,
          attachment_url, attachment_type,
          profiles!user_id (username, full_name, avatar_url, craft)
        `);

      if (validSpace && validProj && spaceId !== projectId) {
        query = query.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
      } else if (validSpace) {
        query = query.eq('project_space_id', spaceId);
      } else {
        query = query.eq('project_space_id', projectId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      let fetchedMessages = (data || []).reverse(); // oldest first

      if (error) {
        console.warn('Error fetching project_space_messages:', error);
        // Fallback: query without profiles join
        let rawQuery = supabase
          .from('project_space_messages')
          .select('id, content, user_id, created_at, is_deleted, reply_to_id, attachment_url, attachment_type');

        if (validSpace && validProj && spaceId !== projectId) {
          rawQuery = rawQuery.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
        } else if (validSpace) {
          rawQuery = rawQuery.eq('project_space_id', spaceId);
        } else {
          rawQuery = rawQuery.eq('project_space_id', projectId);
        }

        const { data: rawData } = await rawQuery
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (rawData && rawData.length > 0) {
          const uids = rawData.map((m: any) => m.user_id).filter(Boolean);
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, craft')
            .in('id', uids);
          const profMap = new Map<string, any>();
          (profs || []).forEach((p: any) => profMap.set(p.id, p));

          fetchedMessages = rawData.map((m: any) => ({
            ...m,
            profiles: profMap.get(m.user_id) || null,
          })).reverse();
        } else if (!fetchedMessages.length) {
          setLoadingMessages(false);
          return;
        }
      }

      setHasMoreOlder(fetchedMessages.length === PAGE_SIZE);
      // Don't block the first paint on the reactions round-trip: render with whatever reactions we already
      // have, then merge the fresh ones in when they arrive.
      const reactionsPromise = attachReactions(fetchedMessages).catch(() => null);
      const withReactions = fetchedMessages.map((m: any) => ({
        ...m,
        reactions: messageMapRef.current.get(m.id)?.reactions || [],
      }));
      const mergeFreshReactions = async () => {
        const fresh = await reactionsPromise;
        if (!fresh) return;
        const byId = new Map<string, any[]>();
        fresh.forEach((m: any) => byId.set(m.id, m.reactions || []));
        setMessages((prev) => {
          const next = prev.map((m: any) => (byId.has(m.id) ? { ...m, reactions: byId.get(m.id) } : m));
          saveCache(`ps_messages_${spaceId}`, next).catch(() => { });
          return next;
        });
      };

      // Build a map of already-decrypted messages from memory & cache (0ms)
      const existingDecryptedMap = new Map<string, string>();
      messages.forEach((m) => {
        if (m.id && m.content && !m.content.startsWith('{"version":2') && !m.content.startsWith('🔒')) {
          existingDecryptedMap.set(m.id, m.content);
        }
      });
      if (cached && Array.isArray(cached)) {
        cached.forEach((m) => {
          if (m.id && m.content && !m.content.startsWith('{"version":2') && !m.content.startsWith('🔒')) {
            existingDecryptedMap.set(m.id, m.content);
          }
        });
      }

      const attachCraftToMsgs = (msgList: any[]) => {
        return msgList.map((m: any) => {
          const mUid = m.user_id || m.sender_id || m.senderId;
          const mem = teamMemberMap.get(mUid);
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const cachedUserCraft = mUid ? getCacheSync<string>(`user_craft_${mUid}`) : null;
          const craft =
            (mem?.role && mem.role !== 'Crew' && mem.role !== 'member' && mem.role !== 'Leader' ? mem.role : null) ||
            p?.craft ||
            cachedUserCraft ||
            mem?.craft ||
            (mem?.role && mem.role !== 'Crew' ? mem.role : null) ||
            m.senderCraft ||
            null;
          return {
            ...m,
            senderCraft: craft,
          };
        });
      };

      // Pre-populate with existing decrypted content where available (0ms)
      const partiallyDecrypted = withReactions.map((m: any) => {
        if (existingDecryptedMap.has(m.id)) {
          return { ...m, content: existingDecryptedMap.get(m.id) };
        }
        return m;
      });

      // Check if any messages still actually need E2EE group decryption
      const hasEncrypted = partiallyDecrypted.some(
        (m: any) => m.content && (m.content.startsWith('{"version":2') || m.content.includes('"type":"group"') || m.content.includes('__e2ee'))
      );

      if (hasEncrypted) {
        // Render already-decrypted content right now (0ms)
        const partialWithCraft = attachCraftToMsgs(partiallyDecrypted);
        setMessages(partialWithCraft);
        setLoadingMessages(false);

        // Only decrypt messages that actually need it
        const decrypted = await decryptMessages(partiallyDecrypted);
        const finalMsgs = attachCraftToMsgs(decrypted);
        setMessages(finalMsgs);
        saveCache(`ps_messages_${spaceId}`, finalMsgs).catch(() => { });
        if (projectId && projectId !== spaceId) {
          saveCache(`ps_messages_${projectId}`, finalMsgs).catch(() => { });
        }
        mergeFreshReactions();
      } else {
        // 100% of messages already decrypted! Instant 0ms update!
        const finalMsgs = attachCraftToMsgs(partiallyDecrypted);
        setMessages(finalMsgs);
        setLoadingMessages(false);
        saveCache(`ps_messages_${spaceId}`, finalMsgs).catch(() => { });
        if (projectId && projectId !== spaceId) {
          saveCache(`ps_messages_${projectId}`, finalMsgs).catch(() => { });
        }
        mergeFreshReactions();
      }
    } catch (err) {
      console.warn('Error in fetchMessages:', err);
    } finally {
      isFetchingMsgsRef.current = false;
      setLoadingMessages(false);
    }
  }, [resolvedSpaceId, projectId, decryptMessages, attachReactions, teamMemberMap]);

  // Re-decrypt messages when group E2EE key becomes available
  useEffect(() => {
    if (isReady && messages.length > 0) {
      const hasEncrypted = messages.some(
        (m) =>
          m.content &&
          (m.content.startsWith('{"version":2') ||
            m.content.includes('"type":"group"') ||
            m.content.includes('__e2ee') ||
            m.content.startsWith('🔒') ||
            m.content.includes('key loading'))
      );
      if (hasEncrypted) {
        decryptMessages(messages).then((dec) => {
          setMessages(dec);
          const sId = targetSpaceId;
          if (sId) {
            saveCache(`ps_messages_${sId}`, dec).catch(() => { });
          }
        });
      }
    }
  }, [isReady, decryptMessages, targetSpaceId]);

  const fetchOlderMessages = useCallback(async () => {
    const spaceId = resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null) || projectId;
    if (!spaceId || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldestTimestamp = messages[0].created_at;
      const validSpace = isValidUUID(spaceId);
      const validProj = isValidUUID(projectId);

      let query = supabase
        .from('project_space_messages')
        .select(`
          id, content, user_id, created_at, is_deleted, reply_to_id,
          attachment_url, attachment_type,
          profiles!user_id (username, full_name, avatar_url, craft)
        `);

      if (validSpace && validProj && spaceId !== projectId) {
        query = query.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
      } else if (validSpace) {
        query = query.eq('project_space_id', spaceId);
      } else if (validProj) {
        query = query.eq('project_space_id', projectId);
      } else {
        setHasMoreOlder(false);
        setLoadingOlder(false);
        return;
      }

      const { data, error } = await query
        .lt('created_at', oldestTimestamp)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      let older = (data || []).reverse();

      if (error) {
        let rawQuery = supabase
          .from('project_space_messages')
          .select('id, content, user_id, created_at, is_deleted, reply_to_id, attachment_url, attachment_type');

        if (validSpace && validProj && spaceId !== projectId) {
          rawQuery = rawQuery.or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);
        } else if (validSpace) {
          rawQuery = rawQuery.eq('project_space_id', spaceId);
        } else if (validProj) {
          rawQuery = rawQuery.eq('project_space_id', projectId);
        }

        const { data: rawData } = await rawQuery
          .lt('created_at', oldestTimestamp)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (rawData && rawData.length > 0) {
          const uids = rawData.map((m: any) => m.user_id).filter(Boolean);
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, craft')
            .in('id', uids);
          const profMap = new Map<string, any>();
          (profs || []).forEach((p: any) => profMap.set(p.id, p));

          older = rawData.map((m: any) => ({
            ...m,
            profiles: profMap.get(m.user_id) || null,
          })).reverse();
        }
      }

      if (older && older.length > 0) {
        setHasMoreOlder(older.length === PAGE_SIZE);
        const withReactions = await attachReactions(older);
        const decrypted = await decryptMessages(withReactions);
        setMessages((prev) => [...decrypted, ...prev]);
      } else {
        setHasMoreOlder(false);
      }
    } catch (err) {
      console.warn('Error in fetchOlderMessages:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [resolvedSpaceId, projectId, loadingOlder, hasMoreOlder, messages, decryptMessages, attachReactions]);

  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  const fetchReadStatuses = useCallback(async (explicitSpaceId?: string) => {
    let spaceId = explicitSpaceId || resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null);
    if (!spaceId && projectId && isValidUUID(projectId)) {
      spaceId = (await getCache<string>(`ps_space_id_${projectId}`)) || spaceId;
    }
    if (!spaceId || !isValidUUID(spaceId)) return;
    const now = Date.now();
    if (now - lastFetchReadTimeRef.current < 2000) return;
    lastFetchReadTimeRef.current = now;

    try {
      const { data } = await supabase
        .from('project_message_read_status')
        .select('user_id, last_read_at, profiles:user_id(full_name, username, avatar_url)')
        .eq('project_space_id', spaceId);

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
              profiles: prof || profMap[rs.user_id] || null,
            };
          });
          setReadStatuses(merged);
          return;
        }

        const normalized = data.map((rs: any) => ({
          ...rs,
          profiles: Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles,
        }));
        setReadStatuses(normalized);
      } else if (data) {
        setReadStatuses(data);
      }
    } catch (err) {
      console.warn('Error fetching read statuses:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchReadStatusesRef = useRef(fetchReadStatuses);
  fetchReadStatusesRef.current = fetchReadStatuses;

  const markAsRead = useCallback(async (explicitSpaceId?: string) => {
    let spaceId = explicitSpaceId || resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null);
    if (!spaceId && projectId && isValidUUID(projectId)) {
      spaceId = (await getCache<string>(`ps_space_id_${projectId}`)) || spaceId;
    }
    const uid = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
    if (!spaceId || !uid || !isValidUUID(spaceId)) return;

    const now = Date.now();
    if (now - lastMarkAsReadTimeRef.current < 2500) return;
    lastMarkAsReadTimeRef.current = now;

    try {
      const nowIso = new Date().toISOString();

      // Optimistically update local readStatuses
      setReadStatuses((prev) => {
        const existingIdx = prev.findIndex((rs) => rs.user_id === uid);
        const myProfile = currentUser;
        const newEntry = {
          project_space_id: spaceId,
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
        .from('project_message_read_status')
        .upsert(
          {
            project_space_id: spaceId,
            user_id: uid,
            last_read_at: nowIso,
          },
          { onConflict: 'project_space_id,user_id' }
        );

      // Call mark_project_message_as_seen RPC with latest message as robust fallback
      try {
        const msgs = messagesRef.current;
        if (msgs && msgs.length > 0) {
          const latest = msgs[msgs.length - 1];
          if (latest?.id && isValidUUID(latest.id)) {
            await (supabase.rpc as any)('mark_project_message_as_seen', {
              p_message_id: latest.id,
              p_user_id: uid,
            });
          }
        }
      } catch { }

      // Broadcast read_update so web and other devices immediately see "Seen by <User>"
      try {
        const payload = {
          userId: uid,
          user_id: uid,
          spaceId,
          project_space_id: spaceId,
          last_read_at: nowIso,
          profile: currentUser,
        };
        if (webChannelRef.current) {
          webChannelRef.current.send({
            type: 'broadcast',
            event: 'read_update',
            payload,
          }).catch(() => { });
        }
        if (msgChannelRef.current) {
          msgChannelRef.current.send({
            type: 'broadcast',
            event: 'read_update',
            payload,
          }).catch(() => { });
        }
      } catch { }
    } catch (err) {
      // Ignore
    }
  }, [resolvedSpaceId, projectId, currentUser, currentUserId]);

  const markAsReadRef = useRef(markAsRead);
  markAsReadRef.current = markAsRead;

  const fetchTeamRef = useRef(fetchTeam);
  fetchTeamRef.current = fetchTeam;

  // Refresh chat messages and read statuses whenever returning from a call or refocusing
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        const spaceId = resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null) || projectId;
        if (spaceId) {
          fetchMessagesRef.current(false, spaceId);
          fetchReadStatusesRef.current(spaceId);
          markAsReadRef.current(spaceId);
          fetchTeamRef.current(spaceId);
        }
      });
      return () => {
        task.cancel();
      };
    }, [resolvedSpaceId, projectId])
  );

  useEffect(() => {
    const spaceId = resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null) || projectId;
    if (spaceId) {
      fetchMessagesRef.current(false, spaceId);
      fetchReadStatusesRef.current(spaceId);
      markAsReadRef.current(spaceId);
      fetchTeamRef.current(spaceId);

      // Realtime subscription for messages and read updates
      const msgChannel = supabase
        .channel(`ps_messages:${spaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_space_messages',
            ...(isValidUUID(spaceId) ? { filter: `project_space_id=eq.${spaceId}` } : {}),
          },
          () => {
            fetchMessagesRef.current(true);
            fetchReadStatusesRef.current();
            markAsReadRef.current();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_message_read_status',
            ...(isValidUUID(spaceId) ? { filter: `project_space_id=eq.${spaceId}` } : {}),
          },
          (payload: any) => {
            const rowUser = payload?.new?.user_id;
            const myId = currentUserId || currentUser?.id || currentUserIdRef.current;
            if (rowUser && myId && rowUser === myId) return;
            fetchReadStatusesRef.current();
          }
        )
        .on('broadcast', { event: 'read_update' }, (payload: any) => {
          const senderId = payload?.payload?.userId || payload?.payload?.user_id;
          const myId = currentUserId || currentUser?.id || currentUserIdRef.current;
          if (senderId && myId && senderId === myId) return;
          fetchReadStatusesRef.current();
        })
        .subscribe();

      msgChannelRef.current = msgChannel;

      // Listen on web channel broadcast for real-time sync with web app
      const webChannel = supabase
        .channel(`project_messages-v2:${spaceId}`)
        .on('broadcast', { event: 'read_update' }, (payload: any) => {
          const senderId = payload?.payload?.userId || payload?.payload?.user_id;
          const myId = currentUserId || currentUser?.id || currentUserIdRef.current;
          if (senderId && myId && senderId === myId) return;
          fetchReadStatusesRef.current();
        })
        .subscribe();

      webChannelRef.current = webChannel;

      // Realtime subscription for reactions
      const rxChannel = supabase
        .channel(`ps_reactions:${spaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'project_space_message_reactions',
          },
          () => fetchMessagesRef.current(true)
        )
        .subscribe();

      return () => {
        msgChannelRef.current = null;
        webChannelRef.current = null;
        try {
          msgChannel.unsubscribe();
          supabase.removeChannel(msgChannel);
        } catch { }
        try {
          webChannel.unsubscribe();
          supabase.removeChannel(webChannel);
        } catch { }
        try {
          rxChannel.unsubscribe();
          supabase.removeChannel(rxChannel);
        } catch { }
      };
    }
  }, [resolvedSpaceId, projectId]);

  // ── Fetch & Subscribe: Sub-Tab Data ────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data } = await supabase
        .from('tasks' as any)
        .select('*')
        .or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`)
        .order('created_at', { ascending: true });

      if (data) {
        setTasks(
          data.map((t: any) => ({
            id: t.id,
            name: t.name || t.title || 'Production step',
            description: t.description || '',
            due_date: t.due_date || '',
            is_completed: t.is_completed || t.status === 'completed' || t.status === 'done',
          }))
        );
      }
    } catch (err) {
      console.warn('Error fetching tasks:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchFiles = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data, error } = await supabase
        .from('files' as any)
        .select('*')
        .or(`project_id.eq.${spaceId},project_id.eq.${projectId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Generate signed URLs matching web's Files.tsx data flow
        const filesWithSignedUrls = await Promise.all(
          data.map(async (file: any) => {
            if (!file.url) return file;
            try {
              let path = file.url;
              if (path.includes('/project-files/')) {
                path = path.split('/project-files/')[1]?.split('?')[0];
              } else if (path.includes('/portfolios/')) {
                path = path.split('/portfolios/')[1]?.split('?')[0];
              }
              if (path) {
                const { data: signData } = await supabase.storage
                  .from('project-files')
                  .createSignedUrl(decodeURIComponent(path), 3600);
                if (signData?.signedUrl) {
                  return { ...file, url: signData.signedUrl, signedUrl: signData.signedUrl };
                }
              }
              return file;
            } catch (e) {
              return file;
            }
          })
        );
        setFiles(filesWithSignedUrls);
      }
    } catch (err) {
      console.warn('Error fetching files:', err);
    }
  }, [resolvedSpaceId, projectId]);



  const fetchCallSheets = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data } = await supabase
        .from('call_sheets' as any)
        .select('*')
        .or(`project_id.eq.${spaceId},project_id.eq.${projectId}`)
        .order('date', { ascending: false });

      if (data) setCallSheets(data);
    } catch (err) {
      console.warn('Error fetching call sheets:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchShots = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data } = await supabase
        .from('shot_list' as any)
        .select('*')
        .or(`project_id.eq.${spaceId},project_id.eq.${projectId}`)
        .order('scene', { ascending: true });

      if (data) {
        const sorted = [...data].sort((a: any, b: any) => {
          const scA = parseFloat(String(a.scene)) || 0;
          const scB = parseFloat(String(b.scene)) || 0;
          if (scA !== scB) return scA - scB;
          const shA = parseFloat(String(a.shot)) || 0;
          const shB = parseFloat(String(b.shot)) || 0;
          return shA - shB;
        });
        setShots(sorted);
      }
    } catch (err) {
      console.warn('Error fetching shots:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchLegalDocs = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data, error } = await supabase
        .from('legal_docs' as any)
        .select('*')
        .or(`project_id.eq.${spaceId},project_id.eq.${projectId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const docsWithSignedUrls = await Promise.all(
          data.map(async (doc: any) => {
            if (!doc.url) return doc;
            try {
              let path = doc.url;
              if (path.includes('/legal-documents/')) {
                path = path.split('/legal-documents/')[1]?.split('?')[0];
              } else if (path.includes('/portfolios/')) {
                path = path.split('/portfolios/')[1]?.split('?')[0];
              }
              if (path) {
                const { data: signData } = await supabase.storage
                  .from('legal-documents')
                  .createSignedUrl(decodeURIComponent(path), 3600);
                if (signData?.signedUrl) {
                  return { ...doc, url: signData.signedUrl, signedUrl: signData.signedUrl };
                }
              }
              return doc;
            } catch (e) {
              return doc;
            }
          })
        );
        setLegalDocs(docsWithSignedUrls);
      }
    } catch (err) {
      console.warn('Error fetching legal docs:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchBudget = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data } = await supabase
        .from('budget_items' as any)
        .select('*')
        .or(`project_id.eq.${spaceId},project_id.eq.${projectId}`)
        .order('created_at', { ascending: true });

      if (data) setBudgetItems(data);
    } catch (err) {
      console.warn('Error fetching budget items:', err);
    }
  }, [resolvedSpaceId, projectId]);

  const fetchApplicants = useCallback(async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;
    try {
      const { data } = await supabase
        .from('project_space_join_requests' as any)
        .select(`
          id,
          user_id,
          status,
          message,
          profiles:user_id (
            full_name,
            avatar_url,
            craft
          )
        `)
        .or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`)
        .eq('status', 'pending');

      if (data) setApplicants(data);
    } catch (err) {
      console.warn('Error fetching applicants:', err);
    }
  }, [resolvedSpaceId, projectId]);

  // ── Lazy-Load Active Sub-Tab Data & Realtime Subscription on Demand ──────
  // Only connects WebSockets and fetches data for the tab the user is actually viewing!
  useEffect(() => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId) return;

    let activeChannel: any = null;

    switch (activeSubTab) {
      case 'Tasks':
        fetchTasks();
        activeChannel = supabase
          .channel(`rt_tasks_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
          .subscribe();
        break;

      case 'Files':
        fetchFiles();
        activeChannel = supabase
          .channel(`rt_files_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => fetchFiles())
          .subscribe();
        break;

      case 'Team':
        fetchTeam();
        activeChannel = supabase
          .channel(`rt_members_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'project_space_members' }, () => fetchTeam())
          .subscribe();
        break;

      case 'Call Sheet':
        fetchCallSheets();
        activeChannel = supabase
          .channel(`rt_callsheets_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'call_sheets' }, () => fetchCallSheets())
          .subscribe();
        break;

      case 'Shot List':
        fetchShots();
        activeChannel = supabase
          .channel(`rt_shots_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'shot_list' }, () => fetchShots())
          .subscribe();
        break;

      case 'Legal Docs':
        fetchLegalDocs();
        activeChannel = supabase
          .channel(`rt_legaldocs_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'legal_docs' }, () => fetchLegalDocs())
          .subscribe();
        break;

      case 'Budget':
        fetchBudget();
        activeChannel = supabase
          .channel(`rt_budget_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items' }, () => fetchBudget())
          .subscribe();
        break;

      case 'Applicants':
        fetchApplicants();
        activeChannel = supabase
          .channel(`rt_applicants_${spaceId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'project_space_join_requests' }, () => fetchApplicants())
          .subscribe();
        break;

      case 'Chat':
      default:
        // Handled by primary messages and reactions channels
        break;
    }

    return () => {
      if (activeChannel) {
        try {
          activeChannel.unsubscribe();
          supabase.removeChannel(activeChannel);
        } catch { }
      }
    };
  }, [
    activeSubTab,
    resolvedSpaceId,
    projectId,
    fetchTasks,
    fetchFiles,
    fetchTeam,
    fetchCallSheets,
    fetchShots,
    fetchLegalDocs,
    fetchBudget,
    fetchApplicants,
  ]);

  // ── Actions: Chat ──────────────────────────────────────────────────────────
  const handlePickMedia = async () => {
    try {
      const results = await pickAttachments();
      if (results && results.length > 0) {
        const picked = results.map((res) => {
          const isVid = Boolean(res.name?.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/i) || res.type?.startsWith('video/'));
          const isImg = Boolean(res.name?.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || res.type?.startsWith('image/'));
          return {
            uri: res.uri,
            name: res.name || `file_${Date.now()}`,
            type: res.type || (isVid ? 'video/mp4' : isImg ? 'image/jpeg' : 'application/octet-stream'),
          };
        });
        setAttachedFiles((prev) => [...prev, ...picked]);
      }
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        console.warn('Document picker error:', e);
      }
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    const currFiles = [...attachedFiles];
    const spaceId = resolvedSpaceId || (projectId ? getCacheSync<string>(`ps_space_id_${projectId}`) : null) || projectId;
    const myUid = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
    if ((!text && currFiles.length === 0) || !myUid || !spaceId) return;

    setSending(true);

    try {
      if (currFiles.length > 0) {
        const uploadedList: Array<{ url: string; type: string }> = [];

        for (let i = 0; i < currFiles.length; i++) {
          const fileItem = currFiles[i];
          try {
            const uploaded = await uploadMediaPipeline(
              {
                uri: fileItem.uri,
                name: fileItem.name,
                type: fileItem.type,
              },
              {
                bucket: 'post-media',
                folder: `chat_media/${spaceId}`,
              }
            );

            if (uploaded?.url) {
              uploadedList.push({ url: uploaded.url, type: uploaded.type });
            }
          } catch (err) {
            console.warn('[ProjectSpace] Chat media upload failed:', err);
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

          const fileContent = text || defaultContent;

          const { data: insertedMsg, error: insertErr } = await supabase
            .from('project_space_messages')
            .insert({
              project_space_id: spaceId,
              user_id: myUid,
              content: fileContent,
              reply_to_id: replyingTo ? replyingTo.id : null,
              attachment_url: finalUrl,
              attachment_type: finalType,
            })
            .select(`
              id, content, user_id, created_at, is_deleted, reply_to_id,
              attachment_url, attachment_type,
              profiles!user_id (username, full_name, avatar_url, craft)
            `)
            .maybeSingle();

          if (insertErr) throw insertErr;

          if (insertedMsg) {
            const newRecord = {
              ...insertedMsg,
              user_id: insertedMsg.user_id || myUid,
              is_own: true,
              content: fileContent,
              reactions: [],
            };
            setMessages((prev) => [...prev, newRecord]);
          }
        }
      } else {
        const isUUID = isValidUUID(spaceId);
        let finalContent = text;
        const isShareCard = text.startsWith('POST_SHARE::') ||
          text.startsWith('JOB_SHARE::') ||
          text.startsWith('PROJECT_SHARE::') ||
          text.startsWith('PROFILE_SHARE::') ||
          text.startsWith('MARKETPLACE_SHARE::');

        if (!text.startsWith('CALL::') && !isShareCard && isUUID && text) {
          try {
            finalContent = await encryptGroupMessage(text);
          } catch (e) {
            // Never downgrade an encrypted space to plaintext on failure.
            throw new Error('Could not encrypt this message. It was not sent. Please try again.');
          }
        }

        if (isUUID) {
          const { data: insertedData, error } = await supabase
            .from('project_space_messages')
            .insert({
              project_space_id: spaceId,
              user_id: myUid,
              content: finalContent,
              reply_to_id: replyingTo?.id || null,
              attachment_url: null,
              attachment_type: null,
            })
            .select(`
              id, content, user_id, created_at, is_deleted, reply_to_id,
              attachment_url, attachment_type,
              profiles!user_id (username, full_name, avatar_url, craft)
            `)
            .maybeSingle();

          if (error) throw error;

          if (insertedData) {
            const decrypted = {
              ...insertedData,
              user_id: insertedData.user_id || myUid,
              is_own: true,
              content: text,
              reactions: [],
            };
            setMessages((prev) => [...prev, decrypted]);
          }
        }
      }

      shouldScrollToEndRef.current = true;
      setInputText('');
      setAttachedFiles([]);
      setReplyingTo(null);
      fetchMessages(true);
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch { }
      }, 100);
    } catch (err: any) {
      Alert.alert('Send Error', err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Load Starred Messages for this project space
  useEffect(() => {
    const spaceId = resolvedSpaceId || syncSpaceId || projectId;
    if (!spaceId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`@starred_msgs_ps_${spaceId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setStarredMessageIds(new Set(parsed));
          }
        }
      } catch (err) {
        console.warn('[ProjectSpace] Failed to load starred messages:', err);
      }
    })();
  }, [resolvedSpaceId, syncSpaceId, projectId]);

  const saveStarredMessages = async (nextSet: Set<string>) => {
    setStarredMessageIds(nextSet);
    const spaceId = resolvedSpaceId || syncSpaceId || projectId;
    if (!spaceId) return;
    try {
      await AsyncStorage.setItem(`@starred_msgs_ps_${spaceId}`, JSON.stringify(Array.from(nextSet)));
    } catch { }
  };

  const handleToggleSelectMsg = useCallback((msgId: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleLongPressMsg = useCallback((item: any) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleForwardToDestination = async (dest: any) => {
    const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
    if (!selectedList.length) return;
    setForwarding(true);
    try {
      const senderId = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
      if (!senderId) throw new Error('Please sign in to forward messages.');

      for (const msg of selectedList) {
        if (dest.type === 'project') {
          await supabase.from('project_space_messages' as any).insert({
            project_space_id: dest.id,
            user_id: senderId,
            content: msg.content,
            attachment_url: msg.attachment_url || null,
            attachment_type: msg.attachment_type || null,
          });
        } else {
          await supabase.from('room_messages' as any).insert({
            room_id: dest.id,
            user_id: senderId,
            content: msg.content,
            media_url: msg.attachment_url || null,
            media_type: msg.attachment_type || null,
          });
        }
      }
      setForwardModalVisible(false);
      setSelectedMsgIds(new Set());
      Alert.alert('Forwarded! 🚀', `Message(s) forwarded to ${dest.title}.`);
    } catch (err: any) {
      Alert.alert('Forward Failed', err.message || 'Could not forward message.');
    } finally {
      setForwarding(false);
    }
  };

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const myUid = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
      if (!myUid) return;
      setSelectedMsgIds(new Set());

      // Decide add / remove from what is on screen NOW. This used to be decided inside the setMessages updater, which
      // React runs later, so `isTogglingOff` was still false when the database write below checked it: tapping your
      // own reaction again re-added it instead of removing it.
      const targetMsg = messagesRef.current.find((m) => m.id === messageId);
      const currentReactions: any[] = targetMsg?.reactions || [];
      const existingReaction = currentReactions.find((r: any) => r.user_id === myUid);
      const isTogglingOff = !!(existingReaction && existingReaction.emoji === emoji);

      // Instant optimistic reaction UI update (1 user can only have at most 1 reaction)
      const updatedReactions = isTogglingOff
        ? currentReactions.filter((r: any) => r.user_id !== myUid)
        : [
          ...currentReactions.filter((r: any) => r.user_id !== myUid),
          {
            id: existingReaction?.id || `temp-${Date.now()}`,
            user_id: myUid,
            emoji,
            message_id: messageId,
            profiles: currentUser || { id: myUid },
          },
        ];
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedReactions } : m)));

      try {
        const { error: delErr } = await supabase
          .from('project_space_message_reactions' as any)
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', myUid);
        if (delErr) throw delErr;

        if (!isTogglingOff) {
          const { error: insErr } = await supabase
            .from('project_space_message_reactions' as any)
            .insert({
              message_id: messageId,
              user_id: myUid,
              emoji,
            });
          if (insErr) throw insErr;
        }
      } catch (err) {
        console.warn('Reaction error:', err);
        // The write failed: roll the screen back instead of showing a reaction that was never saved.
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: currentReactions } : m)));
      }
    },
    [currentUser, currentUserId]
  );

  // ── Helper: Secure File Opener / Viewer ───────────────────────────────────
  const handleOpenFile = useCallback(async (fileUrl: string, bucket = 'project-files') => {
    if (!fileUrl) {
      Alert.alert('Unavailable', 'No file link available for this document.');
      return;
    }
    try {
      // If URL is already a signed URL, open it directly
      if (fileUrl.includes('/sign/') || fileUrl.includes('token=')) {
        await Linking.openURL(fileUrl);
        return;
      }

      let targetUrl = fileUrl;
      const bucketMarker = `${bucket}/`;
      if (fileUrl.includes(bucketMarker)) {
        const pathPart = fileUrl.split(bucketMarker)[1]?.split('?')[0];
        if (pathPart) {
          const decodedPath = decodeURIComponent(pathPart);
          const { data: signData, error: signErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(decodedPath, 3600);
          if (!signErr && signData?.signedUrl) {
            targetUrl = signData.signedUrl;
          }
        }
      }

      await Linking.openURL(targetUrl);
    } catch (err: any) {
      Alert.alert('Preview Error', err.message || 'Could not open file preview.');
    }
  }, [supabase]);

  // messagesRef is declared near state and kept in sync on every render

  // Pre-compute read status timestamps once per readStatuses change
  const readStatusMap = useMemo(() => {
    const myUid = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
    if (!readStatuses || !myUid) return [];
    return readStatuses
      .filter((rs: any) => rs.user_id !== myUid)
      .map((rs: any) => ({
        time: new Date(rs.last_read_at).getTime(),
        name: rs.profiles?.full_name?.split(' ')[0] || 'Member',
      }));
  }, [readStatuses, currentUser?.id, currentUserId]);

  const keyExtractor = useCallback((item: any, index: number) => (item?.id ? String(item.id) : String(index)), []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (!item) return null;
      const msgs = messagesRef.current;
      const myUid = currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync();
      const itemUserId = item.user_id || item.sender_id || item.senderId;
      const isOwn = Boolean(myUid && itemUserId && itemUserId === myUid) || item.is_own === true || item.isOwn === true;
      const messageDate = new Date(item.created_at || Date.now());
      const prevMsg = index > 0 ? msgs[index - 1] : null;
      const prevDate = prevMsg ? new Date(prevMsg.created_at) : null;
      const showDateSeparator = !prevDate || messageDate.toDateString() !== prevDate.toDateString();

      const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      const senderName = prof?.full_name || prof?.username || 'Crew Member';
      const mUid = item.user_id || item.sender_id || item.senderId;
      const member = teamMemberMap.get(mUid);
      const cachedCraft = mUid ? getCacheSync<string>(`user_craft_${mUid}`) : null;
      const senderCraft =
        item.senderCraft ||
        (member?.role && member.role !== 'Crew' && member.role !== 'member' ? member.role : null) ||
        prof?.craft ||
        cachedCraft ||
        member?.craft ||
        (member?.role && member.role !== 'Crew' ? member.role : null) ||
        null;
      const senderAvatar = prof?.avatar_url;
      const senderInitial = (senderName.charAt(0) || 'C').toUpperCase();

      const isSelected = selectedMsgIds.has(item.id);
      const isSingleSelected = isSelected && selectedMsgIds.size === 1;
      const isStarred = starredMessageIds.has(item.id);
      const shareInfo = parseShareData(item.content);

      // Use pre-computed readStatusMap: only show "Seen by" on the LAST message seen by users
      const msgTime = messageDate.getTime();
      const isLatestSeen = isOwn && !msgs.some((m: any, mIdx: number) => {
        if (mIdx <= index) return false;
        const mUserId = m.user_id || m.sender_id || m.senderId;
        if (mUserId !== myUid) return false;
        const nextTime = new Date(m.created_at || Date.now()).getTime();
        return readStatusMap.some(rs => rs.time >= nextTime);
      });
      const readByNames = isLatestSeen ? readStatusMap.filter((rs) => rs.time >= msgTime).map((rs) => rs.name) : [];
      const isSeen = readByNames.length > 0;
      const replyMsg = item.reply_to_message || (item.reply_to_id ? messageMapRef.current.get(item.reply_to_id) : null);

      return (
        <ProjectMessageRow
          item={item}
          index={index}
          isOwn={isOwn}
          showDateSeparator={showDateSeparator}
          messageDate={messageDate}
          senderName={senderName}
          senderCraft={senderCraft}
          senderAvatar={senderAvatar}
          senderInitial={senderInitial}
          isSelected={isSelected}
          isSingleSelected={isSingleSelected}
          isSelectionMode={selectedMsgIds.size > 0}
          isStarred={isStarred}
          shareInfo={shareInfo}
          readByNames={readByNames}
          isSeen={isSeen}
          currentUserId={myUid || undefined}
          replyMsg={replyMsg}
          themeColors={themeColors}
          isDark={isDark}
          navigation={navigation}
          stTitle={projectData?.title || projectTitle}
          projectTitle={projectTitle}
          resolvedSpaceId={resolvedSpaceId}
          projectId={projectId}
          onPress={handleToggleSelectMsg}
          onSwipeReply={setReplyingTo}
          onToggleReaction={handleToggleReaction}
          onLongPress={handleLongPressMsg}
          onDoubleTap={handleToggleReaction}
          onOpenImageModal={openImageLightbox}
          onOpenFile={handleOpenFile}
        />
      );
    },
    [
      currentUserId,
      currentUser?.id,
      selectedMsgIds,
      starredMessageIds,
      readStatusMap,
      teamMembers,
      themeColors,
      isDark,
      navigation,
      projectData?.title,
      projectTitle,
      resolvedSpaceId,
      projectId,
      handleToggleSelectMsg,
      handleLongPressMsg,
      setReplyingTo,
      handleToggleReaction,
      handleOpenFile,
    ]
  );

  const flatListExtraData = useMemo(
    () => ({
      selectedMsgIds,
      starredMessageIds,
      readStatusMap,
      teamMembers,
      currentUserId: currentUserId || currentUser?.id || currentUserIdRef.current || getCurrentUserIdSync(),
    }),
    [
      selectedMsgIds,
      starredMessageIds,
      readStatusMap,
      teamMembers,
      currentUserId,
      currentUser?.id,
    ]
  );

  // ── Actions: Tasks ─────────────────────────────────────────────────────────
  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    const spaceId = resolvedSpaceId || projectId;
    if (!title || !spaceId) return;

    setAddingTask(true);
    try {
      const { data, error } = await supabase
        .from('tasks' as any)
        .insert({
          project_space_id: spaceId,
          name: title,
          description: newTaskDesc || null,
          due_date: newTaskDueDate || null,
          is_completed: false,
        })
        .select()
        .single();

      if (error) throw error;
      const inserted = data as any;
      setTasks((prev) => [...prev, { id: inserted?.id || Date.now().toString(), name: title, description: newTaskDesc, due_date: newTaskDueDate, is_completed: false }]);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDueDate('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add task.');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, is_completed: !currentStatus } : t))
      );
      await supabase
        .from('tasks' as any)
        .update({
          is_completed: !currentStatus,
        })
        .eq('id', taskId);
    } catch (err) {
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await supabase.from('tasks' as any).delete().eq('id', taskId);
    } catch (err) {
      fetchTasks();
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      await supabase.from('files' as any).delete().eq('id', fileId);
    } catch (err) {
      fetchFiles();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return '1.2 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImageFile = (name?: string, type?: string) => {
    const ext = (name || '').toLowerCase();
    return (
      ext.endsWith('.jpg') ||
      ext.endsWith('.jpeg') ||
      ext.endsWith('.png') ||
      ext.endsWith('.webp') ||
      ext.endsWith('.gif') ||
      (type || '').startsWith('image/')
    );
  };

  // ── Helper: Direct Native Storage Uploader ────────────────────────────────
  const uploadFileToStorage = async (
    uri: string,
    fileName: string,
    mimeType: string,
    bucket: string,
    storagePath: string
  ) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    // Use public 'post-media' bucket as primary standard for chat attachments with portfolios fallback
    const targetBuckets = bucket === 'project-files'
      ? ['post-media', 'portfolios', 'project-files']
      : [bucket, 'post-media', 'portfolios'];

    for (const b of targetBuckets) {
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: uri,
          name: fileName,
          type: mimeType || 'application/octet-stream',
        } as any);

        const uploadUrl = `${ENV.SUPABASE_URL}/storage/v1/object/${b}/${storagePath}`;

        const headers: Record<string, string> = {
          apikey: ENV.SUPABASE_ANON_KEY,
          'x-upsert': 'true',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (res.ok) {
          const { data: publicUrlData } = supabase.storage
            .from(b)
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
        }
      } catch (err) {
        console.warn(`[ProjectSpace] Upload to bucket ${b} failed, trying next:`, err);
      }
    }

    throw new Error('Upload failed across all storage buckets');
  };

  // ── Actions: Files ─────────────────────────────────────────────────────────
  const handleCreateDocument = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images, DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
      });

      if (!res.uri || !res.name) return;

      setUploadingDoc(true);

      const uploaded = await uploadMediaPipeline(
        {
          uri: res.uri,
          name: res.name,
          type: res.type || 'application/pdf',
          size: res.size || 0,
        },
        {
          bucket: 'post-media',
          folder: `files/${projectId}`,
          maxDocSizeMB: 25,
        }
      );
      const publicUrl = uploaded.url;

      const { data, error } = await supabase
        .from('files' as any)
        .insert({
          project_id: projectId,
          name: res.name,
          file_type: res.type || 'application/pdf',
          size: res.size || 0,
          url: publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      setFiles((prev) => [data as any, ...prev]);
      Alert.alert('Success', 'Document successfully uploaded to project space.');
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Upload Error', err.message || 'Failed to upload document.');
      }
    } finally {
      setUploadingDoc(false);
    }
  };

  // ── Actions: Call Sheet ────────────────────────────────────────────────────
  const handleCreateCallSheet = async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!spaceId || !csDate) {
      Alert.alert('Validation', 'Call sheet date is required.');
      return;
    }
    setCreatingCallSheet(true);
    try {
      const { data, error } = await supabase
        .from('call_sheets' as any)
        .insert({
          project_id: projectId,
          date: csDate,
          call_time: csCallTime,
          location: csLocation,
          director: csDirector,
          producer: csProducer,
          notes: csNotes,
        })
        .select()
        .single();

      if (error) throw error;
      setCallSheets((prev) => [data as any, ...prev]);
      setNewCallSheetModalVisible(false);
      Alert.alert('Published', 'Call Sheet deployed to production crew.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create call sheet.');
    } finally {
      setCreatingCallSheet(false);
    }
  };

  const handleDeleteCallSheet = async (id: string) => {
    try {
      setCallSheets((prev) => prev.filter((c) => c.id !== id));
      await supabase.from('call_sheets' as any).delete().eq('id', id);
    } catch (err) {
      fetchCallSheets();
    }
  };

  // ── Actions: Shot List ─────────────────────────────────────────────────────
  const handleAddShot = async () => {
    const spaceId = resolvedSpaceId || projectId;
    if (!newShotDesc.trim() || !spaceId) {
      Alert.alert('Validation', 'Shot description is required.');
      return;
    }
    setAddingShot(true);
    try {
      const { data, error } = await supabase
        .from('shot_list' as any)
        .insert({
          project_id: projectId,
          scene: parseInt(newScene, 10) || 1,
          shot: parseInt(newShot, 10) || 1,
          description: newShotDesc.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      setShots((prev) => [...prev, data as any]);
      setNewShotDesc('');
      const nextShotNum = parseInt(newShot, 10);
      if (!isNaN(nextShotNum)) setNewShot((nextShotNum + 1).toString());
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add shot sequence.');
    } finally {
      setAddingShot(false);
    }
  };

  const handleToggleShotStatus = async (shotId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      setShots((prev) =>
        prev.map((s) => (s.id === shotId ? { ...s, status: newStatus } : s))
      );
      await supabase.from('shot_list' as any).update({ status: newStatus }).eq('id', shotId);
    } catch (err) {
      fetchShots();
    }
  };

  const handleDeleteShot = async (shotId: string) => {
    try {
      setShots((prev) => prev.filter((s) => s.id !== shotId));
      await supabase.from('shot_list' as any).delete().eq('id', shotId);
    } catch (err) {
      fetchShots();
    }
  };

  // ── Actions: Legal Docs ────────────────────────────────────────────────────
  const handleCreateLegalDoc = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.allFiles],
      });

      if (!res.uri || !res.name || !ldTitle.trim()) {
        Alert.alert('Validation', 'Document title and file are required.');
        return;
      }

      setCreatingLegalDoc(true);

      const uploaded = await uploadMediaPipeline(
        {
          uri: res.uri,
          name: res.name,
          type: res.type || 'application/pdf',
          size: res.size || 0,
        },
        {
          bucket: 'post-media',
          folder: `legal_docs/${projectId}`,
          maxDocSizeMB: 25,
        }
      );
      const publicUrl = uploaded.url;

      const { data, error } = await supabase
        .from('legal_docs' as any)
        .insert({
          project_id: projectId,
          title: ldTitle.trim(),
          document_type: ldType,
          description: ldDescription.trim() || null,
          url: publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      setLegalDocs((prev) => [data as any, ...prev]);
      setNewLegalDocModalVisible(false);
      setLdTitle('');
      setLdDescription('');
      Alert.alert('Success', 'Legal document registered.');
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', err.message || 'Failed to create legal document.');
      }
    } finally {
      setCreatingLegalDoc(false);
    }
  };

  const handleDeleteLegalDoc = async (id: string) => {
    try {
      setLegalDocs((prev) => prev.filter((d) => d.id !== id));
      await supabase.from('legal_docs' as any).delete().eq('id', id);
    } catch (err) {
      fetchLegalDocs();
    }
  };

  // ── Actions: Budget ────────────────────────────────────────────────────────
  const handleAddBudgetItem = async () => {
    const spaceId = resolvedSpaceId || projectId;
    const cost = parseFloat(newBudgetCost);
    if (!newBudgetItemName.trim() || isNaN(cost) || !spaceId) {
      Alert.alert('Validation', 'Item name and valid cost amount required.');
      return;
    }
    setAddingBudgetItem(true);
    try {
      const { data, error } = await supabase
        .from('budget_items' as any)
        .insert({
          project_id: projectId,
          item_name: newBudgetItemName.trim(),
          estimated_cost: cost,
          category: newBudgetCategory,
        })
        .select()
        .single();

      if (error) throw error;
      setBudgetItems((prev) => [...prev, data as any]);
      setNewBudgetItemName('');
      setNewBudgetCost('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to allocate budget item.');
    } finally {
      setAddingBudgetItem(false);
    }
  };

  const handleDeleteBudgetItem = async (id: string) => {
    try {
      setBudgetItems((prev) => prev.filter((b) => b.id !== id));
      await supabase.from('budget_items' as any).delete().eq('id', id);
    } catch (err) {
      fetchBudget();
    }
  };

  const handleUpdateCrewRole = async (memberId: string) => {
    if (!tempCrewRole.trim()) {
      setEditingCrewId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('project_space_members' as any)
        .update({ role: tempCrewRole.trim() })
        .eq('project_space_id', resolvedSpaceId)
        .eq('user_id', memberId);

      if (error) throw error;

      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: tempCrewRole.trim() } : m));
      setEditingCrewId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Actions: Applicants ────────────────────────────────────────────────────
  const handleApplicantDecision = async (requestId: string, userId: string, decision: 'approved' | 'rejected') => {
    setProcessingApplicantId(requestId);
    const spaceId = resolvedSpaceId || projectId;
    try {
      const { error } = await supabase
        .from('project_space_join_requests' as any)
        .update({ status: decision })
        .eq('id', requestId);

      if (error) throw error;

      if (decision === 'approved' && spaceId) {
        await supabase
          .from('project_space_members' as any)
          .insert({
            project_space_id: spaceId,
            user_id: userId,
            role: 'Crew',
          });
      }

      setApplicants((prev) => prev.filter((a) => a.id !== requestId));
      Alert.alert(
        decision === 'approved' ? 'Applicant Approved' : 'Applicant Rejected',
        decision === 'approved'
          ? 'Candidate has been officially onboarded to project space.'
          : 'Candidate request declined.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update application.');
    } finally {
      setProcessingApplicantId(null);
    }
  };

  const handleUpdateAvatar = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.images],
      });

      if (!res.uri || !res.name) return;

      const uploaded = await uploadMediaPipeline(
        {
          uri: res.uri,
          name: res.name || 'avatar.jpg',
          type: res.type || 'image/jpeg',
          size: res.size || 0,
        },
        {
          bucket: 'post-media',
          folder: `projects/${projectId}`,
        }
      );

      setStImageUrl(uploaded.url);
      Alert.alert('Success', 'Avatar staged. Press "Sync Settings" below to save.');
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', err.message || 'Failed to upload avatar image.');
      }
    }
  };

  // ── Actions: Settings ──────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    if (stStatus === 'completed' && stOriginalStatus !== 'completed') {
      const spaceId = resolvedSpaceId || projectId;
      if (spaceId) {
        const { data: members } = await supabase
          .from('project_space_members' as any)
          .select('user_id, role, profiles:user_id(full_name, avatar_url)')
          .or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);

        if (members) {
          setWrapCrewList(
            members.map((m: any) => ({
              user_id: m.user_id,
              full_name: m.profiles?.full_name || 'Anonymous',
              role: m.role || 'Crew',
              avatar_url: m.profiles?.avatar_url || '',
              selected: true,
            }))
          );
        }
      }
      setShowWrapDialog(true);
      return;
    }

    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: stTitle,
          description: stDescription,
          status: stStatus,
          location: stLocation,
          genre: stGenre.split(',').map((g) => g.trim()).filter((g) => g),
          required_roles: stRequiredRoles,
          start_date: stStartDate || null,
          end_date: stEndDate || null,
          budget_min: stBudgetMin ? parseFloat(stBudgetMin) : null,
          budget_max: stBudgetMax ? parseFloat(stBudgetMax) : null,
          is_public: stIsPublic,
          image_url: stImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;
      setStOriginalStatus(stStatus);
      Alert.alert('Success', 'Project settings synchronized successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update project settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmWrap = async () => {
    setSavingSettings(true);
    try {
      const { error: projError } = await supabase
        .from('projects')
        .update({
          title: stTitle,
          description: stDescription,
          status: 'completed',
          location: stLocation,
          genre: stGenre.split(',').map((g) => g.trim()).filter((g) => g),
          required_roles: stRequiredRoles,
          start_date: stStartDate || null,
          end_date: stEndDate || null,
          budget_min: stBudgetMin ? parseFloat(stBudgetMin) : null,
          budget_max: stBudgetMax ? parseFloat(stBudgetMax) : null,
          is_public: stIsPublic,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (projError) throw projError;

      const selectedCrew = wrapCrewList.filter((c) => c.selected);
      if (selectedCrew.length > 0) {
        const credits = selectedCrew.map((c) => ({
          project_id: projectId,
          project_title: stTitle,
          user_id: c.user_id,
          role: c.role,
          verifier_id: currentUser?.id || null,
        }));

        await supabase.from('project_credits' as any).insert(credits);
      }

      setStOriginalStatus('completed');
      setStStatus('completed');
      setShowWrapDialog(false);
      Alert.alert('Project Wrapped!', 'Production completed and verified crew credits published.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to wrap project.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearChatHistory = () => {
    const spaceId = resolvedSpaceId || projectId;
    Alert.alert(
      'Purge Chat History',
      'This will wipe all messages from this project space. Task lists, shot lists, and files will remain untouched.',
      [
        { text: 'Keep Messages', style: 'cancel' },
        {
          text: 'Purge All',
          style: 'destructive',
          onPress: async () => {
            if (!spaceId) return;
            try {
              // 1. Call clear_project_space_messages RPC first
              const { error: rpcErr } = await (supabase.rpc as any)('clear_project_space_messages', {
                _space_id: spaceId || resolvedSpaceId || undefined,
                _project_id: projectId || spaceId || undefined,
              });

              if (rpcErr) {
                console.warn('clear_project_space_messages RPC failed or not deployed, using client fallback:', rpcErr);

                // Fetch matching message IDs first
                const { data: existingMsgs } = await supabase
                  .from('project_space_messages')
                  .select('id')
                  .or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);

                if (existingMsgs && existingMsgs.length > 0) {
                  const ids = existingMsgs.map((m: any) => m.id);

                  // Unpin message references
                  if (resolvedSpaceId) {
                    await supabase
                      .from('project_spaces')
                      .update({ pinned_message_id: null } as any)
                      .eq('id', resolvedSpaceId);
                  }

                  // Clear reactions
                  await supabase
                    .from('project_space_message_reactions' as any)
                    .delete()
                    .in('message_id', ids);

                  // Break reply_to_id FK
                  await supabase
                    .from('project_space_messages' as any)
                    .update({ reply_to_id: null })
                    .in('id', ids);

                  // Bulk delete
                  const { error: bulkErr } = await supabase
                    .from('project_space_messages')
                    .delete()
                    .or(`project_space_id.eq.${spaceId},project_space_id.eq.${projectId}`);

                  if (bulkErr) {
                    for (const id of ids) {
                      await supabase
                        .from('project_space_messages')
                        .delete()
                        .eq('id', id);
                    }
                  }
                }
              }

              setMessages([]);
              Alert.alert('Purged', 'Chat logs cleared.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear chat.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Terminate Entire Space',
      `You are about to delete "${stTitle}". This action is irreversible. All team access will be revoked immediately.`,
      [
        { text: 'Keep Project', style: 'cancel' },
        {
          text: 'Confirm Destruction',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('projects').delete().eq('id', projectId);
              Alert.alert('Deleted', 'Project has been permanently deleted.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete project.');
            }
          },
        },
      ]
    );
  };

  // ── Derived State Calculations ─────────────────────────────────────────────
  const filteredTasks = tasks.filter((t) =>
    ((t?.name || t?.title || '') + '').toLowerCase().includes((taskSearch || '').toLowerCase())
  );
  const filteredFiles = files.filter((f) =>
    ((f?.name || '') + '').toLowerCase().includes((fileSearch || '').toLowerCase())
  );
  const filteredTeam = (teamMembers || []).filter((m) =>
    ((m?.full_name || m?.username || '') + '').toLowerCase().includes((teamSearch || '').toLowerCase()) ||
    ((m?.craft || m?.role || '') + '').toLowerCase().includes((teamSearch || '').toLowerCase())
  );

  const totalBudgetEst = parseFloat(stBudgetMax) || 50000;
  const totalAllocated = budgetItems.reduce((acc, curr) => acc + (parseFloat(curr.estimated_cost) || 0), 0);
  const remainingBudget = Math.max(0, totalBudgetEst - totalAllocated);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.bgScreen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Header Bar or Contextual WhatsApp Selection Action Bar */}
      {selectedMsgIds.size > 0 && activeSubTab === 'Chat' ? (
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
            {/* Reply - when 1 message selected */}
            {selectedMsgIds.size === 1 && (
              <TouchableOpacity
                style={styles.selectionActionBtn}
                onPress={() => {
                  const singleMsg = messages.find((m) => selectedMsgIds.has(m.id));
                  if (singleMsg) {
                    setReplyingTo(singleMsg);
                  }
                  setSelectedMsgIds(new Set());
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Icon name="corner-up-left" size={19} color={themeColors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Info - when 1 message selected */}
            {selectedMsgIds.size === 1 && (
              <TouchableOpacity
                style={styles.selectionActionBtn}
                onPress={() => {
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

            {/* Star / Unstar in bulk */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => {
                const selectedArray = Array.from(selectedMsgIds);
                const allStarred = selectedArray.every((id) => starredMessageIds.has(id));
                const next = new Set(starredMessageIds);
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
                color={Array.from(selectedMsgIds).every((id) => starredMessageIds.has(id)) ? '#F59E0B' : themeColors.textPrimary}
              />
            </TouchableOpacity>

            {/* Copy in bulk */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => {
                const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
                if (selectedList.length === 1) {
                  Clipboard.setString(selectedList[0].content || '');
                } else {
                  const combined = selectedList
                    .map((m) => {
                      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const sender = m.profiles?.full_name || m.profiles?.username || 'Crew Member';
                      return `[${time}] ${sender}: ${m.content || ''}`;
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

            {/* Forward */}
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={async () => {
                try {
                  const spaceId = resolvedSpaceId || projectId;
                  const { data: otherRooms } = await supabase
                    .from('discussion_rooms' as any)
                    .select('id, title, room_type')
                    .limit(15);
                  const { data: otherSpaces } = await supabase
                    .from('projects' as any)
                    .select('id, title')
                    .neq('id', projectId || '')
                    .limit(10);
                  const dests = [
                    ...(otherSpaces || []).map((s: any) => ({ id: s.id, title: s.title, type: 'project' })),
                    ...(otherRooms || []).map((r: any) => ({ id: r.id, title: r.title, type: 'room' })),
                  ];
                  setAvailableDestinationsForForward(dests);
                } catch {
                  // Fallback
                }
                setForwardModalVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Icon name="share" size={19} color={themeColors.textPrimary} />
            </TouchableOpacity>

            {/* Delete */}
            {Array.from(selectedMsgIds).some((id) => {
              const msg = messages.find((m) => m.id === id);
              return msg && (msg.user_id === currentUser?.id || isInternal);
            }) && (
                <TouchableOpacity
                  style={styles.selectionActionBtn}
                  onPress={() => {
                    const deletableIds = Array.from(selectedMsgIds).filter((id) => {
                      const msg = messages.find((m) => m.id === id);
                      return msg && (msg.user_id === currentUser?.id || isInternal);
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
                              const spaceId = resolvedSpaceId || projectId;
                              await supabase
                                .from('project_space_messages' as any)
                                .delete()
                                .in('id', deletableIds);
                              setMessages((prev) => {
                                const updated = prev.filter((m) => !deletableIds.includes(m.id));
                                if (spaceId) saveCache(`ps_messages_${spaceId}`, updated).catch(() => { });
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
        <View style={[styles.header, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => handleSmartBack(navigation, 'Projects')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {stTitle || projectTitle || 'Project Space'}
            </Text>
            <View style={styles.e2eeRow}>
              <Icon name="lock" size={10} color="#10B981" />
              <Text style={styles.e2eeText}>E2EE SECURE SPACE</Text>
            </View>
          </View>

          {/* Right-side header actions: call buttons or live badge + settings */}
          <View style={styles.headerRightActions}>
            {isInCall ? (
              <TouchableOpacity
                style={styles.headerLiveBtn}
                onPress={() => {
                  maximizeCall();
                  const spaceId = resolvedSpaceId || syncSpaceId || projectId;
                  navigation.navigate('Call', {
                    roomId: spaceId,
                    roomName: stTitle || projectTitle || 'Project Space',
                    roomType: 'project',
                    isVideo: callState.isVideo || false,
                  });
                }}
                activeOpacity={0.8}
              >
                <View style={styles.livePulseDot} />
                <Text style={styles.headerLiveText}>LIVE</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.headerCallBtn}
                onPress={handleCallPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Call Crew"
              >
                <Icon name="phone" size={17} color={ORANGE} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={handleToggleBookmark}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Bookmark Project Space"
            >
              <Icon
                name="bookmark"
                size={18}
                color={isBookmarked ? ORANGE : themeColors.textPrimary}
                fill={isBookmarked ? ORANGE : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => handleSelectSubTab('Settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="settings" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sub-Navigation Pill Tabs */}
      <View style={[styles.subTabBarContainer, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabBarContent}
        >
          {(
            (isInCall
              ? [
                'Live Call',
                'Chat',
                'Tasks',
                'Files',
                'Team',
                'Call Sheet',
                'Shot List',
                'Script Reader',
                'Legal Docs',
                'Budget',
                'Applicants',
                'Settings',
              ]
              : [
                'Chat',
                'Tasks',
                'Files',
                'Team',
                'Call Sheet',
                'Shot List',
                'Script Reader',
                'Legal Docs',
                'Budget',
                'Applicants',
                'Settings',
              ]) as SubTabType[]
          ).map((tab) => {
            const isActive = activeSubTab === tab;
            const isLiveTab = tab === 'Live Call';
            const iconMap: Record<string, string> = {
              'Live Call': 'video',
              Chat: 'message-square',
              Tasks: 'check-square',
              Files: 'folder',
              Team: 'users',
              'Call Sheet': 'calendar',
              'Shot List': 'film',
              'Script Reader': 'book-open',
              'Legal Docs': 'shield',
              Budget: 'dollar-sign',
              Applicants: 'user-plus',
              Settings: 'sliders',
            };

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleSelectSubTab(tab)}
                style={[
                  styles.subTabPill,
                  isActive
                    ? styles.subTabPillActive
                    : [styles.subTabPillInactive, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }],
                  isLiveTab && styles.subTabPillLive,
                ]}
                activeOpacity={0.8}
              >
                {isLiveTab && <View style={styles.livePulseDot} />}
                <Icon
                  name={iconMap[tab] || 'circle'}
                  size={13}
                  color={isLiveTab ? '#10B981' : isActive ? '#FFFFFF' : themeColors.textSecondary}
                />
                <Text
                  style={[
                    styles.subTabPillText,
                    isActive
                      ? styles.subTabPillTextActive
                      : [styles.subTabPillTextInactive, { color: themeColors.textSecondary }],
                    isLiveTab && styles.subTabPillLiveText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Sub-Tab Body Router ──────────────────────────────────────────────── */}
      {activeSubTab === 'Chat' && (
        <View style={styles.tabContentFlex}>
          {/* Chat Messages List */}
          {loadingMessages && messages.length === 0 ? (
            <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false}>
              <ChatMessagesSkeleton showAvatars={true} showAuthorNames={true} />
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              extraData={flatListExtraData}
              keyExtractor={keyExtractor}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesList}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews={Platform.OS === 'android'}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => {
                shouldScrollToEndRef.current = false;
              }}
              onContentSizeChange={() => {
                if (shouldScrollToEndRef.current && messages && messages.length > 0) {
                  try {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  } catch { }
                }
              }}
              ListHeaderComponent={
                hasMoreOlder ? (
                  <TouchableOpacity
                    style={styles.loadOlderBtn}
                    onPress={fetchOlderMessages}
                    disabled={loadingOlder}
                    activeOpacity={0.7}
                  >
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={ORANGE} />
                    ) : (
                      <>
                        <Icon name="chevron-up" size={14} color="#6B7280" />
                        <Text style={styles.loadOlderText}>Load earlier messages</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                !loadingMessages ? (
                  <View style={styles.emptyMessagesContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(255, 107, 0, 0.12)' : '#FFF7ED' }]}>
                      <Icon name="message-square" size={28} color={ORANGE} />
                    </View>
                    <Text style={[styles.emptyMessagesTitle, { color: themeColors.textPrimary }]}>
                      Welcome to ProjectSpace Chat
                    </Text>
                    <Text style={[styles.emptyMessagesSub, { color: themeColors.textSecondary }]}>
                      Collaborate with your crew in real time. Send messages, share production assets, and schedule calls.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}

          {/* Reply Banner */}
          {replyingTo && (() => {
            const repThumb = getReplyThumbnail(replyingTo);
            const repAuthor = replyingTo.profiles?.full_name || replyingTo.profiles?.username || 'Crew Member';
            const snippet = getReplySnippet(replyingTo, replyingTo.content);

            return (
              <View style={[styles.replyBanner, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
                <View style={styles.replyBannerIndicator} />
                <View style={[styles.replyBannerTextCol, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replyBannerAuthor}>
                      Replying to {repAuthor}
                    </Text>
                    <Text style={[styles.replyBannerSnippet, { color: themeColors.textSecondary }]} numberOfLines={1}>
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
                <TouchableOpacity
                  onPress={() => setReplyingTo(null)}
                  style={styles.replyBannerCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={14} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Attached Files Preview Bar */}
          {attachedFiles.length > 0 && (
            <View style={[styles.attachedFileBar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                {attachedFiles.map((file, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 }}>
                    <Icon
                      name={
                        file.type?.startsWith('image/')
                          ? 'image'
                          : file.type?.startsWith('video/')
                            ? 'video'
                            : 'paperclip'
                      }
                      size={14}
                      color={ORANGE}
                    />
                    <Text style={[styles.attachedFileName, { color: themeColors.textPrimary, maxWidth: 140 }]} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <TouchableOpacity onPress={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))} style={styles.attachedFileCloseBtn}>
                      <Icon name="x" size={14} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Chat Composer */}
          <View style={[styles.composerContainer, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
            <TouchableOpacity
              style={[
                styles.composerIconBtn,
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

            <TouchableOpacity
              style={styles.composerIconBtn}
              onPress={handlePickMedia}
            >
              <Icon name="paperclip" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[styles.composerInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]}
              placeholder="Send message or share media..."
              placeholderTextColor={themeColors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => {
                if (showComposerEmojiPicker) setShowComposerEmojiPicker(false);
              }}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, ((!inputText.trim() && attachedFiles.length === 0) || sending) && styles.sendBtnDisabled]}
              onPress={handleSendMessage}
              disabled={(!inputText.trim() && attachedFiles.length === 0) || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="send" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

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
                            setActiveEmojiCategory(cat.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.googleEmojiTabIcon}>{cat.iconEmoji}</Text>
                          <Text
                            style={[
                              styles.googleEmojiTabLabel,
                              { color: isActive ? (isDark ? '#FFFFFF' : '#0D0D0D') : themeColors.textMuted },
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
                      setInputText((prev) => Array.from(prev).slice(0, -1).join(''));
                    }}
                    onLongPress={() => {
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
        </View>
      )}

      {/* ── Sub-Tab: Tasks ───────────────────────────────────────────────────── */}
      {activeSubTab === 'Tasks' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCategoryTag}>WORKSPACE</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Production Tasks</Text>
          </View>

          {/* Search Filter */}
          <View style={[styles.searchBarContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={16} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchBarInput, { color: themeColors.textPrimary }]}
              placeholder="Find a task or asset..."
              placeholderTextColor={themeColors.textMuted}
              value={taskSearch}
              onChangeText={setTaskSearch}
            />
          </View>

          {/* New Task Composer Card */}
          <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={styles.composerCardLabel}>NEW PRODUCTION STEP</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Task title..."
              placeholderTextColor={themeColors.textMuted}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Description (Optional)"
              placeholderTextColor={themeColors.textMuted}
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
            />
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Due Date (YYYY-MM-DD)"
              placeholderTextColor={themeColors.textMuted}
              value={newTaskDueDate}
              onChangeText={setNewTaskDueDate}
            />
            <TouchableOpacity
              style={[styles.primaryActionBtn, (!newTaskTitle.trim() || addingTask) && styles.btnDisabled]}
              onPress={handleAddTask}
              disabled={!newTaskTitle.trim() || addingTask}
            >
              {addingTask ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionBtnText}>Deploy Task</Text>
              )}
            </TouchableOpacity>
          </Card>

          {/* Task List */}
          <View style={styles.cardsList}>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((t) => (
                <View key={t.id} style={[styles.taskCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <TouchableOpacity
                    style={[styles.checkboxSquare, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, t.is_completed && styles.checkboxSquareChecked]}
                    onPress={() => handleToggleTask(t.id, t.is_completed)}
                  >
                    {t.is_completed && <Icon name="check" size={13} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.taskCardTitle, { color: themeColors.textPrimary }, t.is_completed && styles.taskCardTitleDone]}
                      onPress={() => handleToggleTask(t.id, t.is_completed)}
                    >
                      {t.name}
                    </Text>
                    {t.description ? <Text style={[styles.taskCardDesc, { color: themeColors.textSecondary }]}>{t.description}</Text> : null}
                    {t.due_date ? <Text style={styles.taskCardDueDate}>Due: {t.due_date}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteTask(t.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="trash-2" size={15} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="layers" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Active Tasks</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Keep the production moving by deploying steps above.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Files ───────────────────────────────────────────────────── */}
      {activeSubTab === 'Files' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionCategoryTag}>STORAGE ASSETS</Text>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Production Documents</Text>
            </View>
            <TouchableOpacity
              style={styles.headerSmallBtn}
              onPress={handleCreateDocument}
              disabled={uploadingDoc}
            >
              {uploadingDoc ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="plus" size={14} color="#FFFFFF" />
                  <Text style={styles.headerSmallBtnText}>Upload Asset</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Filter */}
          <View style={[styles.searchBarContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={16} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchBarInput, { color: themeColors.textPrimary }]}
              placeholder="Filter lookbooks and scripts..."
              placeholderTextColor={themeColors.textMuted}
              value={fileSearch}
              onChangeText={setFileSearch}
            />
          </View>

          {/* Files 2-Column Grid Matching Web Card UI */}
          <View style={styles.filesGrid}>
            {filteredFiles.length > 0 ? (
              filteredFiles.map((f) => {
                const isImg = isImageFile(f.name, f.file_type);
                return (
                  <View key={f.id} style={[styles.webFileCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    {/* Top Preview Area */}
                    <View style={[styles.webFilePreviewBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB', borderBottomColor: themeColors.border }]}>
                      {isImg ? (
                        <Image source={{ uri: f.url, cache: 'force-cache' }} style={styles.webFileImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.webFileDocIconBox}>
                          <Icon name="file-text" size={28} color="#3B82F6" />
                        </View>
                      )}

                      {/* Overlay Action Buttons */}
                      <View style={styles.webFileOverlayRow}>
                        <TouchableOpacity
                          style={styles.webFileActionCircle}
                          onPress={() => handleOpenFile(f.url, 'project-files')}
                        >
                          <Icon name="eye" size={13} color="#1F2937" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.webFileActionCircle}
                          onPress={() => handleOpenFile(f.url, 'project-files')}
                        >
                          <Icon name="download" size={13} color="#1F2937" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Bottom Info Area */}
                    <View style={[styles.webFileInfoArea, { backgroundColor: themeColors.bgCard }, isImg && { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.08)' : '#FFF7ED' }]}>
                      <Text style={[styles.webFileName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <View style={styles.webFileMetaRow}>
                        <Text style={[styles.webFileSize, { color: themeColors.textSecondary }]}>{formatFileSize(f.size)}</Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteFile(f.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="trash-2" size={13} color={themeColors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={[styles.emptyStateContainer, { width: '100%' }]}>
                <Icon name="folder" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Documents Found</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Tap 'Upload Asset' to register scripts, lookbooks, or cues.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Team ────────────────────────────────────────────────────── */}
      {activeSubTab === 'Team' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCategoryTag}>CREW MANAGEMENT</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Production Team</Text>
          </View>

          {/* Search Filter */}
          <View style={[styles.searchBarContainer, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={16} color={themeColors.textMuted} />
            <TextInput
              style={[styles.searchBarInput, { color: themeColors.textPrimary }]}
              placeholder="Search team members by name or craft..."
              placeholderTextColor={themeColors.textMuted}
              value={teamSearch}
              onChangeText={setTeamSearch}
            />
          </View>

          {/* Crew List */}
          <View style={styles.cardsList}>
            {filteredTeam.length > 0 ? (
              filteredTeam.map((m, idx) => (
                <View key={m.id || idx} style={[styles.crewCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  {m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url, cache: 'force-cache' }} style={styles.crewAvatar} />
                  ) : (
                    <View style={styles.crewAvatarFallback}>
                      <Text style={styles.crewAvatarInitial}>{((m.full_name || m.username || 'C').charAt(0)).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.crewMetaCol}>
                    <Text style={[styles.crewName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {m.full_name || m.username || 'Crew Member'}
                    </Text>
                    <Text style={styles.crewCraft}>CRAFT // {(m.craft || m.role || 'Filmmaker').toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.crewRoleBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }]}
                    onPress={() => {
                      if (editingCrewId !== m.id) {
                        setEditingCrewId(m.id);
                        setTempCrewRole(m.role || '');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {editingCrewId === m.id ? (
                      <TextInput
                        style={[styles.crewRoleBadgeText, { color: themeColors.textPrimary, padding: 0, minWidth: 60 }]}
                        value={tempCrewRole}
                        onChangeText={setTempCrewRole}
                        autoFocus
                        onBlur={() => handleUpdateCrewRole(m.id)}
                        onSubmitEditing={() => handleUpdateCrewRole(m.id)}
                      />
                    ) : (
                      <Text style={[styles.crewRoleBadgeText, { color: themeColors.textSecondary }]}>{(m.role || 'Crew').toUpperCase()}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="users" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Crew Members</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Review applicants or onboard collaborators from discovery.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Call Sheet ──────────────────────────────────────────────── */}
      {activeSubTab === 'Call Sheet' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionCategoryTag}>DAILY CALL SHEETS</Text>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Daily Call Sheet</Text>
            </View>
            <TouchableOpacity
              style={styles.headerSmallBtn}
              onPress={() => setNewCallSheetModalVisible(true)}
            >
              <Icon name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.headerSmallBtnText}>New Sheet</Text>
            </TouchableOpacity>
          </View>

          {/* Slate Cards List */}
          {callSheets.length > 0 ? (
            callSheets.map((cs, idx) => (
              <Card key={cs.id || idx} style={[styles.slateCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.slateHeaderRow}>
                  <View style={styles.slateTitleGroup}>
                    <Icon name="calendar" size={16} color={ORANGE} />
                    <Text style={[styles.slateMainDay, { color: themeColors.textPrimary }]}>SHOOT DATE: {cs.date}</Text>
                  </View>
                  <View style={styles.publishedBadge}>
                    <Text style={styles.publishedBadgeText}>PUBLISHED</Text>
                  </View>
                </View>

                <View style={[styles.slateDetailsGrid, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB' }]}>
                  <View style={styles.slateDetailItem}>
                    <Text style={[styles.slateDetailLabel, { color: themeColors.textMuted }]}>GENERAL CALL</Text>
                    <Text style={[styles.slateDetailValue, { color: themeColors.textPrimary }]}>{cs.call_time || '06:00 AM'}</Text>
                  </View>
                  <View style={styles.slateDetailItem}>
                    <Text style={[styles.slateDetailLabel, { color: themeColors.textMuted }]}>LOCATION</Text>
                    <Text style={[styles.slateDetailValue, { color: themeColors.textPrimary }]}>{cs.location || 'Central Studio'}</Text>
                  </View>
                  <View style={styles.slateDetailItem}>
                    <Text style={[styles.slateDetailLabel, { color: themeColors.textMuted }]}>DIRECTOR</Text>
                    <Text style={[styles.slateDetailValue, { color: themeColors.textPrimary }]}>{cs.director || 'Director'}</Text>
                  </View>
                  <View style={styles.slateDetailItem}>
                    <Text style={[styles.slateDetailLabel, { color: themeColors.textMuted }]}>PRODUCER</Text>
                    <Text style={[styles.slateDetailValue, { color: themeColors.textPrimary }]}>{cs.producer || 'Producer'}</Text>
                  </View>
                </View>

                {cs.notes && (
                  <View style={styles.slateNotesBox}>
                    <Text style={[styles.slateNotesText, { color: themeColors.textSecondary }]}>{cs.notes}</Text>
                  </View>
                )}

                <View style={styles.slateActionsRow}>
                  <TouchableOpacity
                    style={styles.slateDownloadBtn}
                    onPress={() => Alert.alert('Download PDF', 'Generating high-res production PDF...')}
                  >
                    <Icon name="download" size={14} color="#FFFFFF" />
                    <Text style={styles.slateDownloadBtnText}>Download PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.slateDeleteBtn}
                    onPress={() => handleDeleteCallSheet(cs.id)}
                  >
                    <Icon name="trash-2" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.emptyStateContainer}>
              <Icon name="calendar" size={32} color={themeColors.textMuted} />
              <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Published Call Sheets</Text>
              <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Tap 'New Sheet' to schedule cast calls, locations, and shoot dates.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Sub-Tab: Shot List ───────────────────────────────────────────────── */}
      {activeSubTab === 'Shot List' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCategoryTag}>VISUAL CONTINUITY</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Scene & Shot Sequence</Text>
          </View>

          {/* Shot Composer Card */}
          <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={styles.composerCardLabel}>ALLOCATE SHOT SEQUENCE</Text>
            <View style={styles.twoColRow}>
              <View style={styles.colFlex}>
                <Text style={[styles.fieldLabelSmall, { color: themeColors.textSecondary }]}>SCENE #</Text>
                <TextInput
                  style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  value={newScene}
                  onChangeText={setNewScene}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.colFlex}>
                <Text style={[styles.fieldLabelSmall, { color: themeColors.textSecondary }]}>SHOT #</Text>
                <TextInput
                  style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  value={newShot}
                  onChangeText={setNewShot}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabelSmall, { color: themeColors.textSecondary }]}>DESCRIPTION / FRAMING</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="e.g. Medium close-up on lead as explosion occurs"
              placeholderTextColor={themeColors.textMuted}
              value={newShotDesc}
              onChangeText={setNewShotDesc}
            />

            <TouchableOpacity
              style={[styles.primaryActionBtn, (!newShotDesc.trim() || addingShot) && styles.btnDisabled]}
              onPress={handleAddShot}
              disabled={!newShotDesc.trim() || addingShot}
            >
              {addingShot ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionBtnText}>Lock Shot Sequence</Text>
              )}
            </TouchableOpacity>
          </Card>

          {/* Shot Sequence List */}
          <View style={styles.cardsList}>
            {shots.length > 0 ? (
              shots.map((sh) => (
                <View key={sh.id} style={[styles.shotCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.shotHeaderRow}>
                    <View style={styles.shotPillBadge}>
                      <Text style={styles.shotPillBadgeText}>
                        SCENE {sh.scene} • SHOT {sh.shot}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.statusPillBadge,
                        sh.status === 'completed' ? styles.statusPillCompleted : styles.statusPillPending,
                      ]}
                      onPress={() => handleToggleShotStatus(sh.id, sh.status)}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          sh.status === 'completed' ? styles.statusPillTextCompleted : styles.statusPillTextPending,
                        ]}
                      >
                        {sh.status === 'completed' ? 'COMPLETED' : 'PENDING'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.shotDescription, { color: themeColors.textPrimary }]}>{sh.description}</Text>

                  <View style={styles.shotFooterRow}>
                    <TouchableOpacity
                      onPress={() => handleDeleteShot(sh.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash-2" size={14} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="film" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Shots Allocated</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Add scene sequence items above to maintain visual continuity.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Script Reader ───────────────────────────────────────────── */}
      {activeSubTab === 'Script Reader' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionCategoryTag}>PRODUCTION SCREENPLAY</Text>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Interactive Script Reader</Text>
            </View>
            <TouchableOpacity
              style={styles.headerSmallBtn}
              onPress={handleCreateDocument}
              disabled={uploadingDoc}
            >
              {uploadingDoc ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="plus" size={14} color="#FFFFFF" />
                  <Text style={styles.headerSmallBtnText}>Upload Script</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardsList}>
            {filteredFiles.filter(f => (f.name || '').toLowerCase().endsWith('.pdf')).length > 0 ? (
              filteredFiles.filter(f => (f.name || '').toLowerCase().endsWith('.pdf')).map((f) => (
                <View key={f.id} style={[styles.docCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.docIconBox}>
                    <Icon name="book-open" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.docMetaCol}>
                    <Text style={[styles.docTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={[styles.docSub, { color: themeColors.textSecondary }]}>
                      Script File • {new Date(f.created_at || Date.now()).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.docDownloadBtn}
                    onPress={() => handleOpenFile(f.url, 'project-files')}
                  >
                    <Icon name="maximize" size={16} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="book-open" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Screenplays Found</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Upload PDF scripts here or in the Files tab to read them.</Text>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 16, paddingHorizontal: 20 }]}
                  onPress={handleCreateDocument}
                >
                  <Text style={styles.primaryActionBtnText}>Upload PDF Screenplay</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Legal Docs ──────────────────────────────────────────────── */}
      {activeSubTab === 'Legal Docs' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionCategoryTag}>COMPLIANCE & LEGAL</Text>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Agreements & Clearances</Text>
            </View>
            <TouchableOpacity
              style={styles.headerSmallBtn}
              onPress={() => setNewLegalDocModalVisible(true)}
            >
              <Icon name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.headerSmallBtnText}>Add Document</Text>
            </TouchableOpacity>
          </View>

          {/* Legal Docs List */}
          <View style={styles.cardsList}>
            {legalDocs.length > 0 ? (
              legalDocs.map((d) => (
                <View key={d.id} style={[styles.legalDocCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.legalDocIconBox}>
                    <Icon name="shield" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.legalDocMetaCol}>
                    <Text style={[styles.legalDocTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={[styles.legalDocType, { color: themeColors.textSecondary }]}>
                      TYPE // {(d.document_type || 'CONTRACT').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.legalDocBadgeSigned}>
                    <Text style={styles.legalDocBadgeSignedText}>SIGNED</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.docDownloadBtn}
                    onPress={() => handleOpenFile(d.url, 'legal-documents')}
                  >
                    <Icon name="download" size={16} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteLegalDoc(d.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="trash-2" size={14} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="shield" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Agreements Found</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Tap 'Add Document' to register NDAs, performer releases, and clearances.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Budget ──────────────────────────────────────────────────── */}
      {activeSubTab === 'Budget' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCategoryTag}>FINANCIAL LEDGER</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Production Budget Allocation</Text>
          </View>

          {/* Top 3 Stat Cards */}
          <View style={styles.statCardsRow}>
            <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.statCardLabel, { color: themeColors.textSecondary }]}>TOTAL BUDGET</Text>
              <Text style={[styles.statCardValue, { color: themeColors.textPrimary }]}>₹{totalBudgetEst.toLocaleString()}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.statCardLabel, { color: themeColors.textSecondary }]}>ALLOCATED</Text>
              <Text style={[styles.statCardValue, { color: ORANGE }]}>
                ₹{totalAllocated.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.statCardLabel, { color: themeColors.textSecondary }]}>REMAINING</Text>
              <Text style={[styles.statCardValue, { color: '#10B981' }]}>
                ₹{remainingBudget.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Budget Item Composer Card */}
          <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={styles.composerCardLabel}>ALLOCATE EXPENSE</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Expense name (e.g. Camera Rental Day 1)"
              placeholderTextColor={themeColors.textMuted}
              value={newBudgetItemName}
              onChangeText={setNewBudgetItemName}
            />
            <View style={styles.twoColRow}>
              <View style={styles.colFlex}>
                <TextInput
                  style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="Cost Amount (₹)"
                  placeholderTextColor={themeColors.textMuted}
                  value={newBudgetCost}
                  onChangeText={setNewBudgetCost}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.colFlex}>
                <TextInput
                  style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                  placeholder="Category"
                  placeholderTextColor={themeColors.textMuted}
                  value={newBudgetCategory}
                  onChangeText={setNewBudgetCategory}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                (!newBudgetItemName.trim() || !newBudgetCost || addingBudgetItem) && styles.btnDisabled,
              ]}
              onPress={handleAddBudgetItem}
              disabled={!newBudgetItemName.trim() || !newBudgetCost || addingBudgetItem}
            >
              {addingBudgetItem ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionBtnText}>Allocate Budget</Text>
              )}
            </TouchableOpacity>
          </Card>

          {/* Budget Ledger List */}
          <View style={styles.cardsList}>
            {budgetItems.length > 0 ? (
              budgetItems.map((b) => (
                <View key={b.id} style={[styles.budgetLedgerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.budgetMetaCol}>
                    <Text style={[styles.budgetLedgerTitle, { color: themeColors.textPrimary }]}>{b.item_name}</Text>
                    <Text style={styles.budgetCategoryTag}>
                      {(b.category || 'EXPENSE').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.budgetAmountText, { color: themeColors.textPrimary }]}>
                    ₹{(parseFloat(b.estimated_cost) || 0).toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteBudgetItem(b.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="trash-2" size={14} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="dollar-sign" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Expenses Logged</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>Allocate equipment, talent, or staging costs above.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Applicants ──────────────────────────────────────────────── */}
      {activeSubTab === 'Applicants' && (
        <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionCategoryTag}>ROLE APPLICATIONS</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Crew Candidates</Text>
          </View>

          <View style={styles.cardsList}>
            {applicants.length > 0 ? (
              applicants.map((a) => (
                <Card key={a.id} style={[styles.applicantCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.applicantHeaderRow}>
                    <View style={styles.applicantAvatarCircle}>
                      <Text style={styles.applicantAvatarInitial}>
                        {(a.profiles?.full_name?.charAt(0) || 'A').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.applicantInfoCol}>
                      <Text style={[styles.applicantName, { color: themeColors.textPrimary }]}>
                        {a.profiles?.full_name || 'Applicant'}
                      </Text>
                      <Text style={styles.applicantRole}>
                        APPLYING FOR // {(a.profiles?.craft || 'Crew').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {a.message && (
                    <View style={[styles.applicantMessageBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB' }]}>
                      <Text style={[styles.applicantMessageText, { color: themeColors.textSecondary }]}>"{a.message}"</Text>
                    </View>
                  )}

                  <View style={styles.applicantActionsRow}>
                    <TouchableOpacity
                      style={styles.applicantAcceptBtn}
                      onPress={() => handleApplicantDecision(a.id, a.user_id, 'approved')}
                      disabled={processingApplicantId === a.id}
                    >
                      {processingApplicantId === a.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.applicantAcceptBtnText}>Accept</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.applicantRejectBtn}
                      onPress={() => handleApplicantDecision(a.id, a.user_id, 'rejected')}
                      disabled={processingApplicantId === a.id}
                    >
                      <Text style={styles.applicantRejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="user-plus" size={32} color={themeColors.textMuted} />
                <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Pending Applicants</Text>
                <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>All candidate requests have been reviewed.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Sub-Tab: Settings (Exact Web Parity) ──────────────────────────────── */}
      {activeSubTab === 'Settings' && (
        <View style={styles.tabContentFlex}>
          {isSettingsMenu ? (
            /* Master Menu View */
            <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
              {/* Project Header Banner */}
              <View style={[styles.settingsHeaderBanner, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity style={styles.settingsThumbCircle} onPress={handleUpdateAvatar}>
                  {stImageUrl ? (
                    <Image source={{ uri: stImageUrl, cache: 'force-cache' }} style={styles.settingsThumbImage} />
                  ) : (
                    <Icon name="camera" size={28} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
                <View style={styles.settingsHeaderCol}>
                  <Text style={[styles.settingsHeaderTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {stTitle}
                  </Text>
                  <Text style={styles.settingsHeaderSub}>Production Space</Text>
                </View>
              </View>

              {/* Category: Project Management */}
              <Text style={[styles.settingsSectionHeading, { color: themeColors.textSecondary }]}>PROJECT MANAGEMENT</Text>

              <Card style={[styles.settingsMenuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                {/* Step: General Basics */}
                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setSettingsStep('basis');
                    setIsSettingsMenu(false);
                  }}
                >
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(255,75,51,0.1)' }]}>
                    <Icon name="user" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>General Basics</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Title, Story Synopsis, Location & Genres</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.settingsMenuDivider, { backgroundColor: themeColors.divider }]} />

                {/* Step: Budget & Timeline */}
                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setSettingsStep('financials');
                    setIsSettingsMenu(false);
                  }}
                >
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(255,75,51,0.1)' }]}>
                    <Icon name="dollar-sign" size={18} color={ORANGE} />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>Budget & Timeline</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Financial estimates & production dates</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.settingsMenuDivider, { backgroundColor: themeColors.divider }]} />

                {/* Step: Privacy & Scope */}
                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setSettingsStep('privacy');
                    setIsSettingsMenu(false);
                  }}
                >
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Icon name="lock" size={18} color="#3B82F6" />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>Privacy & Scope</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Marketplace visibility & phase status</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              </Card>

              {/* Category: Notifications */}
              <Text style={[styles.settingsSectionHeading, { color: themeColors.textSecondary, marginTop: 24 }]}>NOTIFICATIONS</Text>

              <Card style={[styles.settingsMenuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <View style={styles.settingsMenuItem}>
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: spaceNotifMute ? 'rgba(220,38,38,0.1)' : 'rgba(59,130,246,0.1)' }]}>
                    <Icon name={spaceNotifMute ? 'bell-off' : 'bell'} size={18} color={spaceNotifMute ? '#DC2626' : '#3B82F6'} />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>Mute Space</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Silence all push notifications from this project space</Text>
                  </View>
                  <Switch
                    value={spaceNotifMute}
                    onValueChange={(val) => {
                      setSpaceNotifMute(val);
                      saveSpaceNotifPrefs(val, spaceNotifMentionsOnly, spaceNotifSoundAlerts);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                  />
                </View>

                <View style={[styles.settingsMenuDivider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.settingsMenuItem}>
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Icon name="at-sign" size={18} color="#3B82F6" />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>Mentions Only</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Only notify when someone @mentions you</Text>
                  </View>
                  <Switch
                    value={spaceNotifMentionsOnly}
                    onValueChange={(val) => {
                      setSpaceNotifMentionsOnly(val);
                      saveSpaceNotifPrefs(spaceNotifMute, val, spaceNotifSoundAlerts);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                    disabled={spaceNotifMute}
                  />
                </View>

                <View style={[styles.settingsMenuDivider, { backgroundColor: themeColors.divider }]} />

                <View style={styles.settingsMenuItem}>
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Icon name="volume-2" size={18} color="#3B82F6" />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: themeColors.textPrimary }]}>Sound Alerts</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Play sound on incoming messages</Text>
                  </View>
                  <Switch
                    value={spaceNotifSoundAlerts}
                    onValueChange={(val) => {
                      setSpaceNotifSoundAlerts(val);
                      saveSpaceNotifPrefs(spaceNotifMute, spaceNotifMentionsOnly, val);
                    }}
                    trackColor={{ false: '#CBD5E1', true: ORANGE }}
                    disabled={spaceNotifMute}
                  />
                </View>
              </Card>

              {/* Category: Danger Zone */}
              <Text style={[styles.settingsSectionHeading, { color: '#DC2626', marginTop: 24 }]}>
                DANGER ZONE
              </Text>

              <Card style={[styles.settingsMenuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity
                  style={styles.settingsMenuItem}
                  onPress={() => {
                    setSettingsStep('danger');
                    setIsSettingsMenu(false);
                  }}
                >
                  <View style={[styles.settingsMenuIconBox, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
                    <Icon name="trash-2" size={18} color="#DC2626" />
                  </View>
                  <View style={styles.settingsMenuTextCol}>
                    <Text style={[styles.settingsMenuTitle, { color: '#DC2626' }]}>Security Actions</Text>
                    <Text style={[styles.settingsMenuDesc, { color: themeColors.textSecondary }]}>Terminate space or clear chat logs</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              </Card>
            </ScrollView>
          ) : (
            /* Step Detail View */
            <ScrollView style={[styles.tabBody, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.tabBodyContent}>
              <TouchableOpacity
                style={styles.settingsBackBtn}
                onPress={() => setIsSettingsMenu(true)}
              >
                <Icon name="arrow-left" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.settingsBackBtnText, { color: themeColors.textSecondary }]}>BACK TO MENU</Text>
              </TouchableOpacity>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionCategoryTag}>
                  {settingsStep === 'danger' ? 'ADVANCED' : 'SETTINGS'}
                </Text>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{settingsStep.toUpperCase()}</Text>
              </View>

              {/* Step: General Basics Form */}
              {settingsStep === 'basis' && (
                <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <Text style={styles.composerCardLabel}>PROJECT TITLE</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={stTitle}
                    onChangeText={setStTitle}
                    placeholder="The Masterpiece"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  <Text style={styles.composerCardLabel}>PRODUCTION LOCATION</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={stLocation}
                    onChangeText={setStLocation}
                    placeholder="e.g. Hyderabad, India"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  <Text style={styles.composerCardLabel}>STORY SYNOPSIS</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, height: 90 }]}
                    value={stDescription}
                    onChangeText={setStDescription}
                    placeholder="Brief production overview..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                  />

                  <Text style={styles.composerCardLabel}>GENRES</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={stGenre}
                    onChangeText={setStGenre}
                    placeholder="Action, Sci-Fi, Indie"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  <Text style={styles.composerCardLabel}>REQUIRED ROLES</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, marginTop: 4 }}>
                    {availableRoles.map((role) => {
                      const isSelected = stRequiredRoles.includes(role);
                      return (
                        <TouchableOpacity
                          key={role}
                          onPress={() => handleRoleToggle(role)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: isSelected ? '#FF4B33' : themeColors.border,
                            backgroundColor: isSelected ? '#FF4B33' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSelected ? '#FFFFFF' : themeColors.textPrimary }}>
                            {role}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={{ fontSize: 10, color: themeColors.textSecondary, marginBottom: 16 }}>
                    Toggle roles to open or close them. Deselecting a role will remove it from the open roles list.
                  </Text>
                </Card>
              )}

              {/* Step: Budget & Timeline Form */}
              {settingsStep === 'financials' && (
                <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.twoColRow}>
                    <View style={styles.colFlex}>
                      <Text style={styles.composerCardLabel}>MIN BUDGET (₹)</Text>
                      <TextInput
                        style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                        value={stBudgetMin}
                        onChangeText={setStBudgetMin}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={themeColors.textMuted}
                      />
                    </View>
                    <View style={styles.colFlex}>
                      <Text style={styles.composerCardLabel}>MAX BUDGET (₹)</Text>
                      <TextInput
                        style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                        value={stBudgetMax}
                        onChangeText={setStBudgetMax}
                        keyboardType="numeric"
                        placeholder="50000"
                        placeholderTextColor={themeColors.textMuted}
                      />
                    </View>
                  </View>

                  <Text style={styles.composerCardLabel}>PRODUCTION START</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={stStartDate}
                    onChangeText={setStStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={themeColors.textMuted}
                  />

                  <Text style={styles.composerCardLabel}>ESTIMATED WRAP</Text>
                  <TextInput
                    style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={stEndDate}
                    onChangeText={setStEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </Card>
              )}

              {/* Step: Privacy & Scope Form */}
              {settingsStep === 'privacy' && (
                <Card style={[styles.composerCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <Text style={styles.composerCardLabel}>PROJECT PHASE</Text>
                  <View style={styles.phaseSelectorRow}>
                    {['active', 'completed', 'archived', 'on_hold'].map((ph) => (
                      <TouchableOpacity
                        key={ph}
                        style={[styles.phasePill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }, stStatus === ph && styles.phasePillActive]}
                        onPress={() => setStStatus(ph)}
                      >
                        <Text style={[styles.phasePillText, { color: themeColors.textSecondary }, stStatus === ph && styles.phasePillTextActive]}>
                          {ph.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={[styles.publicSwitchRow, { borderTopColor: themeColors.divider }]}>
                    <View style={styles.colFlex}>
                      <Text style={[styles.publicSwitchTitle, { color: themeColors.textPrimary }]}>Public Visibility</Text>
                      <Text style={[styles.publicSwitchDesc, { color: themeColors.textSecondary }]}>
                        Enable discovery in the marketplace. When off, space is private.
                      </Text>
                    </View>
                    <Switch
                      value={stIsPublic}
                      onValueChange={setStIsPublic}
                      trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: ORANGE }}
                    />
                  </View>
                </Card>
              )}

              {/* Step: Danger Zone Actions */}
              {settingsStep === 'danger' && (
                <View style={{ gap: 14 }}>
                  <Card style={[styles.dangerActionCard, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2', borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2' }]}>
                    <Text style={styles.dangerActionCardTitle}>Delete Project</Text>
                    <Text style={[styles.dangerActionCardDesc, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                      This will permanently erase all budget logs, shot lists, call sheets and discussions.
                    </Text>
                    <TouchableOpacity
                      style={styles.dangerActionCardBtn}
                      onPress={handleDeleteProject}
                    >
                      <Text style={styles.dangerActionCardBtnText}>Terminate Entire Space</Text>
                    </TouchableOpacity>
                  </Card>

                  <Card style={[styles.dangerActionCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB', borderColor: themeColors.border }]}>
                    <Text style={[styles.dangerActionCardTitle, { color: themeColors.textPrimary }]}>
                      Clear Conversations
                    </Text>
                    <Text style={[styles.dangerActionCardDesc, { color: themeColors.textSecondary }]}>
                      Purge all message history from project spaces while keeping lists and files intact.
                    </Text>
                    <TouchableOpacity
                      style={[styles.dangerActionCardBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6', borderColor: themeColors.border }]}
                      onPress={handleClearChatHistory}
                    >
                      <Text style={[styles.dangerActionCardBtnText, { color: themeColors.textPrimary }]}>
                        Purge Chat History
                      </Text>
                    </TouchableOpacity>
                  </Card>
                </View>
              )}

              {/* Persistent Sync Action Buttons */}
              <View style={styles.syncSettingsBar}>
                <TouchableOpacity
                  style={[styles.syncResetBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }]}
                  onPress={() => {
                    if (projectData) {
                      setStTitle(projectData.title || '');
                      setStDescription(projectData.description || '');
                      setStStatus(projectData.status || 'active');
                      setStLocation(projectData.location || '');
                      setStGenre(projectData.genre ? (Array.isArray(projectData.genre) ? projectData.genre.join(', ') : projectData.genre) : '');
                    }
                  }}
                >
                  <Text style={[styles.syncResetBtnText, { color: themeColors.textSecondary }]}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.syncSaveBtn, savingSettings && styles.btnDisabled]}
                  onPress={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.syncSaveBtnText}>Sync Settings</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Modals: Wrap Project & Tag Crew Modal ────────────────────────────── */}
      <Modal visible={showWrapDialog} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>WRAP PROJECT & TAG CREW</Text>
            <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
              Officially wrap "{stTitle}". Tag crew members to publish verified credits to their portfolios.
            </Text>

            <ScrollView style={styles.modalScrollView}>
              {wrapCrewList.map((crew, idx) => (
                <View key={crew.user_id + idx} style={[styles.wrapCrewItem, { borderBottomColor: themeColors.divider }]}>
                  <TouchableOpacity
                    style={[styles.checkboxSquare, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, crew.selected && styles.checkboxSquareChecked]}
                    onPress={() =>
                      setWrapCrewList((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
                      )
                    }
                  >
                    {crew.selected && <Icon name="check" size={13} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <Text style={[styles.wrapCrewName, { color: themeColors.textPrimary }]}>{crew.full_name}</Text>
                  <TextInput
                    style={[styles.wrapCrewRoleInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }]}
                    value={crew.role}
                    onChangeText={(val) =>
                      setWrapCrewList((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, role: val } : c))
                      )
                    }
                    placeholder="Role"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }]}
                onPress={() => setShowWrapDialog(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmWrap}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Wrap & Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modals: New Call Sheet Modal ─────────────────────────────────────── */}
      <Modal visible={newCallSheetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>DEPLOY DAILY CALL SHEET</Text>

            <Text style={styles.composerCardLabel}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={csDate}
              onChangeText={setCsDate}
              placeholderTextColor={themeColors.textMuted}
            />

            <Text style={styles.composerCardLabel}>CALL TIME</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={csCallTime}
              onChangeText={setCsCallTime}
              placeholderTextColor={themeColors.textMuted}
            />

            <Text style={styles.composerCardLabel}>SHOOT LOCATION</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={csLocation}
              onChangeText={setCsLocation}
              placeholderTextColor={themeColors.textMuted}
            />

            <Text style={styles.composerCardLabel}>NOTES & SCENES</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={csNotes}
              onChangeText={setCsNotes}
              placeholderTextColor={themeColors.textMuted}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }]}
                onPress={() => setNewCallSheetModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateCallSheet}
                disabled={creatingCallSheet}
              >
                {creatingCallSheet ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Publish Slate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modals: New Legal Document Modal ─────────────────────────────────── */}
      <Modal visible={newLegalDocModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>REGISTER LEGAL DOCUMENT</Text>

            <Text style={styles.composerCardLabel}>DOCUMENT TITLE</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="e.g. Master Crew Non-Disclosure"
              placeholderTextColor={themeColors.textMuted}
              value={ldTitle}
              onChangeText={setLdTitle}
            />

            <Text style={styles.composerCardLabel}>DOCUMENT TYPE</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="NDA, Release, Contract, License"
              placeholderTextColor={themeColors.textMuted}
              value={ldType}
              onChangeText={setLdType}
            />

            <Text style={styles.composerCardLabel}>DESCRIPTION</Text>
            <TextInput
              style={[styles.composerCardInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder="Brief compliance notes..."
              placeholderTextColor={themeColors.textMuted}
              value={ldDescription}
              onChangeText={setLdDescription}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6' }]}
                onPress={() => setNewLegalDocModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateLegalDoc}
                disabled={creatingLegalDoc}
              >
                {creatingLegalDoc ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Save Agreement</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                      {infoModalMessage.profiles?.full_name || infoModalMessage.profiles?.username || 'Crew Member'}
                    </Text>
                    <Text style={[styles.messageInfoTimeText, { color: themeColors.textMuted }]}>
                      {new Date(infoModalMessage.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {/* If attachment */}
                  {infoModalMessage.attachment_url && (
                    <View style={styles.messageInfoMediaPreview}>
                      <Icon name="paperclip" size={14} color={ORANGE} />
                      <Text style={[styles.messageInfoMediaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        Attached {(infoModalMessage.attachment_type || 'file').toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.messageInfoContentText, { color: themeColors.textPrimary }]}>
                    {infoModalMessage.content}
                  </Text>

                  <View style={styles.messageInfoSecurityRow}>
                    <Icon name="lock" size={11} color="#10B981" />
                    <Text style={styles.messageInfoSecurityText}>End-to-end encrypted</Text>
                  </View>
                </View>
              )}

              {/* Read Receipts Section */}
              {(() => {
                if (!infoModalMessage) return null;
                const msgCreatedAtMs = new Date(infoModalMessage.created_at || Date.now()).getTime();
                const msgSenderId = infoModalMessage.user_id;

                const seenMap = new Map<string, { userId: string; name: string; avatarUrl?: string; readAt: string; readAtMs: number }>();

                // 1. Check from project_message_read_status
                (readStatuses || []).forEach((rs: any) => {
                  if (!rs.user_id || rs.user_id === msgSenderId) return;
                  if (!rs.last_read_at) return;
                  const readAtMs = new Date(rs.last_read_at).getTime();
                  if (readAtMs >= msgCreatedAtMs - 1000) {
                    const prof = Array.isArray(rs.profiles) ? rs.profiles[0] : rs.profiles;
                    const name = prof?.full_name || prof?.username || 'Crew Member';
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
                  const name = prof?.full_name || prof?.username || rx.user_name || 'Crew Member';
                  const existing = seenMap.get(rxUserId);
                  if (!existing || rxTimeMs < existing.readAtMs) {
                    seenMap.set(rxUserId, {
                      userId: rxUserId,
                      name: existing?.name && existing.name !== 'Crew Member' ? existing.name : name,
                      avatarUrl: existing?.avatarUrl || prof?.avatar_url,
                      readAt: rxTime,
                      readAtMs: rxTimeMs,
                    });
                  }
                });

                // 3. Check subsequent messages in the chat from other members
                const msgIndex = messages.findIndex((m) => m.id === infoModalMessage.id);
                if (msgIndex >= 0) {
                  for (let i = msgIndex + 1; i < messages.length; i++) {
                    const nextMsg = messages[i];
                    if (nextMsg.user_id && nextMsg.user_id !== msgSenderId) {
                      const nextMsgTimeMs = new Date(nextMsg.created_at).getTime();
                      const prof = Array.isArray(nextMsg.profiles) ? nextMsg.profiles[0] : nextMsg.profiles;
                      const name = prof?.full_name || prof?.username || 'Crew Member';
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
                                {(r.name?.charAt(0) || 'C').toUpperCase()}
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
    </KeyboardAvoidingView>
  );
};

// ── StyleSheet Definitions ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  e2eeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  e2eeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  headerActionBtn: {
    marginLeft: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,75,51,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,75,51,0.18)',
    marginLeft: 4,
  },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 60,
    marginVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  loadOlderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  // ── Sub-Navigation Pill Bar ────────────────────────────────────────────────
  subTabBarContainer: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  subTabBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  subTabPillActive: {
    backgroundColor: '#0D0D0D',
  },
  subTabPillInactive: {
    backgroundColor: '#F3F4F6',
  },
  subTabPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subTabPillTextActive: {
    color: '#FFFFFF',
  },
  subTabPillTextInactive: {
    color: '#374151',
  },

  // ── Content Layout ─────────────────────────────────────────────────────────
  tabContentFlex: {
    flex: 1,
  },
  tabBody: {
    flex: 1,
  },
  tabBodyContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  // ── Section Titles ─────────────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionCategoryTag: {
    fontSize: 9.5,
    fontWeight: '900',
    color: ORANGE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // ── Search Bars ────────────────────────────────────────────────────────────
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },

  // ── Form Composer Cards ────────────────────────────────────────────────────
  composerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  composerCardLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: ORANGE,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  composerCardInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#111827',
  },
  primaryActionBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colFlex: {
    flex: 1,
  },
  fieldLabelSmall: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  // ── Card Lists ─────────────────────────────────────────────────────────────
  cardsList: {
    gap: 10,
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  taskCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  taskCardTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskCardDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  taskCardDueDate: {
    fontSize: 10,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 4,
  },

  // ── Files ──────────────────────────────────────────────────────────────────
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  webFileCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  webFilePreviewBox: {
    width: '100%',
    height: 125,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    position: 'relative',
  },
  webFileImage: {
    width: '100%',
    height: '100%',
  },
  webFileDocIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFileOverlayRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  webFileActionCircle: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFileInfoArea: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  webFileInfoAreaImg: {
    backgroundColor: '#FFF7ED',
  },
  webFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  webFileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  webFileSize: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,75,51,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMetaCol: {
    flex: 1,
  },
  docTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  docSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  docDownloadBtn: {
    padding: 8,
  },

  // ── Team ───────────────────────────────────────────────────────────────────
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  crewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  crewAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,75,51,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crewAvatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: ORANGE,
  },
  crewMetaCol: {
    flex: 1,
  },
  crewName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  crewCraft: {
    fontSize: 8.5,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  crewRoleBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  crewRoleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#374151',
    letterSpacing: 0.5,
  },

  // ── Call Sheet ─────────────────────────────────────────────────────────────
  slateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  slateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slateTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slateMainDay: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
  },
  publishedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  publishedBadgeText: {
    color: '#059669',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  slateDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  slateDetailItem: {
    width: '45%',
  },
  slateDetailLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  slateDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  slateNotesBox: {
    borderLeftWidth: 2,
    borderLeftColor: ORANGE,
    paddingLeft: 8,
  },
  slateNotesText: {
    fontSize: 11,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  slateActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  slateDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
    height: 38,
  },
  slateDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  slateDeleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Shot List ──────────────────────────────────────────────────────────────
  shotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 8,
  },
  shotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shotPillBadge: {
    backgroundColor: 'rgba(255,75,51,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shotPillBadgeText: {
    color: ORANGE,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillCompleted: {
    backgroundColor: '#ECFDF5',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '900',
  },
  statusPillTextCompleted: {
    color: '#059669',
  },
  statusPillTextPending: {
    color: '#D97706',
  },
  shotDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  shotFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // ── Screenplay Paper ───────────────────────────────────────────────────────
  screenplayPaper: {
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 14,
  },
  screenplayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  screenplayPageNumber: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  screenplayDraftTag: {
    fontSize: 9,
    fontWeight: '800',
    color: ORANGE,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  screenplaySlugline: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textTransform: 'uppercase',
  },
  screenplayAction: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  screenplayDialogueBlock: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 2,
  },
  screenplayCharacter: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  screenplayParenthetical: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  screenplayDialogue: {
    fontSize: 12,
    color: '#111827',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 17,
  },
  screenplayNavigatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  sceneNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  sceneNavBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
  },
  sceneNavCounter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },

  // ── Legal Docs ─────────────────────────────────────────────────────────────
  legalDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  legalDocIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,75,51,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalDocMetaCol: {
    flex: 1,
  },
  legalDocTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111827',
  },
  legalDocType: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  legalDocBadgeSigned: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  legalDocBadgeSignedText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#059669',
  },

  // ── Budget ─────────────────────────────────────────────────────────────────
  statCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  statCardValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
  },
  budgetLedgerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  budgetMetaCol: {
    flex: 1,
  },
  budgetLedgerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111827',
  },
  budgetCategoryTag: {
    fontSize: 8,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  budgetAmountText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#111827',
  },

  // ── Applicants ─────────────────────────────────────────────────────────────
  applicantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  applicantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  applicantAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,75,51,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantAvatarInitial: {
    fontSize: 18,
    fontWeight: '900',
    color: ORANGE,
  },
  applicantInfoCol: {
    flex: 1,
  },
  applicantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  applicantRole: {
    fontSize: 8.5,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  applicantMessageBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: ORANGE,
  },
  applicantMessageText: {
    fontSize: 11.5,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  applicantActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  applicantAcceptBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  applicantRejectBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applicantRejectBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // ── Settings (Web Master Menu & Steps) ─────────────────────────────────────
  settingsHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  settingsThumbCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsThumbImage: {
    width: '100%',
    height: '100%',
  },
  settingsHeaderCol: {
    flex: 1,
  },
  settingsHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.3,
  },
  settingsHeaderSub: {
    fontSize: 10,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  settingsSectionHeading: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  settingsMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  settingsMenuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMenuTextCol: {
    flex: 1,
  },
  settingsMenuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  settingsMenuDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  settingsMenuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 70,
  },
  settingsBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  settingsBackBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  phaseSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phasePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  phasePillActive: {
    backgroundColor: '#0D0D0D',
  },
  phasePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4B5563',
  },
  phasePillTextActive: {
    color: '#FFFFFF',
  },
  publicSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  publicSwitchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  publicSwitchDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  dangerActionCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 16,
    gap: 8,
  },
  dangerActionCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#DC2626',
  },
  dangerActionCardDesc: {
    fontSize: 11.5,
    color: '#991B1B',
    lineHeight: 16,
  },
  dangerActionCardBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  dangerActionCardBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  syncSettingsBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  syncResetBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  syncSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Chat Messages ──────────────────────────────────────────────────────────
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  msgWrapper: {
    marginBottom: 8,
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dateBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#4B5563',
    letterSpacing: 0.8,
  },
  callEventRow: {
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
  callEventIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconGreen: {
    backgroundColor: '#DCFCE7',
  },
  callIconRed: {
    backgroundColor: '#FEE2E2',
  },
  callEventText: {
    color: '#111827',
    fontSize: 12.5,
    fontWeight: '700',
  },
  callEventTime: {
    color: '#94A3B8',
    fontSize: 10,
  },
  callActionBadge: {
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
  callActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  callJoinText: {
    color: '#059669',
  },
  callBackText: {
    color: '#64748B',
  },

  msgRowMe: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 6,
  },
  msgRowOther: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  msgColMe: {
    alignItems: 'flex-end',
    maxWidth: '100%',
  },
  msgColOther: {
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  bubbleMe: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
    paddingBottom: 8,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bubbleShareCard: {
    backgroundColor: 'transparent',
    padding: 0,
    borderWidth: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  transparentMediaWrapper: {
    padding: 0,
    marginVertical: 2,
    maxWidth: '100%',
  },
  shareCardContainer: {
    width: '100%',
  },
  bubbleMediaOnly: {
    backgroundColor: 'transparent',
    padding: 0,
    paddingBottom: 0,
    borderWidth: 0,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleMediaOnlyOther: {
    padding: 0,
    paddingBottom: 0,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleMediaWithCaptionMe: {
    padding: 0,
    paddingBottom: 6,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleMediaWithCaptionOther: {
    padding: 0,
    paddingBottom: 6,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  mediaOnlyImageContainerMe: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  mediaWithCaptionImageContainerMe: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  mediaOnlyImageContainerOther: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  mediaWithCaptionImageContainerOther: {
    borderRadius: 0,
  },
  captionContainerMe: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    width: '100%',
  },
  captionContainerOther: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    width: '100%',
  },
  floatingMetaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  floatingMetaTimeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  msgTextMe: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  msgTextOther: {
    color: '#111827',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  bubbleOtherHeader: {
    marginBottom: 4,
  },
  senderNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: ORANGE,
  },
  msgContentRowMe: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
  },
  msgContentRowOther: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
  },
  msgMetaMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    paddingBottom: 1,
  },
  msgMetaOther: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    paddingBottom: 1,
  },
  msgTimeMe: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
  },
  msgTimeOther: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,75,51,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: ORANGE,
  },
  smileReactBtn: {
    padding: 6,
    marginBottom: 4,
  },
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
  unifiedReactionsPillOwn: {
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
  readReceiptMeRow: {
    marginTop: 2,
  },
  readReceiptMeText: {
    fontSize: 9,
    fontWeight: '700',
    color: ORANGE,
  },

  // ── Reply Banner ───────────────────────────────────────────────────────────
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  replyBannerIndicator: {
    width: 3,
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  replyBannerTextCol: {
    flex: 1,
  },
  replyBannerAuthor: {
    fontSize: 11,
    fontWeight: '800',
    color: ORANGE,
  },
  replyBannerSnippet: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  replyBannerCloseBtn: {
    padding: 6,
  },

  // ── Chat Composer ──────────────────────────────────────────────────────────
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13.5,
    maxHeight: 100,
    color: '#111827',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },

  // ── Chat Call Strip ────────────────────────────────────────────────────────
  chatCallStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chatCallStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  chatCallStripTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 160,
  },
  chatCallStripBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  chatCallStripBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  chatCallBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatCallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,75,51,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,75,51,0.2)',
  },

  // ── Modals ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  modalScrollView: {
    maxHeight: 250,
  },
  wrapCrewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  wrapCrewName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  wrapCrewRoleInput: {
    width: 110,
    height: 34,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 11.5,
    color: '#111827',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // ── Menu Sheet Modal ───────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 8,
  },
  menuSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuSheetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Empty States ───────────────────────────────────────────────────────────
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  headerLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  headerLiveText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  subTabPillLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  subTabPillLiveText: {
    color: '#10B981',
    fontWeight: '800',
  },
  chatCallActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // ── Reaction, Selection & Empty Chat Styles ──────────────────────────────
  floatingReactionPicker: {
    position: 'absolute',
    top: -46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
    gap: 6,
  },
  reactionPickerRight: {
    right: 12,
  },
  reactionPickerLeft: {
    left: 48,
  },
  reactionEmojiBtn: {
    padding: 3,
  },
  reactionEmojiText: {
    fontSize: 20,
  },
  selectedBubbleHighlight: {
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    borderRadius: 16,
  },
  starIcon: {
    marginLeft: 4,
  },
  emptyMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyMessagesTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMessagesSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  // ── Forward & Selection Styles ─────────────────────────────────────────────
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
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
    fontSize: 18,
    fontWeight: '800',
  },
  selectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  selectionActionBtn: {
    padding: 4,
  },
  composerIconBtn: {
    padding: 6,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
  // ── Media Attachments & Lightbox Styles ────────────────────────────────────
  attachedFileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  attachedFileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  attachedFileName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  attachedFileCloseBtn: {
    padding: 4,
  },
  mediaAttachmentBox: {
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 14,
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
  mediaDocAttachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginVertical: 4,
    gap: 10,
    maxWidth: 240,
  },
  mediaDocIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 75, 51, 0.15)',
  },
  mediaDocInfo: {
    flex: 1,
  },
  mediaDocTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  mediaDocSub: {
    fontSize: 11,
    marginTop: 2,
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
});

export default ProjectSpaceScreen;

