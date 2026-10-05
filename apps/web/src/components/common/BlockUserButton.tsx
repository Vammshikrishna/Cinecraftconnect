import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';

/** Icon button that blocks / unblocks a user (blocked users cannot send you direct messages). */
const BlockUserButton = ({ targetId, targetName }: { targetId: string; targetName?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isBlocked, block, unblock } = useBlockedUsers();

  if (!user || user.id === targetId) return null;
  const blocked = isBlocked(targetId);

  const handleClick = async () => {
    if (!blocked && !window.confirm(`Block ${targetName || 'this user'}? They will no longer be able to message you.`)) {
      return;
    }
    const { error } = blocked ? await unblock(targetId) : await block(targetId);
    if (error) {
      toast({ title: blocked ? 'Could not unblock' : 'Could not block', description: (error as any).message, variant: 'destructive' });
    } else {
      toast({ title: blocked ? 'User unblocked' : 'User blocked' });
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={`h-9 w-9 rounded-full border-border/60 bg-card/70 backdrop-blur-md flex items-center justify-center shrink-0 shadow-sm ${blocked ? 'text-rose-500 border-rose-500/40' : 'hover:bg-rose-500/10 hover:text-rose-500'}`}
      onClick={handleClick}
      title={blocked ? 'Unblock user' : 'Block user'}
    >
      <Ban className="h-4 w-4" />
    </Button>
  );
};

export default BlockUserButton;
