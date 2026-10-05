import { ReportModal } from '../modals/ReportModal';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Icon } from '../common/Icon';
import { VerificationBadge } from '../common/VerificationBadge';
import { FormattedText } from '../common/FormattedText';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { JobShareCard } from '../chat/JobShareCard';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

export interface PostAuthor {
  id?: string;
  name: string;
  role?: string;
  craft?: string;
  avatar?: string;
  isVerified?: boolean;
  account_type?: string;
  username?: string;
}

export interface MediaItem {
  url: string;
  type?: 'image' | 'video';
  aspectRatio?: string;
  zoom?: number;
  pan?: { x: number; y: number };
  crop?: { top: number; right: number; bottom: number; left: number };
  filter?: string;
  filterName?: string;
  adjustments?: Record<string, number>;
  text_overlays?: Array<{
    id?: string;
    text: string;
    color?: string;
    bgColor?: string;
    fontSize?: number;
    x?: number;
    y?: number;
  }>;
  tagged_users?: Array<{
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    account_type?: string;
  }>;
}

export interface PostCardProps {
  id: string;
  author: PostAuthor;
  timeAgo?: string;
  content: string;
  mediaUrl?: string;
  mediaItems?: MediaItem[] | string;
  mediaUrls?: string[] | string;
  images?: string[] | string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  tags?: string[];
  isLiked?: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
  isFollowingAuthor?: boolean;
  isConnectedAuthor?: boolean;
  currentUserId?: string | null;
  currentUserAccountType?: string | null;
  hideLikes?: boolean;
  commentsDisabled?: boolean;
  location?: string | null;
  taggedUsers?: Array<{
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
    account_type?: string;
  }>;
  onLikeToggle?: (postId: string, newState: boolean) => void;
  onBookmarkToggle?: (postId: string, newState: boolean) => void;
  onCommentPress?: (postId: string) => void;
  onSharePress?: (postId: string, content: string) => void;
  onAuthorPress?: (authorId?: string, authorName?: string) => void;
  onHashtagPress?: (tag: string) => void;
  onMentionPress?: (username: string) => void;
  onDeletePost?: (postId: string) => void;
  onTogglePin?: (postId: string) => void;
  navigation?: any;
  initialShowComments?: boolean;
  isDetailView?: boolean;
}

// Global in-memory cache for dynamic image aspect ratios to prevent re-measurement churn on re-renders
const aspectRatioCache = new Map<string, number>();

const PostCardComponent: React.FC<PostCardProps> = ({
  id,
  author,
  timeAgo = 'RECENT',
  content,
  mediaUrl,
  mediaItems: initialMediaItems,
  mediaUrls: propMediaUrls,
  images: propImages,
  likeCount: initialLikeCount,
  commentCount: initialCommentCount,
  shareCount: initialShareCount,
  tags = [],
  isLiked: initialIsLiked = false,
  isBookmarked: initialIsBookmarked = false,
  isPinned = false,
  isFollowingAuthor = false,
  isConnectedAuthor = false,
  currentUserId,
  currentUserAccountType,
  hideLikes: propHideLikes = false,
  commentsDisabled: propCommentsDisabled = false,
  location: propLocation,
  taggedUsers: propTaggedUsers,
  onLikeToggle,
  onBookmarkToggle,
  onCommentPress,
  onSharePress,
  onAuthorPress,
  onHashtagPress,
  onMentionPress,
  onDeletePost,
  onTogglePin,
  navigation,
  initialShowComments = false,
  isDetailView = false,
}) => {
  const { themeColors, isDark } = useUserSettings();

  // ── Likes & Bookmarks State ──────────────────────────────────────────────────
  const [liked, setLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikeCount);
  const [bookmarked, setBookmarked] = useState(initialIsBookmarked);

  useEffect(() => {
    setLiked((curr) => (curr !== initialIsLiked ? initialIsLiked : curr));
  }, [initialIsLiked]);

  useEffect(() => {
    setLikesCount((curr) => (curr !== initialLikeCount ? initialLikeCount : curr));
  }, [initialLikeCount]);

  useEffect(() => {
    setBookmarked((curr) => (curr !== initialIsBookmarked ? initialIsBookmarked : curr));
  }, [initialIsBookmarked]);

  // ── Media & Dynamic Aspect Ratio Setup ──────────────────────────────────────
  const scrollViewRef = useRef<ScrollView>(null);

  const mediaList: MediaItem[] = React.useMemo(() => {
    let items: any[] = [];

    // 1. Check initialMediaItems prop
    if (initialMediaItems) {
      if (typeof initialMediaItems === 'string') {
        try {
          items = JSON.parse(initialMediaItems);
        } catch {
          items = [];
        }
      } else if (Array.isArray(initialMediaItems)) {
        items = initialMediaItems;
      }
    }

    // 2. Check propMediaUrls
    if (items.length === 0 && propMediaUrls) {
      let urls = propMediaUrls;
      if (typeof urls === 'string') {
        try {
          urls = JSON.parse(urls);
        } catch {
          urls = [];
        }
      }
      if (Array.isArray(urls)) {
        items = urls;
      }
    }

    // 3. Check propImages
    if (items.length === 0 && propImages) {
      let imgs = propImages;
      if (typeof imgs === 'string') {
        try {
          imgs = JSON.parse(imgs);
        } catch {
          imgs = [];
        }
      }
      if (Array.isArray(imgs)) {
        items = imgs;
      }
    }

    // 4. Fallback to single mediaUrl
    if (items.length === 0 && mediaUrl) {
      if (typeof mediaUrl === 'string' && (mediaUrl.startsWith('[') || mediaUrl.startsWith('{'))) {
        try {
          const parsed = JSON.parse(mediaUrl);
          if (Array.isArray(parsed)) items = parsed;
          else items = [mediaUrl];
        } catch {
          items = [mediaUrl];
        }
      } else {
        items = [mediaUrl];
      }
    }

    // Normalize array elements into standard MediaItem objects
    const normalized: MediaItem[] = items
      .map((item: any) => {
        if (typeof item === 'string') {
          const isVid = item.toLowerCase().includes('.mp4') || item.toLowerCase().includes('video');
          return { url: item, type: isVid ? 'video' : 'image' };
        }
        if (item && typeof item === 'object') {
          const url = item.url || item.media_url || item.uri || '';
          const isVid =
            item.type === 'video' ||
            url.toLowerCase().includes('.mp4') ||
            url.toLowerCase().includes('video');
          return {
            ...item,
            url,
            type: isVid ? 'video' : ('image' as const),
          };
        }
        return { url: '', type: 'image' as const };
      })
      .filter((m) => !!m.url);

    return normalized;
  }, [initialMediaItems, propMediaUrls, propImages, mediaUrl]);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const firstMedia = mediaList[0];
  const isHideLikes = propHideLikes || !!(firstMedia as any)?.hide_likes;
  const isCommentsDisabled = propCommentsDisabled || !!(firstMedia as any)?.comments_disabled;
  const location = propLocation || (firstMedia as any)?.location || null;
  const cachedRatio = firstMedia?.url ? aspectRatioCache.get(firstMedia.url) ?? null : null;
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(cachedRatio);

  // Synchronously update measured ratio when media URL changes
  const activeRatioFromCache = firstMedia?.url ? aspectRatioCache.get(firstMedia.url) || null : null;
  const currentRatio = measuredRatio || activeRatioFromCache;

  useEffect(() => {
    let isMounted = true;
    if (firstMedia?.url) {
      if (aspectRatioCache.has(firstMedia.url)) {
        const r = aspectRatioCache.get(firstMedia.url)!;
        if (isMounted) setMeasuredRatio(r);
        return;
      }

      // If aspectRatio is a known preset, use preset immediately
      const knownPresets: Record<string, number> = {
        '16:9': 16 / 9,
        '4:5': 4 / 5,
        '1:1': 1,
        '9:16': 9 / 16,
      };

      if (firstMedia?.aspectRatio && knownPresets[firstMedia.aspectRatio]) {
        const preset = knownPresets[firstMedia.aspectRatio];
        aspectRatioCache.set(firstMedia.url, preset);
        if (isMounted) setMeasuredRatio(preset);
        return;
      }

      Image.getSize(
        firstMedia.url,
        (width, height) => {
          if (isMounted && width > 0 && height > 0) {
            const rawRatio = width / height;
            // Clamp ratio between 0.75 (portrait) and 1.85 (landscape) for consistent card heights
            const clampedRatio = Math.max(0.75, Math.min(1.85, rawRatio));
            aspectRatioCache.set(firstMedia.url, clampedRatio);
            setMeasuredRatio(clampedRatio);
          }
        },
        () => {
          if (isMounted) {
            const fallback = 16 / 10;
            aspectRatioCache.set(firstMedia.url, fallback);
            setMeasuredRatio(fallback);
          }
        }
      );
    }
    return () => {
      isMounted = false;
    };
  }, [firstMedia?.url, firstMedia?.aspectRatio]);

  const effectiveRatio = React.useMemo(() => {
    if (currentRatio && currentRatio > 0) {
      return currentRatio;
    }
    if (firstMedia?.aspectRatio === '16:9') return 16 / 9;
    if (firstMedia?.aspectRatio === '4:5') return 4 / 5;
    if (firstMedia?.aspectRatio === '1:1') return 1;
    if (firstMedia?.aspectRatio === '9:16') return 9 / 16;
    return 16 / 10;
  }, [currentRatio, firstMedia?.aspectRatio]);

  const { isTablet, width: windowWidth } = useResponsive();
  const cardWidth = isTablet ? Math.min(windowWidth, 620) : windowWidth;

  const mediaHeight = React.useMemo(() => {
    const calculated = Math.round(cardWidth / effectiveRatio);
    // In detail view or standard mobile view, allow up to 640px so portrait/square images fit without cropping
    const maxAllowedHeight = isDetailView ? 640 : (isTablet ? 820 : 540);
    return Math.min(Math.max(calculated, 220), maxAllowedHeight);
  }, [cardWidth, effectiveRatio, isTablet, isDetailView]);

  // ── Double Tap & Floating Heart Animation ───────────────────────────────────
  const lastTapRef = useRef<number>(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  const triggerHeartAnimation = () => {
    setShowHeartAnim(true);
    heartScale.setValue(0.2);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.2,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowHeartAnim(false);
    });
  };

  const handleMediaPress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const nextState = !liked;
      setLiked(nextState);
      setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
      if (nextState) {
        triggerHeartAnimation();
      }
      onLikeToggle?.(id, nextState);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleLikeBtnPress = () => {
    const nextState = !liked;
    setLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    if (nextState) {
      triggerHeartAnimation();
    }
    onLikeToggle?.(id, nextState);
  };

  const handleBookmarkBtnPress = () => {
    const nextState = !bookmarked;
    setBookmarked(nextState);
    onBookmarkToggle?.(id, nextState);
  };

  // ── Carousel Scroll Handler ─────────────────────────────────────────────────
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideWidth = cardWidth > 0 ? cardWidth : event.nativeEvent.layoutMeasurement.width || 1;
    const slide = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (slide !== activeMediaIndex && slide >= 0 && slide < mediaList.length) {
      setActiveMediaIndex(slide);
    }
  };

  // ── Follow / Connect Inline Action ──────────────────────────────────────────
  const isMe = !!currentUserId && currentUserId === author.id;
  const isFanRelationship =
    currentUserAccountType === 'fan' || author.account_type === 'fan';

  const [followState, setFollowState] = useState<'none' | 'following' | 'connected' | 'pending'>(
    isFanRelationship
      ? isFollowingAuthor
        ? 'following'
        : 'none'
      : isConnectedAuthor
      ? 'connected'
      : 'none'
  );
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (isFanRelationship) {
      setFollowState(isFollowingAuthor ? 'following' : 'none');
    } else {
      setFollowState(isConnectedAuthor ? 'connected' : 'none');
    }
  }, [isFollowingAuthor, isConnectedAuthor, isFanRelationship]);

  const handleFollowConnect = async () => {
    if (!currentUserId || !author.id || isActionLoading) return;
    setIsActionLoading(true);

    try {
      const supabase = getSupabaseClient();
      if (isFanRelationship) {
        if (followState === 'following') {
          await (supabase as any)
            .from('user_follows')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', author.id);
          setFollowState('none');
        } else {
          await (supabase as any).from('user_follows').insert({
            follower_id: currentUserId,
            following_id: author.id,
          });
          setFollowState('following');
        }
      } else {
        if (followState === 'none') {
          await (supabase as any).from('user_connections').insert({
            follower_id: currentUserId,
            following_id: author.id,
            status: 'pending',
          });
          setFollowState('pending');
        }
      }
    } catch (e) {
      console.warn('[PostCard] Follow/Connect error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Tagged Users Modal ──────────────────────────────────────────────────────
  const allTaggedUsers = React.useMemo(() => {
    return propTaggedUsers || firstMedia?.tagged_users || [];
  }, [propTaggedUsers, firstMedia]);

  const [taggedSheetVisible, setTaggedSheetVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // ── Caption & Hashtag Deduplication ─────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  const isLongContent = (content || '').length > 140;

  const displayCaption = React.useMemo(() => {
    if (!content) return '';
    if (content.includes('JOB_SHARE::')) {
      return content.split('JOB_SHARE::')[0].trim();
    }
    return content;
  }, [content]);

  const jobShareData = React.useMemo(() => {
    if (content && content.includes('JOB_SHARE::')) {
      try {
        const parts = content.split('JOB_SHARE::');
        const jsonStr = parts[parts.length - 1].trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [content]);

  // Exclude tags that are already written in caption to avoid showing twice
  const nonDuplicateTags = React.useMemo(() => {
    if (!tags || tags.length === 0) return [];
    const lowerCaption = (displayCaption || '').toLowerCase();
    return tags.filter((tag) => {
      const clean = tag.replace(/^#/, '').toLowerCase();
      return !lowerCaption.includes(`#${clean}`);
    });
  }, [tags, displayCaption]);

  // ── Inline Comments (Only Active in PostDetailScreen) ───────────────────────
  const [showInlineComments, setShowInlineComments] = useState(!!isDetailView);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInputText, setCommentInputText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const commentInputRef = useRef<TextInput>(null);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setLoadingComments(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('post_comments' as any)
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_id,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            craft,
            is_verified
          )
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (data) setComments(data);
    } catch (e) {
      console.warn('[PostCard] Fetch comments error:', e);
    } finally {
      setLoadingComments(false);
    }
  }, [id]);

  useEffect(() => {
    if (showInlineComments && isDetailView) {
      fetchComments();

      const supabase = getSupabaseClient();
      const channel = supabase
        .channel(`postcard-comments:${id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${id}` },
          async (payload) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, username, avatar_url, craft, is_verified')
              .eq('id', payload.new.user_id)
              .single();

            const enriched = { ...(payload.new as any), profiles: profile };
            setComments((prev) => {
              if (prev.find((c) => c.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'post_comments', filter: `post_id=eq.${id}` },
          (payload) => {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [showInlineComments, isDetailView, id, fetchComments]);

  const handleCommentAction = () => {
    if (isCommentsDisabled) return;
    if (!isDetailView && onCommentPress) {
      onCommentPress(id);
    } else {
      setShowInlineComments((prev) => !prev);
    }
  };

  const handleReplyToComment = (c: any) => {
    setReplyTarget(c);
    const username = c.profiles?.username || c.profiles?.full_name?.replace(/\s+/g, '').toLowerCase() || '';
    if (username) {
      setCommentInputText(`@${username} `);
    }
    commentInputRef.current?.focus();
  };

  const handleSendComment = async () => {
    if (!commentInputText.trim() || !id) return;
    setSubmittingComment(true);
    const draft = commentInputText.trim();
    setCommentInputText('');

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to write a comment.');
        return;
      }

      const { error } = await supabase
        .from('post_comments' as any)
        .insert({
          post_id: id,
          user_id: user.id,
          content: draft,
          parent_id: replyTarget?.id || null,
        });

      if (error) throw error;
      setReplyTarget(null);
      fetchComments();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post comment.');
      setCommentInputText(draft);
    } finally {
      setSubmittingComment(false);
    }
  };

  const totalCommentCount = Math.max(initialCommentCount || 0, comments.length);

  return (
    <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: themeColors.bgCard }]}>
      {/* ── 0. Pinned Header Banner ───────────────────────────────────────────── */}
      {isPinned && (
        <View style={styles.pinnedBar}>
          <Icon name="pin" size={14} color={ORANGE} fill={ORANGE} />
          <Text style={styles.pinnedBarText}>PINNED POST</Text>
        </View>
      )}

      {/* ── 1. Author Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorGroup}
          activeOpacity={0.8}
          onPress={() => onAuthorPress?.(author.id, author.name)}
        >
          {author.avatar ? (
            <CachedImage
              uri={author.avatar}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(author.name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.authorTextContainer}>
            <View style={styles.authorNameRow}>
              <Text style={[styles.authorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {author.name}
              </Text>
              {!!author.isVerified && <VerificationBadge size="sm" />}

              {/* Inline Connect / Follow Button */}
              {!isMe && !!currentUserId && (
                <>
                  <Text style={styles.dotSeparator}>•</Text>
                  <TouchableOpacity
                    onPress={handleFollowConnect}
                    disabled={isActionLoading || followState === 'connected'}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator size="small" color={ORANGE} />
                    ) : (
                      <Text
                        style={[
                          styles.actionText,
                          (followState === 'following' ||
                            followState === 'connected' ||
                            followState === 'pending') &&
                            styles.actionTextInactive,
                        ]}
                      >
                        {isFanRelationship
                          ? followState === 'following'
                            ? 'Following'
                            : 'Follow'
                          : followState === 'connected'
                          ? 'Connected'
                          : followState === 'pending'
                          ? 'Pending'
                          : 'Connect'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.authorSubRow}>
              <Text style={[styles.authorSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {author.craft || author.role || 'Creator'}
                {timeAgo ? ` · ${timeAgo}` : ''}
              </Text>
              {!!location && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation?.navigate('Search', { query: location })}
                  style={styles.locationTouch}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                >
                  <Text style={styles.locationDot}>·</Text>
                  <Icon name="map-pin" size={10.5} color="#FF4B33" />
                  <Text style={[styles.locationText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {location}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setMoreMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="more-vertical" size={18} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── 2. Caption & Content (ON TOP, Matching Web App) ──────────────────── */}
      {!!displayCaption && (
        <View style={styles.captionContainer}>
          <FormattedText
            text={displayCaption}
            numberOfLines={expanded ? undefined : 3}
            onPressHashtag={(tag) => onHashtagPress?.(tag)}
            onPressMention={(uname) => onMentionPress?.(uname)}
            style={[styles.captionText, { color: themeColors.textPrimary }]}
            hashtagStyle={styles.hashtagHighlight}
            mentionStyle={styles.mentionHighlight}
          />

          {isLongContent && (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              style={styles.moreToggle}
            >
              <Text style={styles.moreToggleText}>
                {expanded ? 'see less' : '...more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 2b. Embedded Job Share Card if applicable ──────────────────────── */}
      {!!jobShareData && (
        <View style={styles.jobShareContainer}>
          <JobShareCard
            jobId={jobShareData.id || jobShareData.jobId || ''}
            title={jobShareData.title}
            company={jobShareData.company}
            location={jobShareData.location}
            salary={jobShareData.salary}
            type={jobShareData.type}
            logoUrl={jobShareData.logoUrl || jobShareData.logo_url}
            description={jobShareData.description}
            compact={true}
            navigation={navigation}
          />
        </View>
      )}

      {/* ── 3. Extra Tags (Deduplicated so hashtags never show twice) ───────── */}
      {nonDuplicateTags.length > 0 && (
        <View style={styles.tagsContainer}>
          {nonDuplicateTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.tagPill}
              onPress={() => onHashtagPress?.(tag.replace(/^#/, ''))}
            >
              <Text style={styles.tagPillText}>#{tag.replace(/^#/, '')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 4. Media Gallery (Dynamic Aspect Ratio, Never Overly Zoomed) ────── */}
      {mediaList.length > 0 && (
        <View style={[styles.mediaContainer, { width: cardWidth, height: mediaHeight }]}>
          {mediaList.length === 1 ? (
            <TouchableWithoutFeedback onPress={handleMediaPress}>
              <View style={[styles.mediaSlide, { width: cardWidth, height: mediaHeight }]}>
                <CachedImage
                  uri={mediaList[0].url}
                  style={styles.mediaImage}
                  resizeMode={isDetailView ? 'contain' : (effectiveRatio < 0.95 ? 'contain' : 'cover')}
                />

                {mediaList[0].type === 'video' && (
                  <View style={styles.videoPlayOverlay}>
                    <View style={styles.videoPlayCircle}>
                      <Icon name="play" size={22} color="#FFFFFF" />
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled={true}
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              snapToInterval={cardWidth}
              decelerationRate="fast"
              snapToAlignment="center"
              contentContainerStyle={{ height: mediaHeight }}
              style={StyleSheet.absoluteFill}
            >
              {mediaList.map((item, idx) => (
                <TouchableWithoutFeedback key={idx} onPress={handleMediaPress}>
                  <View style={[styles.mediaSlide, { width: cardWidth, height: mediaHeight }]}>
                    <CachedImage
                      uri={item.url}
                      style={styles.mediaImage}
                      resizeMode={isDetailView ? 'contain' : (effectiveRatio < 0.95 ? 'contain' : 'cover')}
                    />

                    {item.type === 'video' && (
                      <View style={styles.videoPlayOverlay}>
                        <View style={styles.videoPlayCircle}>
                          <Icon name="play" size={22} color="#FFFFFF" />
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              ))}
            </ScrollView>
          )}

          {/* Carousel Left & Right Arrow Buttons for smooth tap swiping */}
          {mediaList.length > 1 && activeMediaIndex > 0 && (
            <TouchableOpacity
              style={styles.carouselNavLeft}
              onPress={() => {
                const prevIdx = activeMediaIndex - 1;
                setActiveMediaIndex(prevIdx);
                scrollViewRef.current?.scrollTo({ x: prevIdx * cardWidth, animated: true });
              }}
              activeOpacity={0.8}
            >
              <Icon name="chevron-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {mediaList.length > 1 && activeMediaIndex < mediaList.length - 1 && (
            <TouchableOpacity
              style={styles.carouselNavRight}
              onPress={() => {
                const nextIdx = activeMediaIndex + 1;
                setActiveMediaIndex(nextIdx);
                scrollViewRef.current?.scrollTo({ x: nextIdx * cardWidth, animated: true });
              }}
              activeOpacity={0.8}
            >
              <Icon name="chevron-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Double Tap Floating Heart Animation */}
          {showHeartAnim && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatingHeartContainer,
                {
                  opacity: heartOpacity,
                  transform: [{ scale: heartScale }],
                },
              ]}
            >
              <Icon name="heart-fill" size={80} color="#FFFFFF" strokeWidth={0} />
            </Animated.View>
          )}

          {/* Carousel Image Index Badge (e.g. 1/3) */}
          {mediaList.length > 1 && (
            <View style={styles.indexBadge}>
              <Text style={styles.indexBadgeText}>
                {activeMediaIndex + 1}/{mediaList.length}
              </Text>
            </View>
          )}

          {/* Tagged People Icon Button */}
          {allTaggedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.tagPeopleBtn}
              activeOpacity={0.85}
              onPress={() => setTaggedSheetVisible(true)}
            >
              <Icon name="user" size={14} color="#FFFFFF" strokeWidth={2.2} />
              {allTaggedUsers.length > 1 && (
                <Text style={styles.tagPeopleCount}>{allTaggedUsers.length}</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Carousel Dots Pagination Indicator */}
          {mediaList.length > 1 && (
            <View style={styles.dotsRow}>
              {mediaList.map((_, i) => {
                const isActive = i === activeMediaIndex;
                return (
                  <View
                    key={i}
                    style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── 5. Action Bar (Under Media, Matching Web App) ───────────────────── */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeftGroup}>
          {/* Like */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={handleLikeBtnPress}
          >
            <Icon
              name={liked ? 'heart-fill' : 'heart'}
              size={22}
              color={liked ? '#EF4444' : (isDark ? '#E2E8F0' : '#1F2937')}
              strokeWidth={liked ? 0 : 2}
            />
            <Text style={[styles.actionCountText, { color: themeColors.textPrimary }, liked && styles.actionCountLiked]}>
              {isHideLikes ? (liked ? 'Liked' : 'Likes') : likesCount}
            </Text>
          </TouchableOpacity>

          {/* Comment Button */}
          {isCommentsDisabled ? (
            <View style={[styles.actionItem, { opacity: 0.55 }]}>
              <Icon name="message-circle" size={22} color={themeColors.textMuted} strokeWidth={1.9} />
              <Text style={[styles.actionCountText, { color: themeColors.textMuted, fontStyle: 'italic', fontSize: 12 }]}>
                Off
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={handleCommentAction}
            >
              <Icon name="message-circle" size={22} color={isDark ? '#E2E8F0' : '#1F2937'} strokeWidth={1.9} />
              <Text style={[styles.actionCountText, { color: themeColors.textPrimary }]}>{totalCommentCount}</Text>
            </TouchableOpacity>
          )}

          {/* Share */}
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => onSharePress?.(id, displayCaption)}
          >
            <Icon name="share" size={21} color={isDark ? '#E2E8F0' : '#1F2937'} strokeWidth={1.9} />
          </TouchableOpacity>
        </View>

        {/* Bookmark */}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          activeOpacity={0.7}
          onPress={handleBookmarkBtnPress}
        >
          <Icon
            name="bookmark"
            size={22}
            color={bookmarked ? ORANGE : (isDark ? '#E2E8F0' : '#1F2937')}
            fill={bookmarked ? ORANGE : 'none'}
            strokeWidth={bookmarked ? 2.5 : 1.9}
          />
        </TouchableOpacity>
      </View>

      {/* ── 6. "Comments are turned off" Notice OR "View all X comments" Link ── */}
      {isCommentsDisabled ? (
        <View style={styles.commentsDisabledContainer}>
          <Text style={[styles.commentsDisabledText, { color: themeColors.textMuted }]}>Comments are turned off for this post.</Text>
        </View>
      ) : totalCommentCount > 0 && !showInlineComments ? (
        <TouchableOpacity
          style={styles.viewCommentsLink}
          onPress={handleCommentAction}
        >
          <Text style={[styles.viewCommentsText, { color: themeColors.textSecondary }]}>
            View all {totalCommentCount} {totalCommentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ── 7. Inline Expandable Comments Section (Only Active on Detail Screen) ───────── */}
      {isDetailView && (
        isCommentsDisabled ? (
          <View style={styles.commentsDisabledDetailBox}>
            <Text style={styles.commentsDisabledText}>Comments are turned off for this post.</Text>
          </View>
        ) : showInlineComments ? (
        <View style={styles.inlineCommentsContainer}>
          <View style={styles.inlineCommentsHeader}>
            <Text style={styles.inlineCommentsTitle}>
              Comments ({comments.length})
            </Text>
            <TouchableOpacity onPress={() => setShowInlineComments(false)}>
              <Text style={styles.inlineCommentsClose}>Hide</Text>
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <ActivityIndicator color={ORANGE} size="small" style={{ paddingVertical: 16 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.noCommentsText}>
              No comments yet. Be the first to start the discussion!
            </Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((c) => {
                const cAuthor = c.profiles || {};
                const isOwn = c.user_id === currentUserId;
                const timeStr = c.created_at
                  ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <View key={c.id} style={styles.commentRow}>
                    <TouchableOpacity
                      onPress={() => onAuthorPress?.(cAuthor.id || c.user_id, cAuthor.full_name || cAuthor.username)}
                    >
                      {cAuthor.avatar_url ? (
                        <CachedImage
                          uri={cAuthor.avatar_url}
                          style={styles.commentRowAvatar}
                        />
                      ) : (
                        <View style={[styles.commentRowAvatar, styles.commentRowAvatarFallback, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                          <Text style={[styles.commentRowAvatarFallbackText, { color: themeColors.textPrimary }]}>
                            {(cAuthor.full_name || cAuthor.username || 'C').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={[styles.commentRowBody, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                      <View style={styles.commentRowTop}>
                        <TouchableOpacity
                          style={styles.commentAuthorNameRow}
                          onPress={() => onAuthorPress?.(cAuthor.id || c.user_id, cAuthor.full_name || cAuthor.username)}
                        >
                          <Text style={[styles.commentAuthorName, { color: themeColors.textPrimary }]}>
                            {cAuthor.full_name || cAuthor.username || 'Crew Member'}
                          </Text>
                          {!!cAuthor.is_verified && <VerificationBadge size="xs" />}
                        </TouchableOpacity>
                        <Text style={[styles.commentRowTime, { color: themeColors.textMuted }]}>{timeStr}</Text>
                      </View>

                      <FormattedText
                        text={c.content}
                        style={[styles.commentRowContent, { color: themeColors.textSecondary }]}
                        onPressHashtag={(t) => onHashtagPress?.(t)}
                        onPressMention={(u) => onMentionPress?.(u)}
                      />

                      <TouchableOpacity
                        style={styles.commentReplyBtn}
                        onPress={() => handleReplyToComment(c)}
                      >
                        <Text style={styles.commentReplyBtnText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Reply Context Banner */}
          {replyTarget && (
            <View style={[styles.replyTargetBanner, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
              <Text style={[styles.replyTargetText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                Replying to <Text style={{ fontWeight: '800', color: themeColors.textPrimary }}>{replyTarget.profiles?.full_name || 'Crew Member'}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <Icon name="x" size={14} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Add Comment Input Bar */}
          <View style={styles.inlineInputBar}>
            <TextInput
              ref={commentInputRef}
              style={[styles.inlineInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder={replyTarget ? 'Write a reply...' : 'Add a craft comment...'}
              placeholderTextColor={themeColors.textMuted}
              value={commentInputText}
              onChangeText={setCommentInputText}
            />
            <TouchableOpacity
              style={[
                styles.inlineSendBtn,
                (!commentInputText.trim() || submittingComment) && styles.inlineSendBtnDisabled,
              ]}
              onPress={handleSendComment}
              disabled={!commentInputText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Icon name="send" size={15} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
        ) : null
      )}

      {/* ── Tagged Users Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={taggedSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTaggedSheetVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTaggedSheetVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheetCard, { backgroundColor: themeColors.bgCard }]}>
                <View style={[styles.sheetHandle, { backgroundColor: themeColors.border }]} />
                <View style={[styles.sheetHeader, { borderBottomColor: themeColors.divider }]}>
                  <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>In this post</Text>
                  <TouchableOpacity
                    onPress={() => setTaggedSheetVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="x" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.sheetList}>
                  {allTaggedUsers.map((u, idx) => (
                    <TouchableOpacity
                      key={u.id || idx}
                      style={[styles.taggedUserRow, { borderBottomColor: themeColors.divider }]}
                      onPress={() => {
                        setTaggedSheetVisible(false);
                        onAuthorPress?.(u.id, u.full_name || u.username);
                      }}
                    >
                      {u.avatar_url ? (
                        <CachedImage
                          uri={u.avatar_url}
                          style={styles.taggedAvatar}
                        />
                      ) : (
                        <View style={[styles.taggedAvatar, styles.taggedAvatarFallback, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                          <Text style={[styles.taggedAvatarFallbackText, { color: themeColors.textPrimary }]}>
                            {(u.full_name || u.username || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.taggedMeta}>
                        <Text style={[styles.taggedUsername, { color: themeColors.textPrimary }]}>
                          @{u.username || 'filmmaker'}
                        </Text>
                        {!!u.full_name && (
                          <Text style={[styles.taggedFullName, { color: themeColors.textSecondary }]}>{u.full_name}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.taggedActionBtn, { backgroundColor: themeColors.inputBg }]}
                        onPress={() => {
                          setTaggedSheetVisible(false);
                          onAuthorPress?.(u.id, u.full_name || u.username);
                        }}
                      >
                        <Text style={[styles.taggedActionBtnText, { color: themeColors.textPrimary }]}>View</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── More Options Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
          <View style={styles.modalOverlayCenter}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    onSharePress?.(id, displayCaption);
                  }}
                >
                  <Icon name="share" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Share Post</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    handleBookmarkBtnPress();
                  }}
                >
                  <Icon name="bookmark" size={18} color={themeColors.textPrimary} />
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>
                    {bookmarked ? 'Remove Bookmark' : 'Bookmark Post'}
                  </Text>
                </TouchableOpacity>

                {isMe && onTogglePin && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMoreMenuVisible(false);
                      onTogglePin(id);
                    }}
                  >
                    <Icon name="pin" size={18} color={themeColors.textPrimary} />
                    <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>
                      {isPinned ? 'Unpin from Profile' : 'Pin to Profile'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isMe ? (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMoreMenuVisible(false);
                      Alert.alert(
                        'Delete Post',
                        'Are you sure you want to permanently delete this post?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => onDeletePost?.(id),
                          },
                        ]
                      );
                    }}
                  >
                    <Icon name="trash-2" size={18} color="#EF4444" />
                    <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
                      Delete Post
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMoreMenuVisible(false);
                      setReportOpen(true);
                    }}
                  >
                    <Icon name="x" size={18} color="#EF4444" />
                    <Text style={[styles.menuItemText, { color: '#EF4444' }]}>
                      Report Content
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetTitle="this post"
        targetType="post"
        targetId={id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
  },
  cardTablet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingBottom: 20,
  },
  jobShareContainer: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  pinnedBarText: {
    color: ORANGE,
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  avatarFallbackText: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '800',
  },
  authorTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
  },
  authorName: {
    color: '#0D0D0D',
    fontSize: 13.5,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  dotSeparator: {
    color: '#9CA3AF',
    fontSize: 10,
    marginHorizontal: 3,
    fontFamily: 'Inconsolata-Regular',
  },
  actionText: {
    color: ORANGE,
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  actionTextInactive: {
    color: '#9CA3AF',
    fontFamily: 'WorkSans-Medium',
    fontWeight: '600',
  },
  authorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginTop: 1,
    gap: 2,
  },
  authorSub: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '400',
  },
  locationTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  locationDot: {
    color: '#9CA3AF',
    fontSize: 11,
    marginRight: 2,
  },
  locationText: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: 'WorkSans-Medium',
    fontWeight: '500',
  },
  moreButton: {
    padding: 6,
  },
  captionContainer: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 10,
  },
  captionText: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '400',
  },
  hashtagHighlight: {
    color: ORANGE,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  mentionHighlight: {
    color: ORANGE,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  moreToggle: {
    marginTop: 3,
  },
  moreToggleText: {
    color: ORANGE,
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagPillText: {
    color: ORANGE,
    fontSize: 10,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaSlide: {
    position: 'relative',
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeartContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  indexBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  indexBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  tagPeopleBtn: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tagPeopleCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    zIndex: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: ORANGE,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCountText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  actionCountLiked: {
    color: '#EF4444',
  },
  bookmarkBtn: {
    padding: 2,
  },
  viewCommentsLink: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  viewCommentsText: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '600',
  },
  inlineCommentsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineCommentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inlineCommentsTitle: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  inlineCommentsClose: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  noCommentsText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    textAlign: 'center',
    paddingVertical: 12,
  },
  commentsList: {
    gap: 12,
    marginBottom: 12,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  commentRowAvatarFallback: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentRowAvatarFallbackText: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '800',
  },
  commentRowBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentAuthorName: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  commentRowTime: {
    color: '#9CA3AF',
    fontSize: 10,
    fontFamily: 'Inconsolata-Regular',
  },
  commentRowContent: {
    color: '#1F2937',
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    lineHeight: 18,
  },
  commentReplyBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  commentReplyBtnText: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  replyTargetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE5DF',
  },
  replyTargetText: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    flex: 1,
  },
  inlineInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'WorkSans-Regular',
    color: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineSendBtn: {
    backgroundColor: ORANGE,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'flex-end',
  },
  cardTextOverlayPill: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  cardTextOverlayContent: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '800',
  },
  sheetList: {
    paddingHorizontal: 16,
  },
  taggedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  taggedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  taggedAvatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  taggedAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '800',
  },
  taggedMeta: {
    flex: 1,
  },
  taggedUsername: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  taggedFullName: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
  },
  taggedActionBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  taggedActionBtnText: {
    color: '#111827',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  menuCard: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: '#1F2937',
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '600',
  },
  commentsDisabledContainer: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 2,
  },
  commentsDisabledText: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  commentsDisabledDetailBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
  },
  carouselNavLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  carouselNavRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

export const PostCard = React.memo(PostCardComponent, (prevProps, nextProps) => {
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.isLiked !== nextProps.isLiked) return false;
  if (prevProps.likeCount !== nextProps.likeCount) return false;
  if (prevProps.isBookmarked !== nextProps.isBookmarked) return false;
  if (prevProps.commentCount !== nextProps.commentCount) return false;
  if (prevProps.shareCount !== nextProps.shareCount) return false;
  if (prevProps.content !== nextProps.content) return false;
  if (prevProps.mediaUrl !== nextProps.mediaUrl) return false;
  if (prevProps.mediaUrls !== nextProps.mediaUrls) return false;
  if (prevProps.images !== nextProps.images) return false;
  if (prevProps.timeAgo !== nextProps.timeAgo) return false;
  if (prevProps.isFollowingAuthor !== nextProps.isFollowingAuthor) return false;
  if (prevProps.isConnectedAuthor !== nextProps.isConnectedAuthor) return false;
  if (prevProps.currentUserId !== nextProps.currentUserId) return false;
  if (prevProps.currentUserAccountType !== nextProps.currentUserAccountType) return false;
  if (prevProps.initialShowComments !== nextProps.initialShowComments) return false;
  if (prevProps.isDetailView !== nextProps.isDetailView) return false;
  if (prevProps.hideLikes !== nextProps.hideLikes) return false;
  if (prevProps.commentsDisabled !== nextProps.commentsDisabled) return false;
  if (prevProps.location !== nextProps.location) return false;

  // Author shallow comparison
  if (
    prevProps.author?.id !== nextProps.author?.id ||
    prevProps.author?.name !== nextProps.author?.name ||
    prevProps.author?.avatar !== nextProps.author?.avatar ||
    prevProps.author?.craft !== nextProps.author?.craft ||
    prevProps.author?.isVerified !== nextProps.author?.isVerified ||
    prevProps.author?.account_type !== nextProps.author?.account_type
  ) {
    return false;
  }

  // Media items array comparison
  if (prevProps.mediaItems !== nextProps.mediaItems) {
    if (
      !prevProps.mediaItems ||
      !nextProps.mediaItems ||
      prevProps.mediaItems.length !== nextProps.mediaItems.length
    ) {
      return false;
    }
  }

  // Tags array comparison
  if (prevProps.tags !== nextProps.tags) {
    if (
      !prevProps.tags ||
      !nextProps.tags ||
      prevProps.tags.length !== nextProps.tags.length ||
      prevProps.tags.some((t, i) => t !== nextProps.tags?.[i])
    ) {
      return false;
    }
  }

  return true;
});

export default PostCard;
