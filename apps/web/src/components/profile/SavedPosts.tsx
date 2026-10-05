import { usePostBookmarks } from "@/hooks/usePostBookmarks";
import PostCard from "@/components/feed/PostCard";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Loader2 } from "lucide-react";
import { useState } from "react";

export function SavedPosts() {
  const { bookmarkedPosts } = usePostBookmarks();
  const [postRatings, setPostRatings] = useState<{ [key: string]: number }>({});

  const handleRate = (postId: string, rating: number) => {
    setPostRatings((prev) => ({ ...prev, [postId]: rating }));
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (bookmarkedPosts.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bookmarkedPosts.data || bookmarkedPosts.data.length === 0) {
    return (
      <div className="text-center py-16 bg-card/50 border border-border/50 rounded-xl mt-4">
        <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="font-semibold text-lg mb-1">No saved posts</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Posts you bookmark will appear here for quick access later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {bookmarkedPosts.data.map((post: any) => {
        const author = post.author;
        return (
          <PostCard
            key={post.id}
            id={post.id}
            author={{
              id: author?.id,
              name: author?.full_name || "Unknown",
              role: author?.craft || "Professional",
              initials: getInitials(author?.full_name),
              avatar: author?.avatar_url || undefined,
            }}
            timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            createdAt={post.created_at}
            content={post.content}
            mediaUrl={post.media_urls?.[0] || post.media_url}
            mediaItems={post.media_urls?.map((url: string) => ({ url, type: post.media_type || 'image' })) || post.media_items}
            hasImage={post.media_type === 'image' || (post.media_urls && post.media_urls.length > 0)}
            hasVideo={post.media_type === 'video'}
            like_count={post.like_count || 0}
            comment_count={post.comment_count || 0}
            share_count={post.share_count || 0}
            rating={postRatings[post.id]}
            onRate={handleRate}
          />
        );
      })}
    </div>
  );
}
