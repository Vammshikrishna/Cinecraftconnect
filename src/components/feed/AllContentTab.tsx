import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from './PostCard';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Users, Megaphone, Film, MessageCircle, Star, Lock } from 'lucide-react';
import { Post } from '@/types';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';

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
  rating: number;
  created_at: string;
  itemType: 'rating';
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
        const [postsRes, projectsRes, discussionsRes, announcementsRes] = await Promise.all([
          supabase
            .from('posts')
            .select('*, profiles:author_id(id, full_name, username, avatar_url, craft)')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('project_spaces')
            .select('*')
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

        const typedProjects: Project[] = (projectsRes.data || []).map(p => ({ ...p, itemType: 'project' })) as unknown as Project[];
        const typedDiscussions: DiscussionRoom[] = (discussionsRes.data || []).map(d => ({ ...d, itemType: 'discussion' })) as unknown as DiscussionRoom[];
        const typedAnnouncements: Announcement[] = (announcementsRes.data || []).map(a => ({
          ...a,
          created_at: a.posted_at || new Date().toISOString(),
          itemType: 'announcement'
        })) as unknown as Announcement[];

        const mockRatings: Rating[] = [
          { id: 'r1', title: 'The Last Journey', rating: 4.8, created_at: new Date().toISOString(), itemType: 'rating' },
          { id: 'r2', title: 'Silent Echo', rating: 4.5, created_at: new Date().toISOString(), itemType: 'rating' },
        ];

        const combined: FeedItem[] = [...typedPosts, ...typedProjects, ...typedDiscussions, ...typedAnnouncements, ...mockRatings];

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
    <div className="space-y-6">
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
          return (
            <Link to={`/projects/${item.id}/space`} key={`project-${item.id}`} className="block">
              <div className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,135,245,0.3)]">
                <div className="flex items-start gap-4">
                  <Film className="h-8 w-8 text-primary mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Project: {item.name}</h3>
                    <p className="text-gray-300 text-sm mt-1">{item.description?.substring(0, 150) || 'No description'}...</p>
                    <div className="space-y-3 mt-4">
                      {item.status && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge>{item.status}</Badge>
                          {item.project_space_type === 'private' && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Private
                            </Badge>
                          )}
                          {item.location && (
                            <div className="flex items-center">
                              <MapPin className="mr-1 h-3 w-3" />
                              {item.location}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground gap-y-2">
                        <div className="flex items-center whitespace-nowrap">
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2 text-primary-foreground text-xxs">
                            P
                          </div>
                          Project Creator
                        </div>
                        <span className="whitespace-nowrap ml-auto">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        } else if (item.itemType === 'discussion') {
          return (
            <Link to={`/discussion-rooms/${item.id}`} key={`discussion-${item.id}`} className="block">
              <div className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,135,245,0.3)]">
                <div className="flex items-start gap-4">
                  <MessageCircle className="h-8 w-8 text-primary mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Discussion: {item.title}</h3>
                    <p className="text-gray-300 text-sm mt-1">{item.description?.substring(0, 150)}...</p>
                    <div className="flex flex-wrap items-center justify-between pt-3 mt-3 text-xs text-muted-foreground gap-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center whitespace-nowrap">
                          <Users className="mr-1 h-3 w-3" /> {item.member_count || 0} members
                        </div>
                        {item.room_type === 'private' && (
                          <Badge variant="secondary" className="flex items-center gap-1 whitespace-nowrap">
                            <Lock className="h-3 w-3" />
                            Private
                          </Badge>
                        )}
                      </div>
                      <span className="whitespace-nowrap ml-auto">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        } else if (item.itemType === 'announcement') {
          return (
            <div key={`announcement-${item.id}`} className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <Megaphone className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Announcement: {item.title}</h3>
                  <p className="text-gray-300 text-sm mt-1">{item.content.substring(0, 150)}...</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          );
        } else if (item.itemType === 'rating') {
          return (
            <div key={`rating-${item.id}`} className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <Star className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Rating: {item.title}</h3>
                  <p className="text-gray-300 text-sm mt-1">Score: {item.rating}/5</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

export default AllContentTab;