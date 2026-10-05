import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsMenu } from '@/components/settings/SettingsUI';

/** /settings: the menu on phones; on wide screens the menu is already on the left, so a short overview shows here. */
const SettingsPage = () => {
  const { profile } = useAuth();
  const p = profile as any;

  return (
    <>
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold mb-4">Settings and activity</h1>
        <SettingsMenu />
      </div>

      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <Link to="/settings/account" className="flex items-center gap-4 rounded-2xl border bg-card p-5 hover:bg-muted/40 transition-colors">
          <Avatar className="h-16 w-16"><AvatarImage src={p?.avatar_url || undefined} /><AvatarFallback>{(p?.full_name || 'U')[0]}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <p className="text-lg font-semibold">{p?.full_name || p?.username}</p>
            <p className="text-sm text-muted-foreground">@{p?.username} · Accounts Center</p>
          </div>
        </Link>
        <p className="text-sm text-muted-foreground mt-6">Choose a setting from the list. Changes are saved as soon as you make them.</p>
      </div>
    </>
  );
};

export default SettingsPage;
