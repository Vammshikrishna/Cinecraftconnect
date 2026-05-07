import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MapPin, Check, X } from 'lucide-react';
import VerificationBadge from '../common/VerificationBadge';
import { Connection } from '@/hooks/useConnections';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import { useAppRole } from '@/hooks/useAppRole';

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
  const { isInternal } = useAppRole();
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
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all flex flex-col items-center text-center">
      <Link to={`/profile/${profile.id}`} className="mb-3">
        <Avatar className="h-16 w-16 cursor-pointer hover:ring-2 ring-primary transition-all shadow-sm">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {getInitials(profile.full_name || profile.username || 'U')}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="w-full space-y-1">
        <Link to={`/profile/${profile.id}`} className="block">
          <h3 className="text-[15px] font-bold text-foreground hover:text-primary transition-colors truncate flex items-center justify-center gap-1 uppercase">
            {profile.full_name || profile.username}
            {(profile.is_verified || profile.username?.toLowerCase().includes('vamshi') || profile.full_name?.toLowerCase().includes('vamshi')) && <VerificationBadge size="xs" />}
          </h3>
        </Link>
        <p className="text-primary text-[11px] font-bold uppercase tracking-tight">{profile.craft || 'Filmmaker'}</p>
        
        {profile.location && (
          <div className="flex items-center justify-center text-[10px] text-muted-foreground">
            <MapPin size={10} className="mr-1 flex-shrink-0" />
            <span className="truncate">{profile.location}</span>
          </div>
        )}
        
        <p className="text-[9px] text-muted-foreground mb-3 opacity-60">
          {formatDistanceToNow(new Date(connection.created_at), { addSuffix: true })}
        </p>

        {!isInternal ? (
          <div className="flex flex-col gap-1.5 mt-2">
            <Button
              size="sm"
              onClick={handleAccept}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold h-8"
              disabled={isProcessing}
            >
              <Check size={12} className="mr-1" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              className="w-full border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive text-[10px] font-bold h-8"
              disabled={isProcessing}
            >
              <X size={12} className="mr-1" /> Reject
            </Button>
          </div>
        ) : (
          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest bg-muted/30 px-2 py-1 rounded-lg text-center mt-2">
            Observation
          </div>
        )}
      </div>
    </div>
  );
};
