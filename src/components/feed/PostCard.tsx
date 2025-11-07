import { Heart, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
import { Link } from "react-router-dom";
import { useState } from "react";
import CommentSection from "./CommentSection";
import ShareButton from "../ShareButton";

interface PostAuthor {
  id?: string;
  name: string;
  role: string;
  initials: string;
  avatar?: string;
}

interface PostProps {
  id: string | number;
  author: PostAuthor;
  timeAgo: string;
  content: string;
  hasImage?: boolean;
  imageAlt?: string;
  hasVideo?: boolean;
  videoThumbnail?: string;
  isAIGenerated?: boolean;
  likes: number;
  comments: number;
  shares: number;
  tags?: string[];
  rating?: number;
  onRate?: (postId: string | number, rating: number) => void;
  onShare?: (postId: string | number) => void;
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
  likes, 
  comments, 
  shares,
  tags,
  rating,
  onRate,
  onShare,
  mediaUrl
}: PostProps) => {

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const [showComments, setShowComments] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
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
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center" onClick={handleLike}>
          <Heart size={18} className={`mr-1 ${isLiked ? 'text-red-500 fill-current' : ''}`} />
          <span>{likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center" onClick={handleComment}>
          <MessageCircle size={18} className="mr-1" />
          <span>{comments}</span>
        </Button>
        <ShareButton postId={id} />
      </div>
      {showComments && <CommentSection postId={id} commentCount={comments} />}
    </div>
  );
};

export default PostCard;
