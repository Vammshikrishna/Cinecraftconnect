import { CachedImage } from '../common/CachedImage';
import { ReportModal } from '../modals/ReportModal';
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { VerificationBadge } from '../common/VerificationBadge';
import { FormattedText } from '../common/FormattedText';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

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
  const [comments, setComments] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
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
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (data) setComments(data);
    } catch (e) {
      console.warn('[CommentsSheet] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!visible || !postId) return;

    fetchComments();

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
        async (payload) => {
          // Fetch author profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, craft, is_verified')
            .eq('id', payload.new.user_id)
            .single();

          const enriched = { ...(payload.new as any), profiles: profile };

          setComments((prev) => {
            const exists = prev.find((c) => c.id === (enriched as any).id);
            if (exists) return prev;
            return [...prev, enriched];
          });

          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
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
  }, [visible, postId, fetchComments]);

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
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post comment.');
      setInput(draft); // restore
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (commentId: string, userId: string) => {
    if (userId !== currentUserId) {
      Alert.alert('Permission denied', 'You can only delete your own comments.');
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
            await supabase
              .from('post_comments' as any)
              .delete()
              .eq('id', commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete comment.');
          }
        },
      },
    ]);
  };

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
      <View style={styles.commentItem}>
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
                <TouchableOpacity
                  onPress={() => setReportCommentId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="flag" size={12} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
              {isOwn && (
                <TouchableOpacity
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
          </Text>

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

          {/* Reply Button */}
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => handleReplyPress(item)}
          >
            <Icon name="corner-up-left" size={11} color={themeColors.textSecondary} />
            <Text style={[styles.replyBtnText, { color: themeColors.textSecondary }]}>Reply</Text>
          </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={ORANGE} />
                </View>
              ) : (
                <FlatList
                  ref={flatRef}
                  data={comments}
                  renderItem={renderComment}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                      No comments yet. Start the conversation!
                    </Text>
                  }
                  onContentSizeChange={() =>
                    flatRef.current?.scrollToEnd({ animated: false })
                  }
                />
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
                    <Text style={{ fontWeight: '800', color: themeColors.textPrimary }}>
                      {replyTo.profiles?.full_name || 'Crew Member'}
                    </Text>
                    : {replyTo.content}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setReplyTo(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="x" size={14} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={[
                  styles.inputBar,
                  {
                    borderTopColor: themeColors.border,
                    backgroundColor: themeColors.bgCard,
                  },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
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
                  multiline
                />
                <TouchableOpacity
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  commentCraft: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '800',
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
    color: '#6B7280',
    fontSize: 10.5,
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
    color: '#6B7280',
    fontSize: 11,
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
