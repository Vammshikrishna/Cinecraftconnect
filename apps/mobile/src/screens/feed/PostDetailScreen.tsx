import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const PostDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { postId } = route.params || {};

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
          profiles (id, full_name, username, avatar_url, craft, is_verified, account_type)
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
        setPost(null);
        return;
      }

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

      if (newState) {
        await supabase.from('post_bookmarks').insert({ post_id: id, user_id: user.id });
      } else {
        await supabase.from('post_bookmarks').delete().eq('post_id', id).eq('user_id', user.id);
      }
    } catch (e) {
      console.warn('[PostDetailScreen] Bookmark error:', e);
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
            Alert.alert('Error', e.message || 'Could not delete post');
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
      backgroundColor="#F8FAFC"
      feedMode={true}
      header={
        <Header
          title="Post"
          showLogo={false}
          onBack={() => navigation.goBack()}
        />
      }
    >

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={ORANGE} size="large" />
        </View>
      ) : !post ? (
        <View style={styles.centerBox}>
          <Icon name="alert-circle" size={48} color="#9CA3AF" />
          <Text style={styles.notFoundTitle}>Post Not Found</Text>
          <Text style={styles.notFoundSub}>This post may have been deleted or is unavailable.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
          showsVerticalScrollIndicator={false}
        >
          <PostCard
            id={post.id}
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
                : 'RECENT'
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
        </ScrollView>
      )}

      {/* Universal Share Sheet */}
      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={shareContent || 'Film Post on CineCraft'}
        itemType="post"
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
    paddingBottom: 40,
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
    fontWeight: '800',
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
