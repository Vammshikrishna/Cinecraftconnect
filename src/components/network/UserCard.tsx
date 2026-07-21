import React from 'react';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  MessageCircle, 
  UserPlus, 
  UserCheck, 
  Clock, 
  Users, 
  Briefcase, 
  Sparkles, 
  MapPin, 
  Globe, 
  X, 
  MoreHorizontal, 
  UserX, 
  ExternalLink 
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuth } from '../../contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import { useFollows } from '@/hooks/useFollows';
import VerificationBadge from '../common/VerificationBadge';
import { getOptimizedImage } from '@/utils/image-optimization';

import { useCachedImage } from '@/hooks/useCachedImage';

interface UserCardProps {
  user: {
    id: string;
    avatar_url: string | null;
    full_name: string | null;
    username: string | null;
    craft: string | null;
    location?: string | null;
    bio?: string | null;
    cover_image_url?: string | null;
    connection_status?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
    is_verified?: boolean;
    suggestion_reason?: string;
  };
  onConnect?: (userId: string) => void;
  onAccept?: (userId: string) => void;
  onReject?: (userId: string) => void;
  onCancelRequest?: (userId: string) => void;
  onRemoveConnection?: (userId: string) => void;
  onDismiss?: (userId: string) => void;
  isFanFollowMode?: boolean;
  isFollowing?: boolean;
  onFollow?: (userId: string) => void;
  onUnfollow?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onConnect, onAccept, onReject, onCancelRequest, onRemoveConnection, onDismiss, isFanFollowMode, isFollowing, onFollow, onUnfollow }) => {
  const { push } = useAppNavigation();
  const { user: currentUser } = useAuth();
  const status = user.connection_status || 'none';
  const avatarUrl = getOptimizedImage(user.avatar_url, { width: 200, height: 200 }) || undefined;
  const cachedAvatar = useCachedImage(avatarUrl);

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const { isInternal } = useAppRole();
  const { followers } = useFollows();
  const isMutualFollow = isFollowing && followers?.some((f: any) => f.follower_id === user.id);

  const renderActionButton = () => {
    if (user.id === currentUser?.id || isInternal) return null;

    if (isFanFollowMode) {
      if (isFollowing) {
        return (
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <Button 
              size="sm" 
              variant="secondary" 
              className={isMutualFollow ? "w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" : "w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8 col-span-2"} 
              onClick={() => onUnfollow && onUnfollow(user.id)}
            >
              <UserCheck size={11} className="mr-1" /> Following
            </Button>
            {isMutualFollow && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8"
                onClick={() => push(`/messages/${user.id}`)}
              >
                <MessageCircle size={11} className="mr-1 sm:mr-1.5" /> Message
              </Button>
            )}
          </div>
        );
      }
      return (
        <Button 
          size="sm" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" 
          onClick={() => onFollow && onFollow(user.id)}
        >
          <UserPlus size={11} className="mr-1" /> Follow
        </Button>
      );
    }

    switch (status) {
      case 'pending_sent':
        return (
          <Button 
            size="sm" 
            variant="secondary" 
            className="w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" 
            onClick={() => onCancelRequest && onCancelRequest(user.id)}
          >
            <Clock size={11} className="mr-1" /> Withdraw
          </Button>
        );
      case 'pending_received':
        return (
          <div className="grid grid-cols-2 gap-1.5 w-full">
            <Button 
              size="sm" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" 
              onClick={() => onAccept && onAccept(user.id)}
            >
              <UserCheck size={11} className="mr-1" /> Accept
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="w-full border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" 
              onClick={() => onReject && onReject(user.id)}
            >
              <X size={11} className="mr-1" /> Reject
            </Button>
          </div>
        );
      default:
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8" 
            onClick={() => onConnect && onConnect(user.id)}
          >
            <UserPlus size={11} className="mr-1" /> Connect
          </Button>
        );
    }
  };

  return (
    <div className="group relative glass-card-premium flex flex-col items-center text-center p-6 sm:p-7 transition-all duration-500 hover:-translate-y-2 w-full mx-auto min-h-[300px] justify-between">
      {onDismiss && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(user.id);
          }}
          className="absolute top-3 right-3 z-30 h-7 w-7 rounded-full bg-black/20 hover:bg-black/60 flex items-center justify-center text-white/40 hover:text-white transition-all opacity-100 backdrop-blur-sm border border-white/5 hover:border-white/20 shadow-sm"
          title="Remove suggestion"
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}
      
      <div className="w-full flex flex-col items-center">
        {/* Avatar Section */}
        <div className="mb-2 relative">
          <div onClick={() => push(`/profile/${user.id}`)} className="block relative group/avatar cursor-pointer">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="h-24 w-24 sm:h-24 sm:w-24 border-2 border-border shadow-xl scale-100 group-hover/avatar:scale-105 transition-transform duration-500 ring-4 ring-background/50">
              <AvatarImage src={cachedAvatar} alt={user.full_name || 'User'} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                {getInitials(user.full_name || user.username)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
 
        {/* Name and Info */}
        <div className="space-y-0.5 mb-2 w-full">
          <div onClick={() => push(`/profile/${user.id}`)} className="block cursor-pointer">
            <h3 className="font-serif font-bold text-[11px] md:text-[12px] text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight pt-1 flex items-center justify-center gap-1 uppercase text-center flex-wrap">
              {user.full_name || user.username}
              {user.is_verified && <VerificationBadge size="xs" />}
            </h3>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
            <div className="font-mono text-[6.5px] md:text-[7px] font-bold uppercase tracking-widest text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded text-center">
              CRAFT // {user.craft || 'FILMMAKER'}
            </div>
          </div>
 
          {user.bio && (
            <p className="text-[9px] text-muted-foreground/80 line-clamp-2 mt-1.5 px-2 leading-tight h-6 overflow-hidden italic italic-serif">
               "{user.bio}"
            </p>
          )}
        </div>
      </div>

      <div className="w-full mt-auto pt-4 space-y-3">
        {user.suggestion_reason && (
          <div className="flex items-center justify-center gap-1">
            {user.suggestion_reason === 'Mutual connection' && <Users size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on your craft' && <Briefcase size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on location' && <MapPin size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on network' && <Globe size={9} className="text-primary/60" />}
            {(user.suggestion_reason === 'Suggested for you' || user.suggestion_reason === 'Connected' || user.suggestion_reason === 'Pending connection') && <Sparkles size={9} className="text-primary/60" />}
            <span className="font-mono text-[6px] md:text-[6.5px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/10 border border-border/40 px-2 py-0.5 rounded text-center truncate max-w-[140px]">
              REASON // {user.suggestion_reason}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex w-full gap-1.5">
          {status === 'connected' && !isInternal ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition-all text-[9px] sm:text-[10px] font-bold px-2 h-8"
                onClick={() => push(`/messages/${user.id}`)}
              >
                <MessageCircle size={11} className="mr-1 sm:mr-1.5" /> Message
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="px-2 text-muted-foreground hover:bg-muted/50 h-8 border border-border/40">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass-card border-border/50">
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs font-bold"
                    onClick={() => onRemoveConnection && onRemoveConnection(user.id)}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Remove Connection
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-xs font-bold cursor-pointer" 
                    onClick={() => push(`/profile/${user.id}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="w-full">
              {renderActionButton()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
