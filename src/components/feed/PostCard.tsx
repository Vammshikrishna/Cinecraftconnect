import { Heart, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
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
  rating,
  currentUserLiked,
  onRate,
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
    <div className="glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,135,245,0.3)]">
      <div className="flex items-center mb-4">
        <Avatar className="h-10 w-10 mr-3">
          <AvatarImage src={author.avatar || "/placeholder.svg"} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">{author.initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              {author.id ? (
                <Link to={`/profile/view?id=${author.id}`} className="hover:text-primary transition-colors">
                  <p className="font-semibold">{author.name}</p>
                </Link>
              ) : (
                <p className="font-semibold">{author.name}</p>
              )}
              <p className="text-xs text-muted-foreground">{author.role} • {timeAgo}</p>
            </div>
          </div>
        </div>
      </div>
      
      <p className="mb-4">{content}</p>
      
      {hasImage && (
        <div className="mb-4 rounded-lg overflow-hidden bg-card/50 relative">
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
            <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs px-2 py-1 rounded-full">
              AI Generated
            </div>
          )}
        </div>
      )}
      
      {hasVideo && (
        <div className="mb-4 rounded-lg overflow-hidden bg-card/50 relative">
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
            <div className="absolute top-2 right-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs px-2 py-1 rounded-full">
              AI Generated
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 mb-4">
        {tags && tags.map((tag) => (
            <span 
            key={tag} 
            className="text-xs px-2 py-1 bg-muted/20 rounded-full text-muted-foreground hover:bg-primary/20 cursor-pointer"
          >
            #{tag}
          </span>
        ))}
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center" onClick={handleLike} disabled={isLiking}>
          <Heart size={18} className={`mr-1 ${isLiked ? 'text-red-500 fill-current' : ''}`} />
          <span>{likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center" onClick={handleComment}>
          <MessageCircle size={18} className="mr-1" />
          <span>{comment_count}</span>
        </Button>
        <ShareButton postId={id} shareCount={share_count} />
      </div>
      {showComments && <CommentSection postId={id} />}
    </div>
  );
};

export default PostCard;
