
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PostCard from "./PostCard";
import CraftFilters from "./CraftFilters";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { PlusCircle, Image, Video } from "lucide-react";

interface Post {
  id: string;
  author_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  has_ai_generated: boolean;
  tags?: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
}

interface FeedTabProps {
  postRatings: { [postId: string]: number };
  onRate: (postId: string | number, rating: number) => void;
}

const FeedTab = ({ postRatings, onRate }: FeedTabProps) => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const { toast } = useToast();

  // Fetch posts from database
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new post
  const createPost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create posts",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('posts')
        .insert([
          {
            author_id: user.id,
            content: newPostContent,
            tags: [], // Can be enhanced later with tag extraction
          }
        ]);

      if (error) throw error;

      setNewPostContent("");
      setShowCreatePost(false);
      fetchPosts(); // Refresh posts
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        () => {
          fetchPosts(); // Refresh posts on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <CraftFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      
      {/* Create Post Card */}
      <Card className="glass-card p-6">
        {!showCreatePost ? (
          <Button
            onClick={() => setShowCreatePost(true)}
            className="w-full justify-start text-left bg-transparent hover:bg-white/5 border-dashed border-2 border-white/20 h-12"
            variant="outline"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Share your latest project or idea...
          </Button>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder="What's happening in your creative world?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="min-h-[100px] bg-black/20 border-white/10 text-white placeholder:text-gray-400"
            />
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="border-white/20">
                  <Image className="w-4 h-4 mr-1" />
                  Image
                </Button>
                <Button variant="outline" size="sm" className="border-white/20">
                  <Video className="w-4 h-4 mr-1" />
                  Video
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePost(false);
                    setNewPostContent("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createPost}
                  disabled={!newPostContent.trim()}
                  className="bg-gradient-to-r from-primary to-primary/80"
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
      
      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <p className="text-gray-400 mb-4">No posts yet. Be the first to share something!</p>
            <Button onClick={() => setShowCreatePost(true)} className="bg-gradient-to-r from-primary to-primary/80">
              Create First Post
            </Button>
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              author={{
                name: "Creator",
                role: "Filmmaker",
                initials: "CF"
              }}
              timeAgo={new Date(post.created_at).toLocaleDateString()}
              content={post.content}
              hasImage={post.media_type === 'image'}
              imageAlt={post.media_type === 'image' ? 'Post image' : undefined}
              hasVideo={post.media_type === 'video'}
              videoThumbnail={post.media_type === 'video' ? 'Post video' : undefined}
              isAIGenerated={post.has_ai_generated}
              likes={post.like_count}
              comments={post.comment_count}
              tags={post.tags || []}
              rating={postRatings[post.id]}
              onRate={onRate}
            />
          ))
        )}
      </div>
    </>
  );
};

export default FeedTab;
