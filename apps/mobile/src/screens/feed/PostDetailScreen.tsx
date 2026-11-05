import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Text,
  RefreshControl,
  Alert,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { PostCard } from '../../components/feed/PostCard';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { friendlyError } from '@cinecraft/core';
import { useUserSettings } from '../../hooks/useUserSettings';
import { showToast } from '../../contexts/ToastContext';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const PostDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { postId } = route.params || {};
  const { themeColors } = useUserSettings();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAccountType, setCurrentUserAccountType] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Universal Share Sheet state
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [shareContent, setShareContent] = useState('');

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      // getSession reads the local session; getUser() was a network round trip before anything could load.
      const { data: sessData } = await supabase.auth.getSession();
      const user = sessData?.session?.user || null;

      // The post, the viewer's account type and the like/bookmark state are independent: fetch together.
      const [postRes, profRes, likeRes, bmRes]: any[] = await Promise.all([
        supabase
          .from('posts')
          .select(`
          *,
          profiles:author_id (id, full_name, username, avatar_url, craft, is_verified, account_type)
        `)
          .eq('id', postId)
          .single(),
        user ? supabase.from('profiles').select('account_type').eq('id', user.id).single() : Promise.resolve(null),
        user ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve(null),
        user ? supabase.from('post_bookmarks').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve(null),
      ]);

      if (user) {
        setCurrentUserId(user.id);
        if (profRes?.data) setCurrentUserAccountType(profRes.data.account_type);
      }

      const postData = postRes?.data;
      if (postRes?.error || !postData) {
        console.warn('[PostDetailScreen] Post not found:', postRes?.error);
        // an error from the server or network is a failed load; no error and no row is a post that is really gone
        setLoadError(!!postRes?.error);
        setPost(null);
        return;
      }
      setLoadError(false);

      setPost(postData);
      setLoading(false);

      if (user) {
        setIsLiked(!!likeRes?.data);
        setIsBookmarked(!!bmRes?.data);

        // Connection & follow status with the author
        if (postData.author_id && postData.author_id !== user.id) {
          const [connRes, followRes]: any[] = await Promise.all([
            supabase
              .from('user_connections')
              .select('status')
              .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
              .or(`follower_id.eq.${postData.author_id},following_id.eq.${postData.author_id}`)
              .eq('status', 'accepted')
              .maybeSingle(),
            supabase
              .from('user_follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('following_id', postData.author_id)
              .maybeSingle(),
          ]);
          setIsConnected(!!connRes?.data);
          setIsFollowing(!!followRes?.data);
        }
      }
    } catch (e) {
      console.warn('[PostDetailScreen] Error fetching post:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
    const task = { cancel: () => {} };
    return () => task.cancel();
  }, [fetchPost]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPost();
    setRefreshing(false);
  };

  const handleToggleLike = async (id: string, newState: boolean) => {
    setIsLiked(newState);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (newState) {
        await supabase.from('post_likes').insert({ post_id: id, user_id: user.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id);
      }
    } catch (e) {
      console.warn('[PostDetailScreen] Like error:', e);
    }
  };

  const handleToggleBookmark = async (id: string, newState: boolean) => {
    setIsBookmarked(newState);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const res: any = newState
        ? await supabase.from('post_bookmarks').upsert({ post_id: id, user_id: user.id })
        : await supabase.from('post_bookmarks').delete().eq('post_id', id).eq('user_id', user.id);
      if (res?.error) throw res.error;
    } catch (e) {
      console.warn('[PostDetailScreen] Bookmark error:', e);
      setIsBookmarked(!newState);
      showToast({ title: newState ? 'Could not save the post' : 'Could not remove the bookmark', message: 'Check your connection and try again.', type: 'error' });
    }
  };

  const handleDeletePost = (id: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to permanently delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            await supabase.from('posts').delete().eq('id', id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', friendlyError(e, 'Could not delete post'));
          }
        },
      },
    ]);
  };

  const authorProfile = post?.profiles || {};
  const authorName = authorProfile.full_name || authorProfile.username || 'Creator';
  const authorCraft = authorProfile.craft || 'Film Professional';
  const authorAccountType = authorProfile.account_type || 'fan';
  const firstMedia: any = (post?.media_items && post.media_items[0]) || {};
  const isCommentsDisabled = !!(post as any)?.comments_disabled || !!firstMedia?.comments_disabled;
  const isHideLikes = !!(post as any)?.hide_likes || !!firstMedia?.hide_likes;
  const postLocation = (post as any)?.location || firstMedia?.location || null;

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          title="Post"
          showLogo={false}
          onBack={() => navigation.goBack()}
        />
      }
    >

      {loading ? (
        <ScreenSkeleton variant="detail" />
      ) : !post ? (
        <View style={styles.centerBox}>
          <Icon name="alert-circle" size={48} color={themeColors.iconMuted} />
          <Text style={[styles.notFoundTitle, { color: themeColors.textPrimary }]}>{loadError ? 'Could not load this post' : 'Post Not Found'}</Text>
          <Text style={[styles.notFoundSub, { color: themeColors.textSecondary }]}>{loadError ? 'Check your connection and try again.' : 'This post may have been deleted or is unavailable.'}</Text>
          {loadError && (
            <TouchableOpacity
              onPress={() => { setLoading(true); fetchPost(); }}
              accessibilityRole="button"
              style={{ marginTop: 14, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: ORANGE, justifyContent: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailColumn}>
          <PostCard
            id={post.id}
            hasPoll={!!(post as any).has_poll}
            scheduledAt={(post as any).scheduled_at}
            hasCollabs={!!(post as any).has_collabs}
            linkPreview={(post as any).link_preview}
            audience={(post as any).audience}
            editedAt={(post as any).edited_at}
            author={{
              id: post.author_id,
              name: authorName,
              craft: authorCraft,
              avatar: authorProfile.avatar_url,
              isVerified: !!authorProfile.is_verified,
              account_type: authorAccountType,
              username: authorProfile.username,
            }}
            timeAgo={
              post.created_at
                ? new Date(post.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Recently'
            }
            content={post.content || ''}
            mediaUrl={post.media_url}
            mediaItems={post.media_items}
            mediaUrls={post.media_urls || (post as any).images}
            images={(post as any).images}
            likeCount={post.like_count || 0}
            commentCount={post.comment_count || 0}
            shareCount={post.share_count || 0}
            tags={post.tags || []}
            taggedUsers={post.tagged_users}
            hideLikes={isHideLikes}
            commentsDisabled={isCommentsDisabled}
            location={postLocation}
            isLiked={isLiked}
            isBookmarked={isBookmarked}
            isPinned={!!post.is_pinned}
            isFollowingAuthor={isFollowing}
            isConnectedAuthor={isConnected}
            currentUserId={currentUserId}
            currentUserAccountType={currentUserAccountType}
            navigation={navigation}
            initialShowComments={!isCommentsDisabled}
            isDetailView={true}
            onLikeToggle={handleToggleLike}
            onBookmarkToggle={handleToggleBookmark}
            onSharePress={(_id, text) => {
              setShareContent(text || 'Film update on CineCraft');
              setShareSheetVisible(true);
            }}
            onAuthorPress={(authorId, name) => {
              navigation.navigate('PublicProfile', {
                creatorId: authorId,
                creatorName: name || authorName,
                craft: authorCraft,
              });
            }}
            onHashtagPress={(tag) => {
              navigation.navigate('Search', { query: `#${tag}` });
            }}
            onMentionPress={(username) => {
              navigation.navigate('Search', { query: `@${username}` });
            }}
            onDeletePost={handleDeletePost}
          />
          </View>
        </ScrollView>
      )}

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={shareContent || 'Film Post on CineCraft'}
        itemType="post"
        itemData={{ postId, previewUrl: post?.media_url, caption: post?.content, profiles: post?.profiles }}
        shareUrl={`https://cinecraftconnect.com/post/${postId}`}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 40,
  },
  detailColumn: {
    width: '100%',
    maxWidth: 860,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    marginTop: 8,
  },
  notFoundSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
  },
});

export default PostDetailScreen;
