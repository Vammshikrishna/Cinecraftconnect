import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MapPin, Check, X } from 'lucide-react';
import { Connection } from '@/hooks/useConnections';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface ConnectionRequestCardProps {
  connection: Connection;
  onAccept: (connectionId: string) => void;
  onReject: (connectionId: string) => void;
}

export const ConnectionRequestCard = ({
  connection,
  onAccept,
  onReject,
}: ConnectionRequestCardProps) => {
  const profile = connection.follower_profile;
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    await onAccept(connection.id);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    setIsProcessing(true);
    await onReject(connection.id);
    setIsProcessing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all">
      <div className="flex items-start gap-4">
        <Link to={`/profile/${profile.id}`}>
          <Avatar className="h-14 w-14 cursor-pointer hover:ring-2 ring-primary transition-all">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(profile.full_name || profile.username || 'U')}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <Link to={`/profile/${profile.id}`}>
            <h3 className="text-lg font-semibold text-foreground hover:text-primary transition-colors truncate">
              {profile.full_name || profile.username}
            </h3>
          </Link>
          <p className="text-primary text-sm mb-1">{profile.craft || 'Filmmaker'}</p>
          {profile.location && (
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <MapPin size={14} className="mr-1 flex-shrink-0" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-3">
            {formatDistanceToNow(new Date(connection.created_at), { addSuffix: true })}
          </p>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1 btn-primary"
              disabled={isProcessing}
            >
              <Check size={14} className="mr-1" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              className="flex-1 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
              disabled={isProcessing}
            >
              <X size={14} className="mr-1" /> Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
