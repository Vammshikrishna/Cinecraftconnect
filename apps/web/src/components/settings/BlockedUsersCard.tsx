import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';

const BlockedUsersCard = () => {
  const { blocked, loading, unblock } = useBlockedUsers();
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocked Users</CardTitle>
        <CardDescription>Blocked users cannot send you direct messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
        ) : (
          blocked.map((b) => (
            <div key={b.blocked_user_id} className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {b.profile?.full_name || b.profile?.username || b.blocked_user_id}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { error } = await unblock(b.blocked_user_id);
                  toast(error ? { title: 'Could not unblock', description: (error as any).message, variant: 'destructive' } : { title: 'User unblocked' });
                }}
              >
                Unblock
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default BlockedUsersCard;
