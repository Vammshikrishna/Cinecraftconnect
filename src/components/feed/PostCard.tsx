import { Heart, MessageCircle, Share2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
import { Link } from "react-router-dom";

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
  tags?: string[];
  rating?: number;
  onRate?: (postId: string | number, rating: number) => void;
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
  tags,
  rating,
  onRate,
  mediaUrl
}: PostProps) => {
  
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
        <div className="mb-4 rounded-lg overflow-hidden bg-card/50 h-64 flex items-center justify-center relative">
          {mediaUrl ? (
            <img 
              src={mediaUrl} 
              alt={imageAlt || "Post image"} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
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
              className="w-full max-h-80 object-cover"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <div className="h-80 flex items-center justify-center backdrop-blur-sm">
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
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center">
          <Heart size={18} className="mr-1" />
          <span>{likes}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center">
          <MessageCircle size={18} className="mr-1" />
          <span>{comments}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/10">
          <Share2 size={18} />
        </Button>
      </div>
    </div>
  );
};

export default PostCard;
