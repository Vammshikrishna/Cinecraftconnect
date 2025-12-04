import { useState, useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from './PostCard';
import FeedProjectCard from './FeedProjectCard';
import FeedDiscussionCard from './FeedDiscussionCard';
import FeedAnnouncementCard from './FeedAnnouncementCard';
import FeedRatingCard from './FeedRatingCard';

import { formatDistanceToNow } from 'date-fns';

import { Post } from '@/types';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';
import { fetchLatestRatings, TMDB_IMAGE_BASE_URL } from '@/services/tmdb';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  location: string | null;
  creator_id: string;
  created_at: string;
  itemType: 'project';
  project_space_type?: 'public' | 'private' | 'secret';
  creator?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface DiscussionRoom {
  id: string;
  title: string;
  description: string;
  member_count: number | null;
  created_at: string;
  itemType: 'discussion';
  room_type?: 'public' | 'private' | 'secret';
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  itemType: 'announcement';
}

interface Rating {
  id: string;
  title: string;
  tmdb_rating: number;
  user_rating?: number | null;
  created_at: string;
  itemType: 'rating';
  poster_url?: string | null;
  overview?: string;
  media_type?: 'movie' | 'tv';
}

interface UnifiedPost extends Post {
  itemType: 'post';
}

type FeedItem = UnifiedPost | Project | DiscussionRoom | Announcement | Rating;

interface AllContentTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string, rating: number) => void;
}

const AllContentTab = ({ postRatings, onRate }: AllContentTabProps) => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAllContent = async () => {
      try {
        const [postsRes, projectsRes, discussionsRes, announcementsRes, tmdbMovies] = await Promise.all([
          supabase
            .from('posts')
            .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('projects')
            .select('*, creator:creator_id(full_name, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('discussion_rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('announcements')
            .select('*')
            .order('posted_at', { ascending: false })
            .limit(5),
          fetchLatestRatings().catch(err => {
            console.error("Failed to fetch TMDB ratings", err);
            return [];
          })
        ]);

        if (postsRes.error) console.error('Posts fetch error:', postsRes.error);
        if (projectsRes.error) console.error('Projects fetch error:', projectsRes.error);
        if (discussionsRes.error) console.error('Discussions fetch error:', discussionsRes.error);
        if (announcementsRes.error) console.error('Announcements fetch error:', announcementsRes.error);

        // Fetch liked posts for the current user
        if (user) {
          const { data: likesData } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', user.id);

          if (likesData) {
            setLikedPostIds(new Set((likesData as any[]).map(l => l.post_id)));
          }
        }

        const typedPosts: UnifiedPost[] = (postsRes.data || []).map((p: any) => ({
          ...p,
          itemType: 'post',
          like_count: p.like_count || 0
        })) as unknown as UnifiedPost[];

        // Process projects
        const rawProjects = projectsRes.data || [];
        const typedProjects: Project[] = rawProjects.map((p: any) => ({
          ...p,
          name: p.title, // Map title to name as used in Project interface
          itemType: 'project',
          creator: p.creator || null
        })) as unknown as Project[];

        const typedDiscussions: DiscussionRoom[] = (discussionsRes.data || []).map(d => ({ ...d, itemType: 'discussion' })) as unknown as DiscussionRoom[];
        const typedAnnouncements: Announcement[] = (announcementsRes.data || []).map(a => ({
          ...a,
          created_at: a.posted_at || new Date().toISOString(),
          itemType: 'announcement'
        })) as unknown as Announcement[];

        const typedRatings: Rating[] = tmdbMovies.map(movie => ({
          id: movie.id.toString(),
          title: movie.title || movie.name || 'Untitled',
          tmdb_rating: movie.vote_average,
          user_rating: null,
          created_at: movie.release_date || movie.first_air_date || '',
          itemType: 'rating',
          poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
          overview: movie.overview,
          media_type: movie.title ? 'movie' : 'tv'
        }));

        const combined: FeedItem[] = [...typedPosts, ...typedProjects, ...typedDiscussions, ...typedAnnouncements, ...typedRatings];

        // Shuffle array for random order
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        setFeed(combined);
      } catch (error) {
        console.error('Unexpected error fetching feed:', error);
        toast({ title: 'Error', description: 'Failed to load the feed.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchAllContent();
  }, [toast, user]);

  const handleLikeToggle = (postId: string, isLiked: boolean) => {
    setLikedPostIds(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.add(postId);
      } else {
        newSet.delete(postId);
      }
      return newSet;
    });

    setFeed(prev => prev.map(item => {
      if (item.itemType === 'post' && item.id === postId) {
        return {
          ...item,
          like_count: isLiked ? item.like_count + 1 : Math.max(0, item.like_count - 1)
        };
      }
      return item;
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(5)].map((_, i) => (
          <CardSkeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <ResponsiveGrid cols={{ sm: 1, md: 1 }} gap={6}>
      {feed.map(item => {
        if (item.itemType === 'post') {
          const author = item.profiles;
          const authorName = author?.full_name || author?.username || 'Anonymous User';
          const authorRole = author?.craft || 'Creator';
          const getInitials = (name: string) =>
            name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
          return (
            <PostCard
              key={`post-${item.id}`}
              id={item.id}
              author={{ id: item.author_id, name: authorName, role: authorRole, initials: getInitials(authorName), avatar: item.profiles?.avatar_url || undefined }}
              timeAgo={formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              content={item.content}
              mediaUrl={item.media_url}
              hasImage={item.media_type === 'image'}
              hasVideo={item.media_type === 'video'}
              like_count={item.like_count}
              comment_count={item.comment_count}
              share_count={item.share_count}
              rating={postRatings[item.id]}
              onRate={onRate}
              currentUserLiked={likedPostIds.has(item.id)}
              onLikeToggle={handleLikeToggle}
            />
          );
        } else if (item.itemType === 'project') {
          return <FeedProjectCard key={`project-${item.id}`} project={item} />;
        } else if (item.itemType === 'discussion') {
          return <FeedDiscussionCard key={`discussion-${item.id}`} discussion={item} />;
        } else if (item.itemType === 'announcement') {
          return <FeedAnnouncementCard key={`announcement-${item.id}`} announcement={item} />;
        } else if (item.itemType === 'rating') {
          return <FeedRatingCard key={`rating-${item.id}`} rating={item} contentType={item.media_type || 'movie'} />;
        }
        return null;
      })}
    </ResponsiveGrid>
  );
};

export default AllContentTab;