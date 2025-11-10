import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { User, MessageCircle, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UserCardProps {
  user: {
    id: string;
    avatar_url: string;
    full_name: string;
    username: string;
    craft: string;
    // FINAL FIX: Made connection_status optional to match the UserProfile type.
    connection_status?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
  };
  onConnect: (userId: string) => void;
  onAccept: (userId: string) => void;
  onCancelRequest?: (userId: string) => void;
  onRemoveConnection?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onConnect, onAccept, onCancelRequest, onRemoveConnection }) => {
  const { user: currentUser } = useAuth();

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderActionButton = () => {
    if (user.id === currentUser?.id) return null;

    // FINAL FIX: Default to 'none' if the status is not provided.
    const status = user.connection_status || 'none';

    switch (status) {
      case 'connected':
        return (
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onRemoveConnection && onRemoveConnection(user.id)}>
            <UserCheck size={14} className="mr-1" /> Connected
          </Button>
        );
      case 'pending_sent':
        return (
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onCancelRequest && onCancelRequest(user.id)}>
            <Clock size={14} className="mr-1" /> Pending
          </Button>
        );
      case 'pending_received':
        return (
          <Button size="sm" variant="default" className="flex-1 hover-glow" onClick={() => onAccept(user.id)}>
            <UserCheck size={14} className="mr-1" /> Accept
          </Button>
        );
      default:
        return (
          <Button size="sm" variant="default" className="flex-1 hover-glow" onClick={() => onConnect(user.id)}>
            <UserPlus size={14} className="mr-1" /> Connect
          </Button>
        );
    }
  };

  return (
    <Card className="p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
      <div className="flex items-center space-x-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{user.full_name}</h3>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <p className="text-sm text-primary mt-1">{user.craft}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
              {renderActionButton()}
              {(user.connection_status || 'none') === 'connected' && (
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  asChild
                >
                  <Link to={`/dm/${user.id}`}>
                    <MessageCircle size={14} className="mr-1" /> Message
                  </Link>
                </Button>
              )}
            </div>
        </div>
      </div>
    </Card>
  );
};

export default UserCard;
