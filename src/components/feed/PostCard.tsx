import { Heart, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import CommentSection from "./CommentSection";
import ShareButton from "../ShareButton";
import { useToast } from "@/hooks/use-toast";
import { togglePostLike } from "@/services/postService"; // Import the new service

interface PostAuthor {
  id?: string;
  name: string;
  role: string;
  initials: string;
  avatar?: string;
}

interface PostProps {
  id: string;
  author: PostAuthor;
  timeAgo: string;
  content: string;
  hasImage?: boolean;
  imageAlt?: string;
  hasVideo?: boolean;
  videoThumbnail?: string;
  isAIGenerated?: boolean;
  like_count: number;
  comment_count: number;
  share_count: number;
  tags?: string[];
  rating?: number;
  currentUserLiked?: boolean;
  onRate?: (postId: string, rating: number) => void;
  onLikeToggle?: (postId: string, isLiked: boolean) => void;
  mediaUrl?: string;
}

const PostCard = ({
  id,
  author,
  timeAgo,
  content,
  hasImage,
  imageAlt,
  hasVideo,
  videoThumbnail,
  isAIGenerated,
  like_count,
  comment_count,
  share_count,
  tags,
  // rating, // Unused
  currentUserLiked,
  // onRate, // Unused
  onLikeToggle,
  mediaUrl
}: PostProps) => {

  const [isLiked, setIsLiked] = useState(currentUserLiked || false);
  const [likeCount, setLikeCount] = useState(like_count);
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const { toast } = useToast();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLiking) {
      setIsLiked(currentUserLiked || false);
      setLikeCount(like_count);
    }
  }, [currentUserLiked, like_count, isLiking]);

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    const originalLiked = isLiked;
    const originalLikeCount = likeCount;

    // Optimistic UI update
    setIsLiked(!originalLiked);
    setLikeCount(originalLiked ? originalLikeCount - 1 : originalLikeCount + 1);
    onLikeToggle?.(id, !originalLiked);

    try {
      // Use the imported service function
      await togglePostLike(id, originalLiked);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      if (isMountedRef.current) {
        // Rollback on error
        setIsLiked(originalLiked);
        setLikeCount(originalLikeCount);
        toast({
          title: "Error",
          description: "Could not update like status. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLiking(false);
      }
    }
  };

  const handleComment = () => {
    setShowComments(!showComments);
  };

  return (


    <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] group">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative p-6">
        <div className="flex items-center mb-4">
          <Link to={`/profile/${author.id}`} className="hover:opacity-80 transition-opacity relative z-10">
            <Avatar className="h-10 w-10 mr-3 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300">
              <AvatarImage src={author.avatar || "/placeholder.svg"} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">{author.initials}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="truncate">
                {author.id ? (
                  <Link to={`/profile/${author.id}`} className="hover:text-primary transition-colors relative z-10 block truncate">
                    <p className="font-semibold truncate">{author.name}</p>
                  </Link>
                ) : (
                  <p className="font-semibold truncate">{author.name}</p>
                )}
                <p className="text-xs text-muted-foreground truncate">{author.role} • {timeAgo}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mb-4 break-words whitespace-pre-wrap text-foreground/90 leading-relaxed">{content}</p>

        {hasImage && (
          <div className="mb-4 rounded-lg overflow-hidden bg-black/20 relative ring-1 ring-white/10 group-hover:ring-primary/20 transition-all duration-300">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={imageAlt || "Post image"}
                className="w-full h-auto object-contain max-h-[600px]"
              />
            ) : (
              <div className="h-64 flex items-center justify-center backdrop-blur-sm">
                <p className="text-gray-400">{imageAlt || "Image"}</p>
              </div>
            )}
            {isAIGenerated && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs px-2 py-1 rounded-full">
                AI Generated
              </div>
            )}
          </div>
        )}

        {hasVideo && (
          <div className="mb-4 rounded-lg overflow-hidden bg-black/20 relative ring-1 ring-white/10 group-hover:ring-primary/20 transition-all duration-300">
            {mediaUrl ? (
              <video
                src={mediaUrl}
                controls
                className="w-full h-auto object-contain max-h-[600px]"
                preload="metadata"
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <div className="h-80 flex items-center justify-center backdrop-blur-sm relative">
                <p className="text-gray-400">{videoThumbnail}</p>
                <Button variant="default" size="icon" className="absolute bg-primary/80 hover:bg-primary">
                  <Play size={24} />
                </Button>
              </div>
            )}
            {isAIGenerated && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs px-2 py-1 rounded-full">
                AI Generated
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4 relative z-10">
          {tags && tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 bg-primary/5 border border-primary/10 rounded-full text-primary/80 hover:bg-primary/10 hover:border-primary/30 cursor-pointer transition-all duration-300"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            className={`text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center gap-1.5 transition-all duration-300 ${isLiked ? 'text-red-500' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart size={18} className={`transition-transform duration-300 ${isLiked ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
            <span>{likeCount}</span>
          </Button>

          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-all duration-300" onClick={handleComment}>
            <MessageCircle size={18} className="group-hover:scale-110 transition-transform duration-300" />
            <span>{comment_count}</span>
          </Button>

          <ShareButton postId={id} shareCount={share_count} />
        </div>
      </div>
      {showComments && <CommentSection postId={id} />}
    </div>
  );
};

export default PostCard;
