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
  ExternalLink,
  Flag,
  Ban,
  StickyNote
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
import ReportDialog from '@/components/common/ReportDialog';
import { ConnectionNoteDialog } from './ConnectionNoteDialog';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
    connection_status?: 'connected' | 'pending_sent' | 'pending_received' | 'none';
    is_verified?: boolean;
    suggestion_reason?: string;
    mutual_count?: number;
    note?: string | null;
    availability?: string | null;
    my_note?: string | null;
    my_tags?: string[];
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
  /** Requests: hide a received request quietly (or, with ignoreLabel, bring it back). */
  onIgnore?: (userId: string) => void;
  ignoreLabel?: string;
}

const UserCard: React.FC<UserCardProps> = ({ user, onConnect, onAccept, onReject, onCancelRequest, onRemoveConnection, onDismiss, isFanFollowMode, isFollowing, onFollow, onUnfollow, onIgnore, ignoreLabel }) => {
  const { push } = useAppNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { block } = useBlockedUsers();
  const [confirm, setConfirm] = React.useState<'block' | 'remove' | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
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
              className={isMutualFollow ? "w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition text-[12px] sm:text-[12px] font-bold px-2 h-10" : "w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition text-[12px] sm:text-[12px] font-bold px-2 h-10 col-span-2"} 
              onClick={() => onUnfollow && onUnfollow(user.id)}
            >
              <UserCheck size={11} className="mr-1" /> Following
            </Button>
            {isMutualFollow && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition text-[12px] sm:text-[12px] font-bold px-2 h-10"
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
          className="w-full bg-primary/10 text-primary hover:bg-primary/15 transition text-[12px] sm:text-[12px] font-bold px-2 h-10 md:h-9"
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
            className="w-full bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition text-[12px] sm:text-[12px] font-bold px-2 h-10" 
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
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-primary/20 transition text-[12px] sm:text-[12px] font-bold px-2 h-10" 
              onClick={() => onAccept && onAccept(user.id)}
            >
              <UserCheck size={11} className="mr-1" /> Accept
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="w-full border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition text-[12px] sm:text-[12px] font-bold px-2 h-10" 
              onClick={() => onReject && onReject(user.id)}
            >
              <X size={11} className="mr-1" /> Reject
            </Button>
            {onIgnore && (
              <button
                className="col-span-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onIgnore(user.id)}
              >
                {ignoreLabel || 'Ignore'}
              </button>
            )}
          </div>
        );
      default:
        return (
          <Button 
            size="sm" 
            className="w-full bg-primary/10 text-primary hover:bg-primary/15 transition text-[12px] sm:text-[12px] font-bold px-2 h-10 md:h-9"
            onClick={() => onConnect && onConnect(user.id)}
          >
            <UserPlus size={11} className="mr-1" /> Connect
          </Button>
        );
    }
  };

  return (
    <div className="group relative glass-card-premium flex flex-col items-center text-center p-3 sm:p-7 transition duration-300 [@media(hover:hover)]:hover:-translate-y-1 w-full mx-auto min-h-[250px] sm:min-h-[300px] justify-between">
      {onDismiss && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(user.id);
          }}
          className="absolute top-1 right-1 z-30 h-11 w-11 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground transition before:absolute before:inset-1.5 before:rounded-full before:bg-background/80 before:border before:border-border/60 before:-z-10"
          title="Remove suggestion"
          aria-label="Dismiss suggestion"
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}
      
      {/* Only people you are connected to have a menu (Remove Connection, Notes & tags). On suggestions and requests it only held View Profile, Report and Block, which are on the profile. */}
      {user.id !== currentUser?.id && status === 'connected' && !isFanFollowMode && (
        <div className="absolute top-1 left-1 z-30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-11 w-11 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground transition before:absolute before:inset-1.5 before:rounded-full before:bg-background/80 before:border before:border-border/60 before:-z-10"
                title="More"
                aria-label="More actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 glass-card border-border/50">
              <DropdownMenuItem className="text-xs font-bold cursor-pointer" onClick={() => push(`/profile/${user.id}`)}>
                <ExternalLink className="mr-2 h-4 w-4" /> View Profile
              </DropdownMenuItem>
              {status === 'connected' && !isFanFollowMode && (
                <DropdownMenuItem className="text-xs font-bold cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setConfirm('remove')}>
                  <UserX className="mr-2 h-4 w-4" /> Remove Connection
                </DropdownMenuItem>
              )}
              {status === 'connected' && !isFanFollowMode && (
                <DropdownMenuItem className="text-xs font-bold cursor-pointer" onClick={() => setNotesOpen(true)}>
                  <StickyNote className="mr-2 h-4 w-4" /> Notes & tags
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-xs font-bold cursor-pointer" onClick={() => setReportOpen(true)}>
                <Flag className="mr-2 h-4 w-4" /> Report
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-bold cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setConfirm('block')}>
                <Ban className="mr-2 h-4 w-4" /> Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="w-full flex flex-col items-center">
        {/* Avatar Section */}
        <div className="mb-2 relative">
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => push(`/profile/${user.id}`)} className="block relative group/avatar cursor-pointer">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
            <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-2 border-border shadow-xl scale-100 group-hover/avatar:scale-105 transition-transform duration-500 ring-4 ring-background/50">
              <AvatarImage src={cachedAvatar} alt={user.full_name || 'User'} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                {getInitials(user.full_name || user.username)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
 
        {/* Name and Info */}
        <div className="space-y-0.5 mb-2 w-full">
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => push(`/profile/${user.id}`)} className="block cursor-pointer">
            <h3 className="font-serif font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight pt-1 text-center">
              {(() => {
                // the tick belongs to the last word, so it always sits right beside the last letter, even when the name wraps
                const words = String(user.full_name || user.username || '').trim().split(/\s+/);
                const last = words.pop() || '';
                return (
                  <>
                    {words.length > 0 && words.join(' ') + ' '}
                    <span className="whitespace-nowrap">
                      {last}
                      {user.is_verified && <VerificationBadge size="xs" className="ml-1 align-middle" />}
                    </span>
                  </>
                );
              })()}
            </h3>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
            <div className="text-xs font-medium text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded text-center">
              {user.craft || 'Filmmaker'}
            </div>
          </div>
 
          {user.my_tags && user.my_tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mt-1.5">
              {user.my_tags.slice(0, 4).map(t => (
                <span key={t} className="text-[12px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">#{t}</span>
              ))}
            </div>
          )}

          {user.note && (
            <p className="text-sm text-foreground/80 mt-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10 line-clamp-3 text-left">
              “{user.note}”
            </p>
          )}

          {user.bio && (
            <p className="text-sm text-muted-foreground/80 line-clamp-2 mt-1.5 px-2 leading-snug min-h-[2.4rem] overflow-hidden italic italic-serif">
               "{user.bio}"
            </p>
          )}
        </div>
      </div>

      <div className="w-full mt-auto pt-4 space-y-3">
        {user.suggestion_reason && (
          <div className="flex items-center justify-center gap-1">
            {/mutual/i.test(user.suggestion_reason) && <Users size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on your craft' && <Briefcase size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on location' && <MapPin size={9} className="text-primary/60" />}
            {user.suggestion_reason === 'Based on network' && <Globe size={9} className="text-primary/60" />}
            {(user.suggestion_reason === 'Suggested for you' || user.suggestion_reason === 'Connected' || user.suggestion_reason === 'Pending connection') && <Sparkles size={9} className="text-primary/60" />}
            <span className="text-xs font-medium text-muted-foreground bg-muted/10 border border-border/40 px-2 py-0.5 rounded text-center truncate max-w-[140px]">
              {user.suggestion_reason}
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
                className="flex-1 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 transition text-[12px] sm:text-[12px] font-bold px-2 h-10"
                onClick={() => push(`/messages/${user.id}`)}
              >
                <MessageCircle size={11} className="mr-1 sm:mr-1.5" /> Message
              </Button>
            </>
          ) : (
            <div className="w-full">
              {renderActionButton()}
            </div>
          )}
        </div>
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetId={user.id} targetType="user" />
      <ConnectionNoteDialog open={notesOpen} onOpenChange={setNotesOpen} otherId={user.id} name={user.full_name || user.username || 'this person'} note={user.my_note} tags={user.my_tags} />
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'block' ? `Block ${user.full_name || user.username}?` : `Remove ${user.full_name || user.username}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'block'
                ? 'They will not be able to message you or send you requests, and any connection between you is removed. You can unblock them in Settings.'
                : 'You will no longer be connected. They are not notified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirm === 'remove') {
                  onRemoveConnection && onRemoveConnection(user.id);
                } else {
                  const { error } = await block(user.id);
                  if (error) {
                    toast({ title: 'Could not block', description: (error as any).message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Blocked', description: 'They can no longer contact you.' });
                    queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
                    queryClient.invalidateQueries({ queryKey: ['users'] });
                  }
                }
                setConfirm(null);
              }}
            >
              {confirm === 'block' ? 'Block' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserCard;
