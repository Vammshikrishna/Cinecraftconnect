import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, UserPlus, UserCheck, UserX, Clock, MessageCircle } from 'lucide-react';
import { UserProfile } from '@/hooks/useUsers';
import { Link } from 'react-router-dom';

interface UserCardProps {
  user: UserProfile;
  onConnect: (userId: string) => void;
  onCancelRequest: (connectionId: string) => void;
  onRemoveConnection: (connectionId: string) => void;
}

export const UserCard = ({ user, onConnect, onCancelRequest, onRemoveConnection }: UserCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderActionButton = () => {
    switch (user.connection_status) {
      case 'connected':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => user.connection_id && onRemoveConnection(user.connection_id)}
            className="flex-1 border-border"
          >
            <UserCheck size={14} className="mr-1" /> Connected
          </Button>
        );
      case 'pending_sent':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => user.connection_id && onCancelRequest(user.connection_id)}
            className="flex-1 border-border"
          >
            <Clock size={14} className="mr-1" /> Pending
          </Button>
        );
      case 'pending_received':
        return (
          <Badge variant="secondary" className="flex-1 justify-center py-2">
            <Clock size={14} className="mr-1" /> Received Request
          </Badge>
        );
      default:
        return (
          <Button
            size="sm"
            onClick={() => onConnect(user.id)}
            className="flex-1 btn-primary"
          >
            <UserPlus size={14} className="mr-1" /> Connect
          </Button>
        );
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        <Link to={`/profile/view?id=${user.id}`}>
          <Avatar className="h-14 w-14 cursor-pointer hover:ring-2 ring-primary transition-all">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(user.full_name || user.username || 'U')}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <Link to={`/profile/view?id=${user.id}`}>
            <h3 className="text-lg font-semibold text-foreground hover:text-primary transition-colors truncate">
              {user.full_name || user.username}
            </h3>
          </Link>
          <p className="text-primary text-sm mb-1">{user.craft || 'Filmmaker'}</p>
          {user.location && (
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <MapPin size={14} className="mr-1 flex-shrink-0" />
              <span className="truncate">{user.location}</span>
            </div>
          )}
          {user.bio && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{user.bio}</p>
          )}

          <div className="flex gap-2">
            {renderActionButton()}
            {user.connection_status === 'connected' && (
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                asChild
              >
                <Link to={`/chats?user=${user.id}`}>
                  <MessageCircle size={14} className="mr-1" /> Message
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
