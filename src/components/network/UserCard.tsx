import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MessageCircle, UserPlus, UserCheck, Clock, Users, Briefcase, Sparkles, MapPin, Globe, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import VerificationBadge from '../common/VerificationBadge';
import { getOptimizedImage } from '@/utils/image-optimization';

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
  onConnect: (userId: string) => void;
  onAccept: (userId: string) => void;
  onCancelRequest?: (userId: string) => void;
  onRemoveConnection?: (userId: string) => void;
  onDismiss?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onConnect, onAccept, onCancelRequest, onRemoveConnection, onDismiss }) => {
  const { user: currentUser } = useAuth();
  const status = user.connection_status || 'none';

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderActionButton = () => {
    if (user.id === currentUser?.id) return null;

    switch (status) {
      case 'connected':
        return (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all text-[10px] sm:text-xs font-semibold px-2" 
            onClick={() => onRemoveConnection && onRemoveConnection(user.id)}
          >
            <UserCheck size={12} className="mr-1 sm:mr-1.5" /> Disconnect
          </Button>
        );
      case 'pending_sent':
        return (
          <Button 
            size="sm" 
            variant="secondary" 
            className="w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-[10px] sm:text-xs font-semibold px-2" 
            onClick={() => onCancelRequest && onCancelRequest(user.id)}
          >
            <Clock size={12} className="mr-1 sm:mr-1.5" /> Withdraw
          </Button>
        );
      case 'pending_received':
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-[10px] sm:text-[11px] font-bold px-2" 
            onClick={() => onAccept(user.id)}
          >
            <UserCheck size={12} className="mr-1 sm:mr-1.5" /> Accept
          </Button>
        );
      default:
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-[10px] sm:text-[11px] font-bold px-2" 
            onClick={() => onConnect(user.id)}
          >
            <UserPlus size={12} className="mr-1 sm:mr-1.5" /> Connect
          </Button>
        );
    }
  };

  return (
    <div className="group relative glass-card-premium flex flex-col items-center text-center p-6 transition-all duration-500 hover:-translate-y-2">
      {onDismiss && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(user.id);
          }}
          className="absolute top-3 right-3 z-30 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10 hover:border-white/20"
          title="Remove suggestion"
        >
          <X size={14} strokeWidth={3} />
        </button>
      )}
      
      <div className="w-full flex flex-col items-center">
        {/* Avatar Section */}
        <div className="mb-4 relative">
          <Link to={`/profile/${user.id}`} className="block relative group/avatar">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="h-28 w-28 min-[460px]:h-20 min-[460px]:w-20 sm:h-28 sm:w-28 border border-border shadow-2xl scale-100 group-hover/avatar:scale-105 transition-transform duration-500 ring-4 ring-background">
              <AvatarImage src={getOptimizedImage(user.avatar_url, { width: 300, height: 300 }) || undefined} alt={user.full_name || 'User'} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl min-[460px]:text-xl sm:text-2xl font-black">
                {getInitials(user.full_name || user.username)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Name and Info */}
        <div className="space-y-1 mb-4 w-full">
          <Link to={`/profile/${user.id}`} className="block">
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-none pt-1 flex items-center justify-center gap-1.5">
              {user.full_name || user.username}
              {user.is_verified && <VerificationBadge size="sm" />}
            </h3>
          </Link>
          
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-tighter">
              <Briefcase size={10} className="mr-1" /> {user.craft || 'Filmmaker'}
            </Badge>
          </div>

          {user.bio && (
            <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-3 px-2 leading-relaxed h-8 overflow-hidden italic italic-serif">
               "{user.bio}"
            </p>
          )}

          {user.suggestion_reason && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {user.suggestion_reason === 'Mutual connection' && <Users size={10} className="text-primary/60" />}
              {user.suggestion_reason === 'Based on your craft' && <Briefcase size={10} className="text-primary/60" />}
              {user.suggestion_reason === 'Based on location' && <MapPin size={10} className="text-primary/60" />}
              {user.suggestion_reason === 'Based on network' && <Globe size={10} className="text-primary/60" />}
              {(user.suggestion_reason === 'Suggested for you' || user.suggestion_reason === 'Connected' || user.suggestion_reason === 'Pending connection') && <Sparkles size={10} className="text-primary/60" />}
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {user.suggestion_reason}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 w-full gap-2 mt-2">
          {renderActionButton()}
          
          {status === 'connected' && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition-all text-[10px] sm:text-xs font-semibold px-2"
              asChild
            >
              <Link to={`/messages/${user.id}`}>
                <MessageCircle size={12} className="mr-1 sm:mr-1.5" /> Message
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
