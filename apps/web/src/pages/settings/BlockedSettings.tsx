import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { SettingsPageHeader, SettingsSection } from '@/components/settings/SettingsUI';

const BlockedSettings = () => {
  const { blocked, loading, unblock } = useBlockedUsers();
  const { toast } = useToast();

  return (
    <>
      <SettingsPageHeader title="Blocked accounts" description="They cannot message you, call you, send requests or see your profile details. They are not told." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">You haven't blocked anyone.</p>
      ) : (
        <SettingsSection>
          {blocked.map(b => (
            <div key={b.blocked_user_id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/profile/${b.blocked_user_id}`}>
                <Avatar className="h-10 w-10"><AvatarImage src={b.profile?.avatar_url || undefined} /><AvatarFallback>{(b.profile?.full_name || b.profile?.username || '?')[0]}</AvatarFallback></Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">{b.profile?.full_name || b.profile?.username || 'Member'}</p>
                {b.profile?.username && <p className="text-xs text-muted-foreground">@{b.profile.username}</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={async () => {
                const { error } = await unblock(b.blocked_user_id);
                toast(error ? { title: 'Could not unblock', variant: 'destructive' } : { title: 'Unblocked' });
              }}>Unblock</Button>
            </div>
          ))}
        </SettingsSection>
      )}
    </>
  );
};

export default BlockedSettings;
