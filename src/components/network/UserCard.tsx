import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MessageCircle, UserPlus, UserCheck, Clock, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UserCardProps {
  user: {
    id: string;
    avatar_url: string | null;
    full_name: string | null;
    username: string | null;
    craft: string | null;
    location?: string | null;
    bio?: string | null;
    connection_status?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
  };
  onConnect: (userId: string) => void;
  onAccept: (userId: string) => void;
  onCancelRequest?: (userId: string) => void;
  onRemoveConnection?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onConnect, onAccept, onCancelRequest, onRemoveConnection }) => {
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
            className="w-full border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all text-xs font-semibold" 
            onClick={() => onRemoveConnection && onRemoveConnection(user.id)}
          >
            <UserCheck size={14} className="mr-1.5" /> Disconnect
          </Button>
        );
      case 'pending_sent':
        return (
          <Button 
            size="sm" 
            variant="secondary" 
            className="w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-xs font-semibold" 
            onClick={() => onCancelRequest && onCancelRequest(user.id)}
          >
            <Clock size={14} className="mr-1.5" /> Withdraw
          </Button>
        );
      case 'pending_received':
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-xs font-bold uppercase tracking-wider" 
            onClick={() => onAccept(user.id)}
          >
            <UserCheck size={14} className="mr-1.5" /> Accept
          </Button>
        );
      default:
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition-all text-xs font-bold uppercase tracking-wider" 
            onClick={() => onConnect(user.id)}
          >
            <UserPlus size={14} className="mr-1.5" /> Connect
          </Button>
        );
    }
  };

  return (
    <Card className="group relative overflow-hidden bg-card/40 backdrop-blur-sm border-border/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 flex flex-col items-center text-center p-0">
      {/* Decorative Background Header */}
      <div className="w-full h-20 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border-b border-border/20 group-hover:from-primary/30 transition-all duration-500" />
      
      <div className="px-5 pb-6 pt-0 w-full flex flex-col items-center">
        {/* Avatar Section */}
        <div className="-mt-10 mb-3 relative">
          <Link to={`/profile/${user.id}`} className="block relative group/avatar">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="h-20 w-20 border-4 border-background shadow-xl scale-100 group-hover/avatar:scale-105 transition-transform duration-500 ring-1 ring-border/50">
              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {getInitials(user.full_name || user.username)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Name and Info */}
        <div className="space-y-1 mb-4 w-full">
          <Link to={`/profile/${user.id}`} className="block">
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-none pt-1">
              {user.full_name || user.username}
            </h3>
            <p className="text-xs text-muted-foreground font-medium">@{user.username}</p>
          </Link>
          
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-tighter">
              <Briefcase size={10} className="mr-1" /> {user.craft || 'Filmmaker'}
            </Badge>
          </div>

          {user.location && (
            <p className="text-[11px] text-muted-foreground/70 flex items-center justify-center mt-1 font-medium">
              <MapPin size={10} className="mr-1 text-primary/50" /> {user.location}
            </p>
          )}

          {user.bio && (
            <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-3 px-2 leading-relaxed h-8 overflow-hidden italic italic-serif">
               "{user.bio}"
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 w-full gap-2 mt-2">
          {renderActionButton()}
          
          {status === 'connected' && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition-all text-xs font-semibold"
              asChild
            >
              <Link to={`/messages/${user.id}`}>
                <MessageCircle size={14} className="mr-1.5" /> Message
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default UserCard;
