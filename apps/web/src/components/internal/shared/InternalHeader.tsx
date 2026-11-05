import React, { useEffect, useState } from 'react';
import { 
  Shield, Settings, User, LogOut,
  Terminal, Activity, Globe, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLogo from '@/components/common/AppLogo';
import StaffSearch from '@/components/internal/shared/StaffSearch';
import OnCallBadge from '@/components/internal/shared/OnCallBadge';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAppRole } from '@/hooks/useAppRole';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface InternalHeaderProps {
  title: string;
  subtitle: string;
  role: 'Moderator' | 'Admin' | 'Super Admin' | 'Finance';
}

const InternalHeader: React.FC<InternalHeaderProps> = ({ title, subtitle, role }) => {
   const { push } = useAppNavigation();
  const { role: userRole } = useAppRole();
  const { signOut, user, profile } = useAuth();
  const shownName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Staff';
  const shownHandle = profile?.username ? `@${profile.username}` : null;
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const appVersion = import.meta.env.VITE_APP_VERSION as string | undefined;

  const roleColors = {
    'Moderator': 'text-primary bg-primary/10 border-primary/20',
    'Admin': 'text-primary bg-primary/15 border-primary/30',
    'Super Admin': 'text-primary font-black bg-primary/20 border-primary/40 shadow-sm shadow-primary/10',
  };

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <AppLogo size="sm" to="/feed" />
        
        <div className="h-8 w-px bg-border/50 hidden md:block" />
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-tight text-foreground uppercase">{title}</h1>
            <span className={`text-[12px] px-2 py-0.5 rounded-full font-black border uppercase tracking-widest ${roleColors[role]}`}>
              {role}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground font-medium tracking-wide">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userRole !== 'finance' && <OnCallBadge />}
        {userRole !== 'finance' && <StaffSearch />}
        {/* Internal Navigation Shortcuts */}
        <div className="hidden lg:flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
          {userRole !== 'finance' && (
            <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-[12px] font-bold gap-1.5" onClick={() => push('/moderation')}>
              <Shield className="w-3.5 h-3.5" /> MOD
            </Button>
          )}
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-[12px] font-bold gap-1.5" onClick={() => push('/admin')}>
              <Activity className="w-3.5 h-3.5" /> OPS
            </Button>
          )}
          {userRole === 'super_admin' && (
            <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-[12px] font-bold gap-1.5" onClick={() => push('/super-admin')}>
              <Terminal className="w-3.5 h-3.5" /> ROOT
            </Button>
          )}
        </div>

        <div className="h-8 w-px bg-border/50" />

        {/* Global Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[12px] font-bold text-foreground/70 uppercase tracking-tighter">{online ? 'Connected' : 'Offline'}</span>
            </div>
            {appVersion && <span className="text-[12px] text-muted-foreground font-mono">v{appVersion}</span>}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account menu" className="w-9 h-9 rounded-full border border-border/50 bg-muted/30 relative">
                <User className="w-4 h-4" />
                {role === 'Super Admin' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-background flex items-center justify-center">
                  <Lock className="w-1.5 h-1.5 text-white" />
                </div>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border-border shadow-2xl">
              <DropdownMenuLabel className="px-3 py-2">
                <p className="text-xs font-bold text-foreground">{shownName}{shownHandle && profile?.full_name ? <span className="ml-1.5 font-medium text-muted-foreground">{shownHandle}</span> : null}</p>
                <p className="text-[12px] text-muted-foreground font-medium">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer gap-2" onClick={() => push('/settings')}>
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Internal Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer gap-2" onClick={() => push('/community-guidelines')}>
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Community guidelines</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer gap-2 text-red-500 hover:bg-red-500/10" onClick={() => signOut()}>
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-bold">Secure Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default InternalHeader;
