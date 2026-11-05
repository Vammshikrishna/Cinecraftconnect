import { CachedImage } from '../common/CachedImage';
import { ReportModal } from '../modals/ReportModal';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../common/Icon';
import { MentionInput } from '../common/MentionInput';
import { insertMentions, stillMentioned, type MentionUser } from '../../utils/mentions';
import { VerificationBadge } from '../common/VerificationBadge';
import { FormattedText } from '../common/FormattedText';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { DropdownTrigger, DropdownItem } from '../common/DropdownMenu';
import { useAppRole } from '../../hooks/useAppRole';
import { friendlyError } from '@cinecraft/core';

const ORANGE = '#FF4B33';
/** Longest comment allowed; the database enforces the same limit. */
const MAX_COMMENT_LENGTH = 2000;
/** Top-level comments shown at a time; "View more comments" adds this many again. */
const PAGE_SIZE = 20;
const PROFILE_FIELDS = 'id, full_name, username, avatar_url, craft, is_verified';
const COMMENT_FIELDS = `id, content, created_at, edited_at, user_id, parent_id, reply_to_user_id, is_pinned, is_hidden, like_count, profiles:user_id(${PROFILE_FIELDS}), reply_to:reply_to_user_id(username, full_name)`;
// the older columns only, for a database that has not had part BG yet
const LEGACY_COMMENT_FIELDS = `id, content, created_at, user_id, parent_id, profiles:user_id(${PROFILE_FIELDS})`;

interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  navigation?: any;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  visible,
  onClose,
  postId,
  navigation,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const { isInternal } = useAppRole(); // staff read comments, they do not write them
  const [comments, setComments] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [postAuthorId, setPostAuthorId] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'top'>('newest');
  const [topLimit, setTopLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const pickedMentionsRef = useRef<Record<string, MentionUser>>({});

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const loadTop = (fields: string, legacy: boolean) => {
        let q: any = (supabase as any).from('post_comments').select(fields).eq('post_id', postId).is('parent_id', null);
        if (!legacy) q = q.order('is_pinned', { ascending: false });
        q = !legacy && sort === 'top'
          ? q.order('like_count', { ascending: false }).order('created_at', { ascending: false })
          : q.order('created_at', { ascending: false });
        return q.limit(topLimit + 1);
      };

      let legacy = false;
      let top = await loadTop(COMMENT_FIELDS, false);
      if (top.error) {
        // part BG is not installed yet: fall back to the plain comment list
        legacy = true;
        top = await loadTop(LEGACY_COMMENT_FIELDS, true);
      }
      const topRows: any[] = top.data || [];
      setHasMore(topRows.length > topLimit);
      const pageTop = topRows.slice(0, topLimit);
      const ids = pageTop.map((c) => c.id);

      let replies: any[] = [];
      if (ids.length > 0) {
        const res = await (supabase as any)
          .from('post_comments')
          .select(legacy ? LEGACY_COMMENT_FIELDS : COMMENT_FIELDS)
          .in('parent_id', ids)
          .order('created_at', { ascending: true });
        replies = res.data || [];
      }
      const all = [...pageTop, ...replies];

      // people I blocked or muted are not shown, as in the feed
      const me = (await supabase.auth.getSession()).data.session?.user?.id;
      const hidden = new Set<string>();
      if (me) {
        const [blocked, muted] = await Promise.all([
          (supabase as any).from('blocked_users').select('blocked_user_id').eq('user_id', me),
          (supabase as any).from('muted_authors').select('author_id').eq('user_id', me),
        ]);
        (blocked.data || []).forEach((x: any) => x.blocked_user_id && hidden.add(x.blocked_user_id));
        (muted.data || []).forEach((x: any) => x.author_id && hidden.add(x.author_id));
        if (!legacy && all.length > 0) {
          const { data: mine } = await (supabase as any)
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', me)
            .in('comment_id', all.map((c) => c.id));
          setLikedIds(new Set((mine || []).map((l: any) => l.comment_id)));
        }
      }
      setComments(all.filter((c) => !hidden.has(c.user_id)));

      const { data: post } = await supabase.from('posts').select('author_id').eq('id', postId).maybeSingle();
      setPostAuthorId((post as any)?.author_id ?? null);
    } catch (e) {
      console.warn('[CommentsSheet] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [postId, sort, topLimit]);

  // the realtime handlers below always call the latest version
  const fetchRef = useRef(fetchComments);
  fetchRef.current = fetchComments;

  useEffect(() => {
    if (visible && postId) fetchComments();
  }, [visible, postId, fetchComments]);

  useEffect(() => {
    if (!visible || !postId) return;

    // Resolve current user
    const getUser = async () => {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (user) setCurrentUserId(user.id);
    };
    getUser();

    // Real-time subscription
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`post-comments-rt:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, postId]);

  const handleReplyPress = (comment: any) => {
    setReplyTo(comment);
    const username = comment.profiles?.username || comment.profiles?.full_name?.replace(/\s+/g, '').toLowerCase() || '';
    if (username) {
      setInput(`@${username} `);
    }
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (editingId) {
      if (input.trim().length > MAX_COMMENT_LENGTH) {
        Alert.alert('Comment is too long', `Please keep it under ${MAX_COMMENT_LENGTH} characters.`);
        return;
      }
      setSending(true);
      try {
        const supabase = getSupabaseClient();
        const { error } = await (supabase as any).from('post_comments').update({ content: input.trim() }).eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
        setInput('');
        fetchComments();
      } catch (e: any) {
        Alert.alert('Could not save your change', friendlyError(e, 'Please try again.'));
      } finally {
        setSending(false);
      }
      return;
    }
    if (input.trim().length > MAX_COMMENT_LENGTH) {
      Alert.alert('Comment is too long', `Please keep it under ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }
    setSending(true);
    const draft = input.trim();
    setInput('');

    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user || !postId) return;

      const { error } = await supabase
        .from('post_comments' as any)
        .insert({
          post_id: postId,
          user_id: user.id,
          content: draft,
          parent_id: replyTo?.id || null,
        });

      if (error) throw error;
      // same rows as web: the comment's mentions point at the post
      const mentionIds = stillMentioned(draft, pickedMentionsRef.current, user.id);
      pickedMentionsRef.current = {};
      if (mentionIds.length > 0) await insertMentions({ mentionerId: user.id, mentionedIds: mentionIds, relatedId: postId, relatedType: 'post' });
      setReplyTo(null);
      fetchComments();
      setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 150);
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not post comment.'));
      setInput(draft); // restore
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (commentId: string, userId: string) => {
    if (userId !== currentUserId && postAuthorId !== currentUserId) {
      Alert.alert('Permission denied', 'You can only delete your own comments, or comments on your own post.');
      return;
    }
    Alert.alert('Delete comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase
              .from('post_comments' as any)
              .delete()
              .eq('id', commentId);
            if (error) throw error;
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch (e: any) {
            Alert.alert('Error', friendlyError(e, 'Could not delete comment.'));
          }
        },
      },
    ]);
  };

  const toggleLike = async (commentId: string, liked: boolean) => {
    if (!currentUserId) return;
    setLikedIds((prev) => { const next = new Set(prev); liked ? next.delete(commentId) : next.add(commentId); return next; });
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, like_count: Math.max(0, (c.like_count || 0) + (liked ? -1 : 1)) } : c));
    const supabase: any = getSupabaseClient();
    const { error } = liked
      ? await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      : await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
    if (error) {
      Alert.alert('Could not update your like', friendlyError(error));
      fetchComments();
    }
  };

  const moderate = async (commentId: string, changes: { is_pinned?: boolean; is_hidden?: boolean }) => {
    const supabase: any = getSupabaseClient();
    const { error } = await supabase.from('post_comments').update(changes).eq('id', commentId);
    if (error) {
      Alert.alert('Could not do that', friendlyError(error));
      return;
    }
    fetchComments();
  };

  const commentMenuItems = (item: any): DropdownItem[] => {
    const mine = item.user_id === currentUserId;
    const iAmPostAuthor = !!currentUserId && postAuthorId === currentUserId;
    const options: DropdownItem[] = [];
    if (mine) {
      options.push({
        label: 'Edit',
        icon: 'edit-2',
        onPress: () => { setReplyTo(null); setEditingId(item.id); setInput(item.content); inputRef.current?.focus(); },
      });
    }
    if (iAmPostAuthor && !item.parent_id) {
      options.push({ label: item.is_pinned ? 'Unpin' : 'Pin to top', icon: 'pin', onPress: () => moderate(item.id, { is_pinned: !item.is_pinned }) });
    }
    if (iAmPostAuthor && !mine) {
      options.push({ label: item.is_hidden ? 'Show again' : 'Hide comment', icon: item.is_hidden ? 'eye' : 'eye-off', onPress: () => moderate(item.id, { is_hidden: !item.is_hidden }) });
    }
    return options;
  };

  // each top-level comment followed by its replies
  const displayItems = useMemo(() => {
    const out: any[] = [];
    comments.filter((c) => !c.parent_id).forEach((top) => {
      out.push(top);
      comments.filter((c) => c.parent_id === top.id).forEach((reply) => out.push({ ...reply, _isReply: true, _parentAuthorId: top.user_id }));
    });
    return out;
  }, [comments]);

  const navigateToUser = (userId?: string, creatorName?: string) => {
    if (!navigation) return;
    onClose();
    navigation.navigate('PublicProfile', {
      creatorId: userId,
      creatorName: creatorName,
    });
  };

  const renderComment = ({ item }: { item: any }) => {
    const author = item.profiles || {};
    const isOwn = item.user_id === currentUserId;
    const timeAgo = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.commentItem, item._isReply && { marginLeft: 34 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigateToUser(author.id || item.user_id, author.full_name || author.username)}
        >
          {author.avatar_url ? (
            <CachedImage uri={author.avatar_url} style={styles.commentAvatar} />
          ) : (
            <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
              <Text style={styles.commentAvatarFallbackText}>
                {(author.full_name || author.username || 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View
          style={[
            styles.commentContent,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
              borderColor: themeColors.border,
            },
            isOwn && styles.commentContentOwn,
          ]}
        >
          <View style={styles.commentHeader}>
            <TouchableOpacity
              style={styles.authorNameRow}
              onPress={() => navigateToUser(author.id || item.user_id, author.full_name || author.username)}
            >
              <Text style={[styles.authorName, { color: themeColors.textPrimary }]}>
                {author.full_name || author.username || 'Anonymous Crew'}
              </Text>
              {!!author.is_verified && <VerificationBadge size="xs" />}
            </TouchableOpacity>

            <View style={styles.commentHeaderRight}>
              <Text style={[styles.timeText, { color: themeColors.textMuted }]}>{timeAgo}</Text>
              {!isOwn && !!currentUserId && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Report"
                  onPress={() => setReportCommentId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="flag" size={12} color={themeColors.iconMuted} />
                </TouchableOpacity>
              )}
              {(isOwn || (!!currentUserId && postAuthorId === currentUserId)) && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete"
                  onPress={() => handleDelete(item.id, item.user_id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="trash-2" size={12} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.commentCraft}>
            {(author.craft || 'CREATOR').toUpperCase()}
            {item.is_pinned ? '  ·  PINNED' : ''}
            {item.is_hidden ? '  ·  HIDDEN' : ''}
          </Text>
          {item._isReply && item.reply_to?.username && item.reply_to_user_id !== item._parentAuthorId && !String(item.content || '').trimStart().startsWith('@') && (
            <Text style={{ color: ORANGE, fontSize: 12, marginBottom: 2 }}>@{item.reply_to.username}</Text>
          )}

          <FormattedText
            text={item.content}
            style={[styles.commentText, { color: themeColors.textPrimary }]}
            onPressMention={(uname) => {
              onClose();
              navigation?.navigate('Search', { query: `@${uname}` });
            }}
            onPressHashtag={(tag) => {
              onClose();
              navigation?.navigate('Search', { query: `#${tag}` });
            }}
          />

          {!!item.edited_at && (
            <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 2 }}>(edited)</Text>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
            <TouchableOpacity style={styles.replyBtn} onPress={() => handleReplyPress(item)}>
              <Icon name="corner-up-left" size={11} color={themeColors.iconSecondary} />
              <Text style={[styles.replyBtnText, { color: themeColors.textSecondary }]}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.replyBtn}
              accessibilityRole="button"
              accessibilityLabel={likedIds.has(item.id) ? 'Unlike comment' : 'Like comment'}
              onPress={() => toggleLike(item.id, likedIds.has(item.id))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="heart" size={12} color={likedIds.has(item.id) ? ORANGE : themeColors.textSecondary} fill={likedIds.has(item.id) ? ORANGE : 'none'} />
              {(item.like_count || 0) > 0 && (
                <Text style={[styles.replyBtnText, { color: likedIds.has(item.id) ? ORANGE : themeColors.textSecondary }]}>{item.like_count}</Text>
              )}
            </TouchableOpacity>
            {(item.user_id === currentUserId || (!!currentUserId && postAuthorId === currentUserId)) && (
              <DropdownTrigger
                style={styles.replyBtn}
                accessibilityLabel="More options"
                items={() => commentMenuItems(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="more-horizontal" size={14} color={themeColors.iconSecondary} />
              </DropdownTrigger>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.sheet, { backgroundColor: themeColors.bgCard }]}
            >
              <View style={[styles.handleBar, { backgroundColor: themeColors.border }]} />

              <View style={[styles.headerRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                  Comments ({comments.length})
                </Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={20} color={themeColors.iconSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={ORANGE} />
                </View>
              ) : (
                <FlatList
                  ref={flatRef}
                  data={displayItems}
                  renderItem={renderComment}
                  ListHeaderComponent={
                    comments.length > 1 || hasMore || sort === 'top' ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingBottom: 8 }}>
                        {(['newest', 'top'] as const).map((value) => (
                          <TouchableOpacity
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: sort === value }}
                            onPress={() => { setSort(value); setTopLimit(PAGE_SIZE); }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 5,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: sort === value ? ORANGE : themeColors.border,
                              backgroundColor: sort === value ? ORANGE : 'transparent',
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: sort === value ? '#FFFFFF' : themeColors.textSecondary }}>
                              {value === 'newest' ? 'Newest' : 'Top'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null
                  }
                  ListFooterComponent={
                    hasMore ? (
                      <TouchableOpacity onPress={() => setTopLimit((n) => n + PAGE_SIZE)} style={{ paddingVertical: 12, alignItems: 'center' }}>
                        <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>View more comments</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                      No comments yet. Start the conversation!
                    </Text>
                  }
                />
              )}

              {editingId && (
                <View
                  style={[
                    styles.replyBanner,
                    {
                      backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5',
                      borderTopColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF',
                    },
                  ]}
                >
                  <Icon name="edit-2" size={14} color={ORANGE} />
                  <Text style={[styles.replyBannerText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    Editing your comment
                  </Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel editing"
                    onPress={() => { setEditingId(null); setInput(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="x" size={14} color={themeColors.iconSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Reply context banner */}
              {replyTo && (
                <View
                  style={[
                    styles.replyBanner,
                    {
                      backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5',
                      borderTopColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF',
                    },
                  ]}
                >
                  <Icon name="corner-up-left" size={14} color={ORANGE} />
                  <Text style={[styles.replyBannerText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    Replying to{' '}
                    <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>
                      {replyTo.profiles?.full_name || 'Crew Member'}
                    </Text>
                    : {replyTo.content}
                  </Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                    onPress={() => setReplyTo(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="x" size={14} color={themeColors.iconSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {isInternal ? (
                <View style={[styles.inputBar, { borderTopColor: themeColors.border, backgroundColor: themeColors.bgCard, justifyContent: 'center' }]}>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center' }}>Staff accounts can read comments but not write them.</Text>
                </View>
              ) : (
              <View
                style={[
                  styles.inputBar,
                  {
                    borderTopColor: themeColors.border,
                    backgroundColor: themeColors.bgCard,
                  },
                ]}
              >
                <MentionInput
                  ref={inputRef}
                  containerStyle={{ flex: 1 }}
                  onMentionSelected={(u) => { pickedMentionsRef.current = { ...pickedMentionsRef.current, [u.id]: u }; }}
                  style={[
                    styles.input,
                    { flex: 0 },
                    {
                      backgroundColor: themeColors.inputBg,
                      color: themeColors.textPrimary,
                      borderColor: themeColors.border,
                    },
                  ]}
                  placeholder={
                    replyTo ? 'Write a reply...' : 'Add a craft comment...'
                  }
                  placeholderTextColor={themeColors.textMuted}
                  value={input}
                  onChangeText={setInput}
                  maxLength={MAX_COMMENT_LENGTH}
                  multiline
                />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[
                    styles.sendBtn,
                    (!input.trim() || sending) && {
                      backgroundColor: isDark ? '#333333' : '#E5E7EB',
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Icon name="send" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
              )}
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    <ReportModal
      visible={!!reportCommentId}
      onClose={() => setReportCommentId(null)}
      targetTitle="this comment"
      targetType="comment"
      targetId={reportCommentId}
    />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
    // on a tablet the sheet is a centred panel (it used to hug the left edge at half width)
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 14,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
    fontWeight: '600',
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  commentAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 14,
    fontWeight: '700',
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentContentOwn: {
    backgroundColor: 'rgba(255, 75, 51, 0.05)',
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  commentCraft: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  commentText: {
    color: '#1F2937',
    fontSize: 13,
    lineHeight: 18,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  replyBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
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
    color: '#64748B',
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendBtn: {
    backgroundColor: ORANGE,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
});

export default CommentsSheet;
