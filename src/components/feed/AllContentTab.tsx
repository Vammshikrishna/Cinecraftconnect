import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from './PostCard';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, DollarSign, Users, Megaphone, Film, MessageCircle } from 'lucide-react';
import { Post } from '@/types';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  location: string;
  required_roles: string[];
  budget_min: number;
  budget_max: number;
  created_at: string;
  profiles?: {
    full_name: string;
  } | null;
  itemType: 'project';
}

interface DiscussionRoom {
    id: string;
    name: string;
    description: string;
    member_count: number;
    created_at: string;
    itemType: 'discussion';
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    itemType: 'announcement';
}

interface UnifiedPost extends Post {
  itemType: 'post';
}

type FeedItem = UnifiedPost | Project | DiscussionRoom | Announcement;

interface AllContentTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string, rating: number) => void;
}

const AllContentTab = ({ postRatings, onRate }: AllContentTabProps) => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAllContent = async () => {
      try {
        const [posts, projects, discussions, announcements] = await Promise.all([
          supabase.from('posts').select('*, profiles:author_id(id, full_name, username, avatar_url, craft)').order('created_at', { ascending: false }).limit(20),
          supabase.from('project_spaces').select('*, profiles:creator_id(full_name)').order('created_at', { ascending: false }).limit(10),
          supabase.from('discussion_rooms').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('announcements').select('*').order('posted_at', { ascending: false }).limit(5)
        ]);

        if (posts.error) throw posts.error;
        if (projects.error) throw projects.error;
        if (discussions.error) throw discussions.error;
        if (announcements.error) throw announcements.error;


        const typedPosts: UnifiedPost[] = (posts.data || []).map(p => ({ ...p, itemType: 'post' })) as unknown as UnifiedPost[];
        const typedProjects: Project[] = (projects.data || []).map(p => ({ ...p, itemType: 'project' })) as Project[];
        const typedDiscussions: DiscussionRoom[] = (discussions.data || []).map(d => ({ ...d, itemType: 'discussion' })) as DiscussionRoom[];
        const typedAnnouncements: Announcement[] = (announcements.data || []).map(a => ({ ...a, created_at: a.posted_at, itemType: 'announcement' })) as Announcement[];

        const combined = [...typedPosts, ...typedProjects, ...typedDiscussions, ...typedAnnouncements];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setFeed(combined);
      } catch (error) {
        console.error('Error fetching all content:', error);
        toast({ title: "Error", description: "Failed to load the feed.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchAllContent();
  }, [toast]);

  if (loading) {
    return (
        <div className="space-y-6">
            {[...Array(5)].map((_, i) => <CardSkeleton key={i} className="h-48" />)}
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {feed.map((item) => {
        if (item.itemType === 'post') {
            const author = item.profiles;
            const authorName = author?.full_name || author?.username || 'Anonymous User';
            const authorRole = author?.craft || 'Creator';
            const getInitials = (name: string) => {
              return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
            };
          return <PostCard key={`post-${item.id}`} id={item.id} author={{ id: item.author_id, name: authorName, role: authorRole, initials: getInitials(authorName), avatar: item.profiles?.avatar_url || undefined }} timeAgo={formatDistanceToNow(new Date(item.created_at), { addSuffix: true })} content={item.content} mediaUrl={item.media_url} hasImage={item.media_type === 'image'} hasVideo={item.media_type === 'video'} like_count={item.like_count} comment_count={item.comment_count} share_count={item.share_count} rating={postRatings[item.id]} onRate={onRate} />
        } else if (item.itemType === 'project') {
            return (
                <div key={`project-${item.id}`} className="glass-card rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <Film className="h-8 w-8 text-primary mt-1" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold">Project: {item.name}</h3>
                            <p className="text-gray-300 text-sm mt-1">{item.description.substring(0, 150)}...</p>
                            <div className="space-y-3 mt-4">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <Badge>{item.status}</Badge>
                                    {item.location && <div className="flex items-center"><MapPin className="mr-1 h-3 w-3" />{item.location}</div>}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <DollarSign className="mr-1 h-3 w-3" />
                                    {item.budget_min && item.budget_max ? `$${item.budget_min} - $${item.budget_max}` : 'Budget TBD'}
                                </div>
                                {item.required_roles && item.required_roles.length > 0 &&
                                    <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center"><Users className="mr-1 h-3 w-3" />Looking for</p>
                                    <div className="flex flex-wrap gap-1">
                                        {item.required_roles.slice(0, 3).map(role => <Badge key={role} variant="outline" className="text-xs">{role}</Badge>)}
                                        {item.required_roles.length > 3 && <Badge variant="outline" className="text-xs">+{item.required_roles.length - 3}</Badge>}
                                    </div>
                                    </div>
                                }
                            </div>
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground">
                                <div className="flex items-center">
                                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mr-2 text-primary-foreground text-xxs">{item.profiles?.full_name?.charAt(0) || 'U'}</div>
                                    {item.profiles?.full_name || 'Unknown'}
                                </div>
                                <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        } else if (item.itemType === 'discussion') {
            return (
                <div key={`discussion-${item.id}`} className="glass-card rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <MessageCircle className="h-8 w-8 text-primary mt-1" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold">Discussion: {item.name}</h3>
                            <p className="text-gray-300 text-sm mt-1">{item.description.substring(0, 150)}...</p>
                            <div className="flex items-center justify-between pt-3 mt-3 text-xs text-muted-foreground">
                                <div className='flex items-center'>
                                    <Users className="mr-1 h-3 w-3" /> {item.member_count} members
                                </div>
                                <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        } else if (item.itemType === 'announcement') {
            return (
                <div key={`announcement-${item.id}`} className="glass-card rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <Megaphone className="h-8 w-8 text-primary mt-1" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold">Announcement: {item.title}</h3>
                            <p className="text-gray-300 text-sm mt-1">{item.content.substring(0, 150)}...</p>
                            <p className="text-xs text-muted-foreground mt-3">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
                        </div>
                    </div>
                </div>
            )
        }
        return null;
      })}
    </div>
  );
}

export default AllContentTab;